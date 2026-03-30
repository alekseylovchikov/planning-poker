import isEmpty from 'lodash/isEmpty.js';

import { broadcastState } from '../broadcastState.js';
import { createRoom } from '../createRoom.js';
import { generateId } from '../generateId.js';
import { getSafeState } from '../getSafeState.js';
import {
  getRoomCreatorName,
  saveRoomCreator,
} from '../roomCreatorsDb.js';
import { rooms } from '../rooms.js';
import { wss } from '../wss.js';

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

    console.log(`Создана новая комната: ${roomId}`);
  }

  let gameState = rooms.get(roomId);

  if (!gameState) {
    gameState = createRoom(roomId);

    if (requestedRoomId) {
      // Комната не найдена в памяти — восстанавливаем создателя из БД
      console.log(
        `Комната ${roomId} не найдена в памяти, восстанавливаем из БД.`,
      );
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
        if (trimmedName.toLowerCase() === gameState.creatorName.toLowerCase()) {
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
}
