import isEmpty from 'lodash/isEmpty.js';

import { createdServer as server } from './backend/createdServer.js';
import { createRoom } from './backend/createRoom.js';
import { getSafeState } from './backend/getSafeState.js';
import { wss } from './backend/wss.js';
import { updateOnlineStatus } from './backend/updateOnlineStatus.js';
import { rooms } from './backend/rooms.js';
import { broadcastState } from './backend/broadcastState.js';
import { generateId } from './backend/generateId.js';
import {
  saveRoomCreator,
  getRoomCreatorName,
} from './backend/roomCreatorsDb.js';
import { getDb } from './backend/db.js';

const PORT = process.env.PORT || 8080;

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

          if (requestedRoomId && typeof requestedRoomId === "string" && requestedRoomId.length > 7) {
            ws.send(
              JSON.stringify({
                type: 'error',
                payload: { message: 'Не валидный формат roomId' },
              }),
            );
            return;
          }

          if (isEmpty(name.trim())) {
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
            gameState = createRoom(roomId);

            if (requestedRoomId) {
              // Комната не найдена в памяти — восстанавливаем создателя из БД
              console.log(`Комната ${roomId} не найдена в памяти, восстанавливаем из БД.`);
              const storedCreatorName = await getRoomCreatorName(roomId);
              if (storedCreatorName) {
                gameState.creatorName = storedCreatorName;
              }
            }
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
              // Если в БД есть сохранённый создатель — назначаем только если имя совпадает
              if (gameState.creatorName) {
                if (
                  trimmedName.toLowerCase() ===
                  gameState.creatorName.toLowerCase()
                ) {
                  gameState.creatorId = participant.id;
                  console.log(
                    `Создатель комнаты ${roomId} восстановлен: ${trimmedName}`,
                  );
                }
              } else {
                // Новая комната — первый участник становится создателем и сохраняется в БД
                gameState.creatorId = participant.id;
                gameState.creatorName = trimmedName;

                await saveRoomCreator(roomId, trimmedName);

                console.log(
                  `Пользователь ${trimmedName} стал создателем комнаты ${roomId}`,
                );
              }
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

server.listen(PORT, async () => {
  console.log(`Сервер запущен на порту ${PORT}`);
  console.log(`HTTP сервер: http://localhost:${PORT}`);
  console.log(`WebSocket сервер: ws://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);

  try {
    await getDb();
    console.log(`MongoDB подключена: ${process.env.MONGODB_URI}`);
  } catch (err) {
    console.error('Ошибка подключения к MongoDB:', err.message);
  }
});
