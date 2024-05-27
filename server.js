const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static(path.join(__dirname)));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'client.html'));
});

let gameState = {
    board: Array(10).fill().map(() => Array(10).fill(null)),
    currentPlayer: 'pink',
    scores: {
        pink: 0,
        purple: 0
    }
};

const initializeBoard = () => {
    gameState.board = Array(10).fill().map(() => Array(10).fill(null));
    for (let row = 0; row < 10; row++) {
        for (let col = 0; col < 10; col++) {
            if ((row + col) % 2 === 0) {
                if (row < 4) {
                    gameState.board[row][col] = 'pink';
                } else if (row > 5) {
                    gameState.board[row][col] = 'purple';
                }
            }
        }
    }
    gameState.currentPlayer = 'pink';
    gameState.scores = { pink: 0, purple: 0 };
};

const checkEndGame = () => {
    let pinkCount = 0;
    let purpleCount = 0;
    gameState.board.forEach(row => {
        row.forEach(cell => {
            if (cell === 'pink') pinkCount++;
            if (cell === 'purple') purpleCount++;
        });
    });

    if (pinkCount === 0) {
        io.emit('gameEnd', { winner: 'purple', loser: 'pink' });
        return true;
    } else if (purpleCount === 0) {
        io.emit('gameEnd', { winner: 'pink', loser: 'purple' });
        return true;
    }
    return false;
};

initializeBoard();

let players = [];

io.on('connection', (socket) => {
    console.log('Nuovo client connesso:', socket.id);

    socket.on('chooseColor', (color) => {
        if (players.length < 2) {
            players.push({ id: socket.id, color: color });
            socket.emit('yourTurn', color);
            if (players.length === 1) {
                socket.emit('waitingForOpponent');
            } else {
                io.emit('gameStart');
                io.emit('gameState', gameState);
            }
        } else {
            socket.emit('message', 'Il gioco è pieno.');
            socket.disconnect();
        }
    });

    socket.on('disconnect', () => {
        console.log('Client disconnesso:', socket.id);
        players = players.filter(player => player.id !== socket.id);

        if (players.length < 2) {
            initializeBoard();
            io.emit('gameState', gameState);
        }
    });

    socket.on('move', (move) => {
        const currentPlayer = gameState.currentPlayer;
        const player = players.find(player => player.id === socket.id);

        if (!player || player.color !== currentPlayer) return;

        const { from, to } = move;
        const piece = gameState.board[from.row][from.col];

        // Verifica la direzione del movimento
        const isValidMove = (piece === 'pink' && to.row > from.row) || 
                            (piece === 'purple' && to.row < from.row);

        if (piece && isValidMove && (to.row + to.col) % 2 === 0 && !gameState.board[to.row][to.col]) {
            const middleRow = (from.row + to.row) / 2;
            const middleCol = (from.col + to.col) / 2;

            if (Math.abs(from.row - to.row) === 2 && Math.abs(from.col - to.col) === 2 &&
                gameState.board[middleRow][middleCol] &&
                gameState.board[middleRow][middleCol] !== piece) {

                gameState.board[middleRow][middleCol] = null;
                gameState.scores[currentPlayer]++;
            }

            gameState.board[from.row][from.col] = null;
            gameState.board[to.row][to.col] = piece;

            gameState.currentPlayer = currentPlayer === 'pink' ? 'purple' : 'pink';

            io.emit('gameState', gameState);

            if (checkEndGame()) {
                return;
            }
        }
    });

    socket.on('resetGame', () => {
        initializeBoard();
        io.emit('gameState', gameState);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server in ascolto sulla porta ${PORT}`);
});
