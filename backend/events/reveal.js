import { broadcastState } from '../broadcastState.js';
import { rooms } from '../rooms.js';

export function reveal(ws) {
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
}