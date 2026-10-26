let board = null;
let game = new Chess();
let lastBestMove = null;

// Función que consulta al Stockfish real y súper inteligente en la nube
async function pedirSugerenciaStockfish(fen) {
    document.getElementById('bestMove').innerText = "Calculando (Stockfish Pro)...";
    lastBestMove = null;

    try {
        // Consultamos a profundidad 12 para una jugada ultra precisa de gran ELO
        const response = await fetch(`https://stockfish.online/api/s/v2.php?fen=${encodeURIComponent(fen)}&depth=12`);
        const data = await response.json();

        if (data.success && data.bestmove) {
            // Extraemos la jugada exacta (ej: e2e4)
            const partes = data.bestmove.split(' ');
            lastBestMove = partes[1] ? partes[1] : partes[0];
            
            document.getElementById('bestMove').innerText = lastBestMove.toUpperCase();
        } else {
            document.getElementById('bestMove').innerText = "Error en la IA";
        }
    } catch (error) {
        document.getElementById('bestMove').innerText = "Sin conexión a internet";
    }
}

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

    // Si la partida sigue activa, le pedimos la jugada a la súper IA
    if (!game.game_over()) {
        pedirSugerenciaStockfish(game.fen());
    }
}

// Configuración con las imágenes de las piezas arregladas
let config = {
    draggable: true,
    position: 'start',
    pieceTheme: function(piece) {
        return 'https://cdnjs.cloudflare.com/ajax/libs/chessboard-js/1.0.0/img/chesspieces/wikipedia/' + piece + '.png';
    },
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

// Botón para que Stockfish mueva automáticamente por ti en tu tablero
document.getElementById('autoMoveBtn').addEventListener('click', () => {
    if (!lastBestMove) {
        alert("Espera a que la super IA termine de calcular.");
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
        alert("No se pudo aplicar el movimiento.");
    }
});
