const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

// 1. Create the HTTP Server (Serves the index.html file)
const server = http.createServer((req, res) => {
    // Serve index.html for the root path
    if (req.url === '/' || req.url === '/index.html') {
        fs.readFile(path.join(__dirname, 'index.html'), (err, data) => {
            if (err) {
                res.writeHead(500);
                res.end('Error loading index.html');
            } else {
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end(data);
            }
        });
    } else {
        res.writeHead(404);
        res.end('Not Found');
    }
});

// 2. Create the WebSocket Server
const wss = new WebSocket.Server({ server });

// Store players: { id: { x, y, z, color, username } }
let players = {};

wss.on('connection', (ws) => {
    // Generate a temporary ID
    const id = Math.random().toString(36).substring(7);
    ws.id = id;

    // Send existing players to the new joiner
    const playerList = Object.keys(players).map(k => ({
        id: k,
        ...players[k]
    }));
    ws.send(JSON.stringify({ type: 'players', players: playerList }));

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);

            switch (data.type) {
                case 'join':
                    // Save player data
                    players[id] = {
                        username: data.username,
                        color: data.color,
                        position: data.position
                    };
                    // Broadcast new player to everyone else
                    broadcast({
                        type: 'playerJoined',
                        id: id,
                        username: data.username,
                        color: data.color,
                        position: data.position
                    }, ws);
                    break;

                case 'move':
                    if (players[id]) {
                        players[id].position = data.position;
                        // Broadcast movement (exclude sender for performance if needed, but simple is ok)
                        broadcast({
                            type: 'playerMove',
                            id: id,
                            position: data.position
                        }, ws);
                    }
                    break;

                case 'chat':
                    broadcast({
                        type: 'chat',
                        username: players[id]?.username || 'Anon',
                        message: data.message
                    });
                    break;

                case 'damage':
                    // Relay damage to specific target
                    if (data.targetId) {
                        broadcast({
                            type: 'damage',
                            targetId: data.targetId,
                            damage: data.damage,
                            from: id
                        });
                    }
                    break;
            }
        } catch (e) {
            console.error('Error processing message:', e);
        }
    });

    ws.on('close', () => {
        if (players[id]) {
            delete players[id];
            broadcast({ type: 'playerLeft', id: id });
        }
    });
});

function broadcast(data, excludeWs) {
    wss.clients.forEach(client => {
        if (client !== excludeWs && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(data));
        }
    });
}

// 3. Listen on the Port provided by Render
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});
