import isEmpty from 'lodash/isEmpty.js';

import { broadcastState } from '../broadcastState.js';
import { createRoom } from '../createRoom.js';
import { generateId, generateSessionToken } from '../generateId.js';
import { getSafeState } from '../getSafeState.js';
import { getRoomCreatorName, saveRoomCreator } from '../roomCreatorsDb.js';
import { getTasksByRoom } from '../tasksDb.js';
import { rooms } from '../rooms.js';
import { wss } from '../wss.js';
import { logger } from '../utils/logger.js';

export async function join(ws, message) {
  const { name, roomId: requestedRoomId, sessionToken } = message.payload || {};

  if (
    requestedRoomId &&
    typeof requestedRoomId === 'string' &&
    requestedRoomId.length > 8
  ) {
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

    logger.info(`Создана новая комната: ${roomId}`);
  }

  let gameState = rooms.get(roomId);

  if (!gameState) {
    gameState = createRoom(roomId);

    if (requestedRoomId) {
      logger.info(
        `Комната ${roomId} не найдена в памяти, восстанавливаем из БД.`,
      );

      const [storedCreatorName, storedTasks] = await Promise.all([
        getRoomCreatorName(roomId),
        getTasksByRoom(roomId),
      ]);

      if (storedCreatorName) {
        gameState.creatorName = storedCreatorName;
      }

      if (storedTasks.length > 0) {
        gameState.tasks = storedTasks.map((t) => ({
          taskId: t.taskId,
          name: t.name,
          url: t.url,
          description: t.description || '',
          createdAt: t.createdAt
            ? t.createdAt.toISOString()
            : new Date().toISOString(),
        }));
      }
    }
  }

  ws.roomId = roomId;
  const trimmedName = name.trim();

  // Security: Check if user is reconnecting with a valid session token
  let participantId = null;
  let newToken = null;

  if (sessionToken && typeof sessionToken === 'string') {
    // Try to find existing participant with this token
    const existingParticipant = gameState.participants.find(
      (p) => p.sessionToken === sessionToken,
    );

    if (existingParticipant) {
      // Valid reconnection - reuse existing participant
      participantId = existingParticipant.id;
      newToken = sessionToken;

      // Close old connection if exists
      let hadOtherConnection = false;

      wss.clients.forEach((client) => {
        if (
          client !== ws &&
          client.userId === participantId &&
          client.roomId === roomId
        ) {
          hadOtherConnection = true;

          try {
            client.close();
          } catch (e) {
            logger.error('Error closing old connection:', e);
          }
        }
      });

      if (hadOtherConnection) {
        logger.info(
          `Переподключение участника: ${trimmedName} в комнате ${roomId}`,
        );
      }

      existingParticipant.isOnline = true;
    }
  }

  // If no valid reconnection, create a new participant
  if (!participantId) {
    const newId = generateId();
    newToken = generateSessionToken();

    const participant = {
      id: newId,
      name: trimmedName,
      sessionToken: newToken, // Security: Cryptographic token for session auth
      isOnline: true,
      vote: undefined,
      hasVoted: false,
    };

    participantId = newId;
    gameState.participants.push(participant);

    if (!gameState.creatorId) {
      // If stored creator name exists and matches - assign creator to them
      if (gameState.creatorName) {
        if (trimmedName.toLowerCase() === gameState.creatorName.toLowerCase()) {
          gameState.creatorId = participantId;
          logger.info(
            `Создатель комнаты ${roomId} восстановлен: ${trimmedName}`,
          );
        }
      } else {
        // New room - first participant becomes creator
        gameState.creatorId = participantId;
        gameState.creatorName = trimmedName;

        await saveRoomCreator(roomId, trimmedName);

        logger.info(
          `Пользователь ${trimmedName} стал создателем комнаты ${roomId}`,
        );
      }
    }
  }

  // Set WebSocket connection properties
  ws.userId = participantId;
  ws.sessionToken = newToken;

  try {
    const safeState = getSafeState(ws, roomId);

    if (safeState) {
      // Send state with session token so client can store it
      ws.send(
        JSON.stringify({
          type: 'state',
          payload: {
            ...safeState,
            sessionToken: newToken, // Send token to client for storage
          },
        }),
      );
    }
  } catch (e) {
    logger.error('Error sending initial state:', e);
  }

  broadcastState(roomId);
}
