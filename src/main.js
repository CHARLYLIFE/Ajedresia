import { Chess } from 'chess.js';
import './style.css';

const $ = (id) => document.getElementById(id);
const game = new Chess();
const PIECES = {
  w: { k: '♔', q: '♕', r: '♖', b: '♗', n: '♘', p: '♙' },
  b: { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟︎' },
};

let playerColor = 'w';
let boardFlipped = false;
let selectedSquare = null;
let gameStarted = false;
let engineReady = false;
let engineThinking = false;
let ignoreNextBestmove = false;
let searchDepth = 24;
let shownDepth = 0;
let lastMove = null;
let engineFailed = false;

const boardEl = $('chessboard');
const overlay = $('setup-overlay');
const cancelSetup = $('cancel-setup');
const enginePill = $('engine-pill');
const engineLabel = $('engine-label');
const gameStatus = $('game-status');
const statusDetail = $('status-detail');
const spinner = $('thinking-spinner');
const movesList = $('moves-list');
const undoButton = $('undo-button');

function sendEngine(command) {
  if (worker && !engineFailed) worker.postMessage(command);
}

let worker;
try {
  worker = new Worker('/engine/stockfish-19-single.js');
  worker.onmessage = ({ data }) => handleEngineLine(String(data));
  worker.onerror = () => {
    engineFailed = true;
    engineReady = false;
    engineThinking = false;
    enginePill.classList.remove('ready');
    engineLabel.textContent = 'Error al cargar el motor';
    gameStatus.textContent = 'No se pudo iniciar Stockfish.';
    statusDetail.textContent = 'Comprueba que el APK se haya compilado desde el repositorio completo.';
    spinner.classList.add('hidden');
  };
  sendEngine('uci');
} catch (error) {
  engineFailed = true;
  console.error(error);
  engineLabel.textContent = 'Motor no disponible';
  gameStatus.textContent = 'No se pudo crear el motor de ajedrez.';
  statusDetail.textContent = 'Vuelve a compilar la aplicación con el workflow de GitHub.';
}

function handleEngineLine(line) {
  if (line === 'uciok') {
    sendEngine('setoption name Threads value 1');
    sendEngine('setoption name Hash value 128');
    sendEngine('setoption name Skill Level value 20');
    sendEngine('setoption name UCI_LimitStrength value false');
    sendEngine('isready');
    return;
  }
  if (line === 'readyok') {
    engineReady = true;
    enginePill.classList.add('ready');
    engineLabel.textContent = 'Motor listo';
    $('status-detail').textContent = 'Stockfish 19 Full · sin limitación de fuerza';
    render();
    maybeAskEngineMove();
    return;
  }
  if (line.startsWith('info depth ')) {
    const match = line.match(/\bdepth\s+(\d+)/);
    if (match) {
      shownDepth = Number(match[1]);
      if (engineThinking) statusDetail.textContent = `Calculando · profundidad ${shownDepth} de ${searchDepth}`;
    }
    return;
  }
  if (!line.startsWith('bestmove ')) return;

  if (ignoreNextBestmove) {
    ignoreNextBestmove = false;
    engineThinking = false;
    shownDepth = 0;
    render();
    maybeAskEngineMove();
    return;
  }
  if (!engineThinking) return;

  engineThinking = false;
  shownDepth = 0;
  const match = line.match(/^bestmove\s+([a-h][1-8][a-h][1-8][qrbn]?)/);
  if (!match) {
    render();
    return;
  }
  const uci = match[1];
  try {
    const move = game.move({
      from: uci.slice(0, 2),
      to: uci.slice(2, 4),
      promotion: uci[4] || 'q',
    });
    if (move) lastMove = { from: move.from, to: move.to };
    selectedSquare = null;
    render();
  } catch (error) {
    console.error('Stockfish devolvió una jugada que no se pudo aplicar:', uci, error);
    gameStatus.textContent = 'El motor devolvió una jugada no válida. Reinicia la partida.';
  }
  maybeAskEngineMove();
}

function maybeAskEngineMove() {
  if (!gameStarted || !engineReady || engineFailed || engineThinking || game.isGameOver()) return;
  if (game.turn() === playerColor) {
    renderStatus();
    return;
  }
  engineThinking = true;
  shownDepth = 0;
  render();
  sendEngine(`position fen ${game.fen()}`);
  sendEngine(`go depth ${searchDepth}`);
}

function squareClass(fileIndex, rank) {
  return ((fileIndex + rank) % 2 === 1) ? 'dark' : 'light';
}

function renderBoard() {
  const whiteAtBottom = (playerColor === 'w') !== boardFlipped;
  const ranks = whiteAtBottom ? [8, 7, 6, 5, 4, 3, 2, 1] : [1, 2, 3, 4, 5, 6, 7, 8];
  const files = whiteAtBottom ? ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] : ['h', 'g', 'f', 'e', 'd', 'c', 'b', 'a'];
  const legalMoves = selectedSquare ? game.moves({ square: selectedSquare, verbose: true }) : [];
  const legalTargets = new Map(legalMoves.map((move) => [move.to, move]));
  const html = [];

  for (let row = 0; row < ranks.length; row += 1) {
    const rank = ranks[row];
    for (let col = 0; col < files.length; col += 1) {
      const file = files[col];
      const square = `${file}${rank}`;
      const piece = game.get(square);
      const selected = square === selectedSquare;
      const target = legalTargets.has(square);
      const last = lastMove && (square === lastMove.from || square === lastMove.to);
      const classes = ['square', squareClass('abcdefgh'.indexOf(file), rank)];
      if (selected) classes.push('selected');
      if (target) classes.push('target');
      if (target && piece) classes.push('has-piece-target');
      if (last) classes.push('last-move');
      const rankLabel = col === 0 ? `<span class="coord coord-rank">${rank}</span>` : '';
      const fileLabel = row === 7 ? `<span class="coord coord-file">${file}</span>` : '';
      const glyph = piece ? `<span class="piece ${piece.color === 'w' ? 'white' : 'black'}">${PIECES[piece.color][piece.type]}</span>` : '';
      const dot = target ? '<span class="move-dot" aria-hidden="true"></span>' : '';
      html.push(`<button class="${classes.join(' ')}" type="button" role="gridcell" data-square="${square}" aria-label="${square}${piece ? `, ${piece.color === 'w' ? 'blanca' : 'negra'} ${piece.type}` : ''}" ${engineThinking || !gameStarted || game.isGameOver() || game.turn() !== playerColor ? 'disabled' : ''}>${rankLabel}${fileLabel}${glyph}${dot}</button>`);
    }
  }
  boardEl.innerHTML = html.join('');
  boardEl.querySelectorAll('[data-square]').forEach((button) => {
    button.addEventListener('click', () => handleSquareClick(button.dataset.square));
  });
}

function handleSquareClick(square) {
  if (!gameStarted || engineThinking || game.isGameOver() || game.turn() !== playerColor) return;
  const piece = game.get(square);

  if (selectedSquare) {
    const selectedMove = game.moves({ square: selectedSquare, verbose: true }).find((move) => move.to === square);
    if (selectedMove) {
      try {
        const move = game.move({ from: selectedSquare, to: square, promotion: 'q' });
        if (move) lastMove = { from: move.from, to: move.to };
        selectedSquare = null;
        render();
        maybeAskEngineMove();
      } catch (error) {
        console.error(error);
        selectedSquare = null;
        render();
      }
      return;
    }
  }

  if (piece && piece.color === playerColor) {
    selectedSquare = square;
  } else {
    selectedSquare = null;
  }
  renderBoard();
}

function renderMoves() {
  const history = game.history({ verbose: true });
  $('move-counter').textContent = String(history.length);
  $('turn-count').textContent = `${history.length} ${history.length === 1 ? 'medio movimiento' : 'medios movimientos'}`;
  if (history.length === 0) {
    movesList.innerHTML = '<div class="empty-moves">Los movimientos aparecerán aquí cuando empiece la partida.</div>';
    return;
  }
  const rows = [];
  for (let i = 0; i < history.length; i += 2) {
    const number = Math.floor(i / 2) + 1;
    const white = history[i];
    const black = history[i + 1];
    rows.push(`<div class="move-pair"><span class="move-number">${number}.</span><span class="move-text ${i === history.length - 1 ? 'current' : ''}">${white.san}</span><span class="move-text ${i + 1 === history.length - 1 ? 'current' : ''}">${black ? black.san : '·'}</span></div>`);
  }
  movesList.innerHTML = rows.join('');
  movesList.scrollTop = movesList.scrollHeight;
}

function renderStatus() {
  spinner.classList.toggle('hidden', !engineThinking);
  if (!gameStarted) {
    gameStatus.textContent = 'Elige con qué color quieres jugar.';
    statusDetail.textContent = engineReady ? 'Stockfish 19 Full · listo' : 'Preparando el motor de ajedrez…';
    $('status-icon').textContent = '♟';
    return;
  }
  if (game.isCheckmate()) {
    const winner = game.turn() === 'w' ? 'Negras' : 'Blancas';
    gameStatus.textContent = `Jaque mate. Ganan ${winner.toLowerCase()}.`;
    statusDetail.textContent = winner === (playerColor === 'w' ? 'Blancas' : 'Negras') ? '¡Has ganado la partida!' : 'La máquina ha ganado esta vez.';
    $('status-icon').textContent = '♚';
    return;
  }
  if (game.isDraw()) {
    let reason = 'Partida empatada.';
    if (game.isStalemate()) reason = 'Tablas por ahogado.';
    else if (game.isThreefoldRepetition()) reason = 'Tablas por repetición triple.';
    else if (game.isInsufficientMaterial()) reason = 'Tablas por material insuficiente.';
    else if (game.isDrawByFiftyMoves()) reason = 'Tablas por la regla de cincuenta movimientos.';
    gameStatus.textContent = reason;
    statusDetail.textContent = 'La partida ha terminado.';
    $('status-icon').textContent = '½';
    return;
  }
  if (engineThinking) {
    gameStatus.textContent = 'Stockfish está pensando…';
    statusDetail.textContent = shownDepth ? `Calculando · profundidad ${shownDepth} de ${searchDepth}` : `Buscando la mejor jugada · profundidad ${searchDepth}`;
    $('status-icon').textContent = '♜';
    return;
  }
  const turnName = game.turn() === 'w' ? 'blancas' : 'negras';
  if (game.isCheck()) {
    gameStatus.textContent = game.turn() === playerColor ? 'Estás en jaque.' : 'Stockfish está en jaque.';
  } else {
    gameStatus.textContent = game.turn() === playerColor ? 'Tu turno.' : 'Turno de Stockfish.';
  }
  statusDetail.textContent = `${turnName[0].toUpperCase()}${turnName.slice(1)} mueven · Stockfish 19 Full sin handicap`;
  $('status-icon').textContent = game.turn() === playerColor ? (playerColor === 'w' ? '♙' : '♟︎') : '♜';
}

function render() {
  renderBoard();
  renderMoves();
  renderStatus();
  $('side-label').textContent = gameStarted ? (playerColor === 'w' ? 'Tú: blancas' : 'Tú: negras') : 'Sin elegir';
  $('side-indicator').querySelector('.side-piece').textContent = playerColor === 'w' ? '♙' : '♟︎';
  const whiteAtBottom = (playerColor === 'w') !== boardFlipped;
  const humanLabel = playerColor === 'w' ? 'TÚ · BLANCAS' : 'TÚ · NEGRAS';
  const engineLabelAtSide = playerColor === 'w' ? 'STOCKFISH · NEGRAS' : 'STOCKFISH · BLANCAS';
  $('player-top-label').textContent = gameStarted ? (whiteAtBottom ? engineLabelAtSide : humanLabel) : 'TÚ';
  $('player-bottom-label').textContent = gameStarted ? (whiteAtBottom ? humanLabel : engineLabelAtSide) : 'ELIGE UN COLOR';
  undoButton.disabled = !gameStarted || game.history().length === 0;
}

function showSetup() {
  cancelSetup.classList.toggle('hidden', !gameStarted);
  overlay.classList.remove('hidden');
}

function stopSearchIfNeeded() {
  if (engineThinking) {
    ignoreNextBestmove = true;
    sendEngine('stop');
  }
}

function startGame(color) {
  stopSearchIfNeeded();
  playerColor = color;
  boardFlipped = false;
  game.reset();
  selectedSquare = null;
  lastMove = null;
  gameStarted = true;
  shownDepth = 0;
  overlay.classList.add('hidden');
  render();
  maybeAskEngineMove();
}

function undoMove() {
  if (!gameStarted || game.history().length === 0) return;
  stopSearchIfNeeded();
  const plies = (game.turn() === playerColor && game.history().length >= 2) ? 2 : 1;
  for (let i = 0; i < plies; i += 1) game.undo();
  selectedSquare = null;
  const history = game.history({ verbose: true });
  lastMove = history.length ? { from: history[history.length - 1].from, to: history[history.length - 1].to } : null;
  render();
  maybeAskEngineMove();
}

$('play-white').addEventListener('click', () => startGame('w'));
$('play-black').addEventListener('click', () => startGame('b'));
$('new-game-button').addEventListener('click', showSetup);
cancelSetup.addEventListener('click', () => overlay.classList.add('hidden'));
undoButton.addEventListener('click', undoMove);
$('flip-button').addEventListener('click', () => {
  boardFlipped = !boardFlipped;
  renderBoard();
});
$('depth-select').addEventListener('change', (event) => {
  searchDepth = Number(event.target.value) || 24;
  if (!engineThinking) statusDetail.textContent = `Stockfish 19 Full · profundidad objetivo ${searchDepth}`;
});

render();
