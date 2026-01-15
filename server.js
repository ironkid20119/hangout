const WebSocket = require('ws');
const port = process.env.PORT || 3000;

const wss = new WebSocket.Server({ port }, () => {
    console.log(`Server started on port ${port}`);
});

let players = {};

wss.on('connection', (ws) => {
    const id = Math.random().toString(36).substr(2, 9);
    console.log(`Player ${id} joined`);

    ws.on('message', (message) => {
        const data = JSON.parse(message);
        
        if (data.type === 'move') {
            players[id] = data.position;
            // Send update to everyone ELSE
            wss.clients.forEach((client) => {
                if (client !== ws && client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify({
                        type: 'update',
                        id: id,
                        position: data.position
                    }));
                }
            });
        }
    });

    ws.on('close', () => {
        delete players[id];
        console.log(`Player ${id} left`);
    });
});
