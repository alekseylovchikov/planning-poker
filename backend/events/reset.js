import { rooms } from '../rooms.js';
import { broadcastState } from '../broadcastState.js';

export function reset(ws)  {
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
}
