import { broadcastState } from '../broadcastState.js';
import { rooms } from '../rooms.js';

export function setController(ws, message) {
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
}
