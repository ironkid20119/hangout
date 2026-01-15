function handleServerMessage(data) {
    switch(data.type) {
        case 'playerJoined':
            // Only create player if they have a valid username
            if (data.id !== 'local' && data.username && !players[data.id]) {
                players[data.id] = createPlayer(data.id, data.username, data.color);
                if (data.position) {
                    players[data.id].mesh.position.copy(data.position);
                }
                addChatMessage(`${data.username} joined the hangout`, 'system');
                updatePlayerCount();
            }
            break;
            
        case 'playerLeft':
            if (players[data.id]) {
                scene.remove(players[data.id].mesh);
                addChatMessage(`${players[data.id].name} left the hangout`, 'system');
                delete players[data.id];
                updatePlayerCount();
            }
            break;
            
        case 'playerMove':
            if (players[data.id] && data.position) {
                players[data.id].mesh.position.copy(data.position);
            }
            break;
            
        case 'chat':
            if (data.username) {
                addChatMessage(`${data.username}: ${data.message}`);
            }
            break;
            
        case 'players':
            // Only create players that have joined
            data.players.forEach(player => {
                if (player.id !== 'local' && player.username && !players[player.id]) {
                    players[player.id] = createPlayer(player.id, player.username, player.color);
                    if (player.position) {
                        players[player.id].mesh.position.copy(player.position);
                    }
                }
            });
            updatePlayerCount();
            break;
            
        case 'damage':
            // Handle incoming damage
            takeDamage(data.damage);
            addChatMessage(`Hit by ${players[data.from]?.name || 'another player'}!`, 'system');
            break;
    }
}
