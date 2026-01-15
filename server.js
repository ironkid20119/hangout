const WebSocket = require('ws');
const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;

// Create HTTP server
const server = http.createServer((req, res) => {
  // Parse URL
  const parsedUrl = url.parse(req.url);
  let pathname = parsedUrl.pathname;
  
  // Default to index.html
  if (pathname === '/') {
    pathname = '/index.html';
  }
  
  // Get file extension
  const ext = path.parse(pathname).ext;
  
  // Map file extensions to MIME types
  const map = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json'
  };

  // Read file
  fs.readFile(__dirname + pathname, (err, data) => {
    if (err) {
      // If file not found, serve index.html
      if (pathname !== '/index.html') {
        res.writeHead(302, { 'Location': '/' });
        res.end();
        return;
      }
      
      res.writeHead(500);
      res.end(`Error loading ${pathname}`);
    } else {
      // Set content type
      const contentType = map[ext] || 'text/plain';
      res.writeHead(200, { 
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*'
      });
      res.end(data);
    }
  });
});

// Create WebSocket server attached to HTTP server
const wss = new WebSocket.Server({ server });

let players = {};
let nextPlayerId = 1;

wss.on('connection', (ws, req) => {
  const playerId = nextPlayerId++;
  console.log(`Player ${playerId} connected from ${req.socket.remoteAddress}`);
  
  // Send existing players to new player
  const existingPlayers = Object.keys(players).map(id => ({
    id: id,
    username: players[id].username,
    color: players[id].color,
    position: players[id].position
  }));
  
  ws.send(JSON.stringify({
    type: 'players',
    players: existingPlayers
  }));
  
  // Add to players list temporarily
  players[playerId] = {
    ws: ws,
    username: 'Guest' + playerId,
    color: 0x00ff00,
    position: { x: 0, y: 1, z: 0 }
  };
  
  // Broadcast new player to others
  broadcast({
    type: 'playerJoined',
    id: playerId,
    username: players[playerId].username,
    color: players[playerId].color,
    position: players[playerId].position
  }, ws);
  
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      
      switch(data.type) {
        case 'join':
          players[playerId].username = data.username.substring(0, 15);
          players[playerId].color = data.color || 0x00ff00;
          players[playerId].position = data.position || { x: 0, y: 1, z: 0 };
          
          broadcast({
            type: 'playerJoined',
            id: playerId,
            username: players[playerId].username,
            color: players[playerId].color,
            position: players[playerId].position
          }, ws);
          break;
          
        case 'move':
          if (players[playerId]) {
            players[playerId].position = data.position;
            
            broadcast({
              type: 'playerMove',
              id: playerId,
              position: data.position
            }, ws);
          }
          break;
          
        case 'chat':
          broadcast({
            type: 'chat',
            id: playerId,
            username: players[playerId].username,
            message: data.message.substring(0, 100)
          });
          break;
          
        case 'damage':
          // Forward damage to target player (for future implementation)
          if (players[data.targetId] && players[data.targetId].ws) {
            players[data.targetId].ws.send(JSON.stringify({
              type: 'damage',
              damage: data.damage,
              from: playerId
            }));
          }
          break;
      }
    } catch (err) {
      console.error('Error parsing message:', err);
    }
  });
  
  ws.on('close', () => {
    console.log(`Player ${playerId} disconnected`);
    
    if (players[playerId]) {
      broadcast({
        type: 'playerLeft',
        id: playerId,
        username: players[playerId].username
      });
      delete players[playerId];
    }
  });
  
  ws.on('error', (err) => {
    console.error(`WebSocket error for player ${playerId}:`, err);
  });
});

function broadcast(data, excludeWs = null) {
  const message = JSON.stringify(data);
  wss.clients.forEach((client) => {
    if (client !== excludeWs && client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`HTTP: http://localhost:${PORT}`);
  console.log(`WebSocket: ws://localhost:${PORT}`);
});
