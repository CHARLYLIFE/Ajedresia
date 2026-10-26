let board = null;
let game = new Chess();

// Cargamos el motor Stockfish lite que subiste a GitHub
const stockfish = new Worker('stockfish-19-lite.js');

// Escuchamos la respuesta de la IA local
stockfish.onmessage = function(event) {
    let message = event.data;
    
    if (message && message.startsWith('bestmove')) {
        let partes = message.split(' ');
        let mejorJugada = partes[1]; // Ejemplo: e2e4
        
        document.getElementById('bestMove').innerText = mejorJugada ? mejorJugada.toUpperCase() : "Ninguna";
    }
};

// Inicializamos el motor
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

    // Si la partida sigue, le pedimos la jugada a la IA localmente
    if (!game.game_over()) {
        document.getElementById('bestMove').innerText = "Calculando...";
        
        stockfish.postMessage(`position fen ${game.fen()}`);
        stockfish.postMessage('go depth 10'); // Profundidad de cálculo ajustable
    }
}

let config = {
    draggable: true,
    position: 'start',
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
