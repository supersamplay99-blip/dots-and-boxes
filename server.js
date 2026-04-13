const { createServer } = require('http');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 3000;

// Salles actives : roomCode -> [ws1, ws2]
const rooms = {};

const server = createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Dots & Boxes relay server — OK');
});

const wss = new WebSocketServer({ server });

wss.on('connection', (ws, req) => {
  // Le code de salle est dans l'URL : /nom-de-salle
  const room = decodeURIComponent(req.url.replace('/', '').split('?')[0]) || 'default';
  ws._room = room;
  ws._role = 0;

  if (!rooms[room]) rooms[room] = [];

  if (rooms[room].length >= 2) {
    ws.send(JSON.stringify({ type: 'full' }));
    ws.close();
    return;
  }

  rooms[room].push(ws);
  ws._role = rooms[room].length; // 1 ou 2

  // Informe le joueur de son rôle
  ws.send(JSON.stringify({ type: 'assign', role: ws._role, players: rooms[room].length }));

  // Si deux joueurs → démarrer la partie
  if (rooms[room].length === 2) {
    rooms[room].forEach(client => {
      client.send(JSON.stringify({ type: 'start' }));
    });
  }

  ws.on('message', (data) => {
    let msg;
    try { msg = JSON.parse(data); } catch { return; }

    if (msg.type === 'move') {
      // Relayer le coup à l'adversaire
      const opponent = rooms[room]?.find(c => c !== ws && c.readyState === 1);
      if (opponent) opponent.send(JSON.stringify(msg));
    }
  });

  ws.on('close', () => {
    // Nettoyer la salle
    if (rooms[ws._room]) {
      rooms[ws._room] = rooms[ws._room].filter(c => c !== ws);
      // Prévenir l'adversaire
      rooms[ws._room].forEach(c => {
        if (c.readyState === 1) c.send(JSON.stringify({ type: 'opponent_left' }));
      });
      if (rooms[ws._room].length === 0) delete rooms[ws._room];
    }
  });
});

server.listen(PORT, () => {
  console.log('Serveur Dots & Boxes démarré sur le port', PORT);
});
