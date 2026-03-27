import 'dotenv/config';
import { WebSocketServer, WebSocket } from 'ws';
import http from 'http';
import { readFileSync, existsSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { MongoClient } from 'mongodb';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = process.env.PORT || 8080;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const DB_NAME = 'planning_poker';

// --- MongoDB ---

let roomsCol = null;

async function connectMongo() {
  try {
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    const mongoDb = client.db(DB_NAME);
    roomsCol = mongoDb.collection('rooms');
    await roomsCol.createIndex({ roomId: 1 }, { unique: true });
    console.log('MongoDB подключен');
  } catch (err) {
    console.error('MongoDB не подключен, продолжаем без персистентности:', err.message);
  }
}

async function dbGetRoom(roomId) {
  if (!roomsCol) return null;
  try {
    return await roomsCol.findOne({ roomId });
  } catch (err) {
    console.error('dbGetRoom error:', err.message);
    return null;
  }
}

async function dbSaveRoom(roomId, creatorName, controllerNames = []) {
  if (!roomsCol) return;
  try {
    await roomsCol.updateOne(
      { roomId },
      { $set: { creatorName, controllerNames } },
      { upsert: true },
    );
  } catch (err) {
    console.error('dbSaveRoom error:', err.message);
  }
}

async function dbUpdateControllers(roomId, controllerNames) {
  if (!roomsCol) return;
  try {
    await roomsCol.updateOne({ roomId }, { $set: { controllerNames } });
  } catch (err) {
    console.error('dbUpdateControllers error:', err.message);
  }
}

// --- HTTP ---

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

// Восстанавливает admin/controller статус участника по имени из БД
function applyDbAdminData(gameState, dbData, participant) {
  if (!dbData) return;

  if (
    dbData.creatorName &&
    participant.name.toLowerCase() === dbData.creatorName.toLowerCase()
  ) {
    if (!gameState.creatorId) {
      gameState.creatorId = participant.id;
      console.log(
        `Восстановлен создатель комнаты ${gameState.roomId}: ${participant.name}`,
      );
    }
  }

  if (
    Array.isArray(dbData.controllerNames) &&
    dbData.controllerNames.some(
      (n) => n.toLowerCase() === participant.name.toLowerCase(),
    )
  ) {
    if (!gameState.controllers.includes(participant.id)) {
      gameState.controllers.push(participant.id);
    }
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

  ws.on('message', async (data) => {
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

          // Загружаем данные об админе из БД один раз для этой комнаты
          const dbData = await dbGetRoom(roomId);

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

            // Восстанавливаем права если они не были установлены в памяти
            applyDbAdminData(gameState, dbData, existingParticipant);

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

            // Восстанавливаем права по имени из БД
            applyDbAdminData(gameState, dbData, participant);

            // Назначаем создателем только если нет записи в БД (новая комната)
            if (!gameState.creatorId && (!dbData || !dbData.creatorName)) {
              gameState.creatorId = participant.id;
              console.log(
                `Пользователь ${trimmedName} стал создателем комнаты ${roomId}`,
              );
              await dbSaveRoom(roomId, trimmedName, []);
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

          // Сохраняем актуальный список контроллеров по именам в БД
          const controllerNames = gameState.controllers
            .map((id) => gameState.participants.find((p) => p.id === id)?.name)
            .filter(Boolean);
          const creatorParticipant = gameState.participants.find(
            (p) => p.id === gameState.creatorId,
          );
          await dbSaveRoom(
            ws.roomId,
            creatorParticipant?.name ?? null,
            controllerNames,
          );

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

// Запускаем сервер после подключения к MongoDB
connectMongo().then(() => {
  server.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
    console.log(`HTTP сервер: http://localhost:${PORT}`);
    console.log(`WebSocket сервер: ws://localhost:${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/health`);
  });
});
