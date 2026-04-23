import isEmpty from 'lodash/isEmpty.js';

import { broadcastState } from '../broadcastState.js';
import { createRoom } from '../createRoom.js';
import { generateId } from '../generateId.js';
import { getSafeState } from '../getSafeState.js';
import {
  getRoomCreatorName,
  saveRoomCreator,
} from '../roomCreatorsDb.js';
import { getTasksByRoom } from '../tasksDb.js';
import { rooms } from '../rooms.js';
import { wss } from '../wss.js';
import { logger } from '../utils/logger.js';

export async function join(ws, message) {
  const { name, roomId: requestedRoomId } = message.payload || {};

  if (
    requestedRoomId &&
    typeof requestedRoomId === 'string' &&
    requestedRoomId.length > 7
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
          createdAt: t.createdAt ? t.createdAt.toISOString() : new Date().toISOString(),
        }));
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
        if (trimmedName.toLowerCase() === gameState.creatorName.toLowerCase()) {
          gameState.creatorId = participant.id;
          logger.info(
            `Создатель комнаты ${roomId} восстановлен: ${trimmedName}`,
          );
        }
      } else {
        // Новая комната — первый участник становится создателем и сохраняется в БД
        gameState.creatorId = participant.id;
        gameState.creatorName = trimmedName;

        await saveRoomCreator(roomId, trimmedName);

        logger.info(
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
    logger.error('Error sending initial state:', e);
  }

  broadcastState(roomId);
}
