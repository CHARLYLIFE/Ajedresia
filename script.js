let board = null;
let game = new Chess();
let lastBestMove = null;

// Cargamos el motor Stockfish lite local
const stockfish = new Worker('stockfish-19-lite.js');

stockfish.onmessage = function(event) {
    let message = event.data;
    
    if (message && message.startsWith('bestmove')) {
        let partes = message.split(' ');
        lastBestMove = partes[1]; // Ejemplo: "e2e4"
        
        let label = document.getElementById('bestMove');
        if (lastBestMove) {
            label.innerText = lastBestMove.toUpperCase();
        } else {
            label.innerText = "Ninguna";
        }
    }
};

stockfish.postMessage('uci');

function onDragStart (source, piece, board, orientation) {
    if (game.game_over()) return false;
    if ((game.turn() === 'w' && piece.search(/^b/) !== -1) ||
        (game.turn() === 'b' && piece.search(/^w/) !== -1)) {
        return false;
    }
}

function onDrop (source, target) {
    let move = game.move({
        from: source,
        to: target,
        promotion: 'q'
    });

    if (move === null) return 'snapback';
    updateStatus();
}

function onSnapEnd () {
    board.position(game.fen());
}

function updateStatus () {
    let status = '';
    let moveColor = (game.turn() === 'w') ? 'Blancas' : 'Negras';

    if (game.in_checkmate()) {
        status = 'Jaque mate. Ganan las ' + (moveColor === 'Blancas' ? 'Negras' : 'Blancas');
    } else if (game.in_draw()) {
        status = 'Tablas (Empate)';
    } else {
        status = 'Turno de las ' + moveColor;
        if (game.in_check()) {
            status += ' (¡Jaque!)';
        }
    }

    document.getElementById('status').innerText = status;
    document.getElementById('fen').value = game.fen();

    if (!game.game_over()) {
        document.getElementById('bestMove').innerText = "Calculando...";
        lastBestMove = null;
        stockfish.postMessage(`position fen ${game.fen()}`);
        stockfish.postMessage('go depth 10');
    }
}

// Configuración con imágenes corregidas desde la CDN oficial
let config = {
    draggable: true,
    position: 'start',
    pieceTheme: 'https://cdnjs.cloudflare.com/ajax/libs/chessboard-js/1.0.0/img/chesspieces/wikipedia/{piece}.png',
    onDragStart: onDragStart,
    onDrop: onDrop,
    onSnapEnd: onSnapEnd
};

board = Chessboard('myBoard', config);
updateStatus();

document.getElementById('resetBtn').addEventListener('click', () => {
    game.reset();
    board.start();
    updateStatus();
});

document.getElementById('flipBtn').addEventListener('click', () => {
    board.flip();
});

// Botón nuevo: Aplica la jugada de la IA automáticamente en el tablero
document.getElementById('autoMoveBtn').addEventListener('click', () => {
    if (!lastBestMove) {
        alert("Espera a que la IA termine de calcular.");
        return;
    }

    let fromSquare = lastBestMove.substring(0, 2);
    let toSquare = lastBestMove.substring(2, 4);

    let move = game.move({
        from: fromSquare,
        to: toSquare,
        promotion: 'q'
    });

    if (move !== null) {
        board.position(game.fen());
        updateStatus();
    } else {
        alert("No se pudo aplicar el movimiento automáticamente.");
    }
});
