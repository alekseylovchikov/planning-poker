import { WebSocketServer, WebSocket } from 'ws';
import http from 'http';
import { readFileSync, existsSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = process.env.PORT || 8080;

const server = http.createServer((req, res) => {
  try {
    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', service: 'planning-poker' }));
      return;
    }

    const parsedUrl = new URL(
      req.url,
      `http://${req.headers.host || 'localhost'}`,
    );
    let pathname = parsedUrl.pathname;

    let filePath = join(
      __dirname,
      'dist',
      pathname === '/' ? 'index.html' : pathname,
    );

    if (
      !existsSync(filePath) ||
      (existsSync(filePath) && statSync(filePath).isDirectory())
    ) {
      filePath = join(__dirname, 'dist', 'index.html');
    }

    if (existsSync(filePath) && !statSync(filePath).isDirectory()) {
      const ext = filePath.split('.').pop();
      const contentTypes = {
        html: 'text/html',
        js: 'application/javascript',
        css: 'text/css',
        json: 'application/json',
        png: 'image/png',
        jpg: 'image/jpeg',
        svg: 'image/svg+xml',
        ico: 'image/x-icon',
      };

      const contentType = contentTypes[ext] || 'application/octet-stream';

      try {
        const content = readFileSync(filePath);
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content);
      } catch (err) {
        console.error('Error serving file:', err);
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Internal Server Error');
      }
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
    }
  } catch (err) {
    console.error('Request handling error:', err);
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Internal Server Error');
  }
});

const wss = new WebSocketServer({ server });

const HEARTBEAT_INTERVAL_MS = 10_000;
const heartbeat = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) {
      ws.terminate();
      return;
    }
    ws.isAlive = false;
    ws.ping();
  });
}, HEARTBEAT_INTERVAL_MS);

wss.on('close', () => clearInterval(heartbeat));

const rooms = new Map();

function generateId() {
  return Math.random().toString(36).substring(2, 9);
}

function createRoom(roomId, creatorId = null) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, {
      participants: [],
      votesRevealed: false,
      currentVotes: {},
      roomId: roomId,
      creatorId: creatorId,
      controllers: [],
    });
  }
  return rooms.get(roomId);
}

function getSafeState(client, roomId) {
  const roomState = rooms.get(roomId);
  if (!roomState) return null;

  try {
    const clientState = JSON.parse(JSON.stringify(roomState));

    const isCreator = roomState.creatorId === client.userId;
    const controllers = Array.isArray(roomState.controllers)
      ? roomState.controllers
      : [];

    clientState.isCreator = isCreator;
    clientState.canControlVotes =
      isCreator || controllers.includes(client.userId);

    clientState.participants.forEach((p) => {
      p.canControlVotes =
        p.id === roomState.creatorId || controllers.includes(p.id);
    });

    if (!clientState.votesRevealed) {
      clientState.participants.forEach((p) => {
        if (p.id !== client.userId) {
          delete p.vote;
        }
      });

      const userVote = clientState.currentVotes[client.userId];
      clientState.currentVotes = {};

      if (userVote) {
        clientState.currentVotes[client.userId] = userVote;
      }
    }

    delete clientState.creatorId;
    delete clientState.controllers;

    return clientState;
  } catch (error) {
    console.error(`Error in getSafeState for room ${roomId}:`, error);
    return null;
  }
}

function broadcastState(roomId) {
  const roomState = rooms.get(roomId);
  if (!roomState) return;

  wss.clients.forEach((client) => {
    try {
      if (client.readyState === WebSocket.OPEN && client.roomId === roomId) {
        const safeState = getSafeState(client, roomId);
        if (safeState) {
          client.send(
            JSON.stringify({
              type: 'state',
              payload: safeState,
            }),
          );
        }
      }
    } catch (error) {
      console.error(`Error broadcasting to client in room ${roomId}:`, error);
    }
  });
}

function updateOnlineStatus() {
  try {
    rooms.forEach((gameState, roomId) => {
      gameState.participants.forEach((participant) => {
        participant.isOnline = false;
      });

      wss.clients.forEach((ws) => {
        if (
          ws.userId &&
          ws.roomId === roomId &&
          ws.readyState === WebSocket.OPEN
        ) {
          const participant = gameState.participants.find(
            (p) => p.id === ws.userId,
          );
          if (participant) {
            participant.isOnline = true;
          }
        }
      });

      broadcastState(roomId);
    });
  } catch (error) {
    console.error('Error in updateOnlineStatus:', error);
  }
}

wss.on('connection', (ws) => {
  console.log('Новое подключение WebSocket');
  ws.userId = null;
  ws.roomId = null;
  ws.isAlive = true;
  ws.on('pong', () => {
    ws.isAlive = true;
  });

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());

      switch (message.type) {
        case 'join': {
          const { name, roomId: requestedRoomId } = message.payload || {};

          if (!name || typeof name !== 'string' || name.trim() === '') {
            ws.send(
              JSON.stringify({
                type: 'error',
                payload: { message: 'Имя не может быть пустым' },
              }),
            );
            return;
          }

          let roomId = requestedRoomId;
          if (!roomId) {
            roomId = generateId();
            console.log(`Создана новая комната: ${roomId}`);
          }

          let gameState = rooms.get(roomId);
          if (!gameState) {
            if (requestedRoomId) {
              console.log(`Комната ${roomId} не найдена, создаем новую.`);
            }
            gameState = createRoom(roomId);
          }

          ws.roomId = roomId;
          const trimmedName = name.trim();

          const existingParticipant = gameState.participants.find(
            (p) => p.name.toLowerCase() === trimmedName.toLowerCase(),
          );

          if (existingParticipant) {
            let hadOtherConnection = false;
            wss.clients.forEach((client) => {
              if (
                client !== ws &&
                client.userId === existingParticipant.id &&
                client.roomId === roomId
              ) {
                hadOtherConnection = true;
                try {
                  client.close();
                } catch (e) {
                  console.error('Error closing old connection:', e);
                }
              }
            });

            if (hadOtherConnection) {
              console.log(
                `Переподключение участника: ${trimmedName} в комнате ${roomId}`,
              );
            }

            existingParticipant.isOnline = true;
            ws.userId = existingParticipant.id;
            broadcastState(roomId);
          } else {
            const participant = {
              id: generateId(),
              name: trimmedName,
              isOnline: true,
              vote: undefined,
              hasVoted: false,
            };

            ws.userId = participant.id;
            gameState.participants.push(participant);

            if (!gameState.creatorId) {
              gameState.creatorId = participant.id;
              console.log(
                `Пользователь ${trimmedName} стал создателем комнаты ${roomId}`,
              );
            }
          }

          try {
            const safeState = getSafeState(ws, roomId);
            if (safeState) {
              ws.send(
                JSON.stringify({
                  type: 'state',
                  payload: safeState,
                }),
              );
            }
          } catch (e) {
            console.error('Error sending initial state:', e);
          }

          broadcastState(roomId);
          break;
        }

        case 'vote': {
          if (!ws.roomId || !ws.userId) return;
          const gameState = rooms.get(ws.roomId);
          if (!gameState) return;

          const { vote } = message.payload || {};
          if (!vote) return;

          const participant = gameState.participants.find(
            (p) => p.id === ws.userId,
          );

          if (participant) {
            participant.vote = vote;
            participant.hasVoted = true;
            gameState.currentVotes[participant.id] = vote;
            broadcastState(ws.roomId);
          }
          break;
        }

        case 'reset': {
          if (!ws.roomId || !ws.userId) return;
          const gameState = rooms.get(ws.roomId);
          if (!gameState) return;

          const controllers = Array.isArray(gameState.controllers)
            ? gameState.controllers
            : [];
          const canControl =
            gameState.creatorId === ws.userId ||
            controllers.includes(ws.userId);

          if (!canControl) {
            ws.send(
              JSON.stringify({
                type: 'error',
                payload: {
                  message: 'Только создатель комнаты может сбрасывать голоса',
                },
              }),
            );
            return;
          }

          gameState.participants.forEach((participant) => {
            participant.vote = undefined;
            participant.hasVoted = false;
          });
          gameState.votesRevealed = false;
          gameState.currentVotes = {};
          broadcastState(ws.roomId);
          break;
        }

        case 'reveal': {
          if (!ws.roomId || !ws.userId) return;
          const gameState = rooms.get(ws.roomId);
          if (!gameState) return;

          const controllers = Array.isArray(gameState.controllers)
            ? gameState.controllers
            : [];
          const canControl =
            gameState.creatorId === ws.userId ||
            controllers.includes(ws.userId);

          if (!canControl) {
            ws.send(
              JSON.stringify({
                type: 'error',
                payload: {
                  message: 'Только создатель комнаты может открывать карты',
                },
              }),
            );
            return;
          }

          gameState.votesRevealed = true;
          broadcastState(ws.roomId);
          break;
        }

        case 'set_controller': {
          if (!ws.roomId || !ws.userId) return;
          const gameState = rooms.get(ws.roomId);
          if (!gameState) return;

          if (gameState.creatorId !== ws.userId) {
            ws.send(
              JSON.stringify({
                type: 'error',
                payload: {
                  message:
                    'Только создатель комнаты может изменять права на открытие и сброс карт',
                },
              }),
            );
            return;
          }

          const { participantId, canControl } = message.payload || {};
          if (!participantId) return;

          const participantExists = gameState.participants.some(
            (p) => p.id === participantId,
          );
          if (!participantExists) return;

          if (!Array.isArray(gameState.controllers)) {
            gameState.controllers = [];
          }

          const index = gameState.controllers.indexOf(participantId);
          if (canControl) {
            if (index === -1) {
              gameState.controllers.push(participantId);
            }
          } else if (index !== -1) {
            gameState.controllers.splice(index, 1);
          }

          broadcastState(ws.roomId);
          break;
        }
      }
    } catch (error) {
      console.error('Ошибка обработки сообщения:', error);
    }
  });

  ws.on('close', () => {
    try {
      if (ws.roomId && ws.userId) {
        const gameState = rooms.get(ws.roomId);
        if (gameState) {
          const participant = gameState.participants.find(
            (p) => p.id === ws.userId,
          );
          if (participant) {
            participant.isOnline = false;
          }
        }
      }
      setTimeout(updateOnlineStatus, 100);
    } catch (error) {
      console.error('Error in close handler:', error);
    }
  });
});

setInterval(updateOnlineStatus, 5000);

server.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
  console.log(`HTTP сервер: http://localhost:${PORT}`);
  console.log(`WebSocket сервер: ws://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});
