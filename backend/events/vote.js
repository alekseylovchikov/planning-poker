import { rooms } from '../rooms.js';
import { broadcastState } from '../broadcastState.js';
import { persistRoomState } from '../roomStateDb.js';

export function vote(ws, message) {
  if (!ws.roomId || !ws.userId) return;

  const gameState = rooms.get(ws.roomId);

  if (!gameState) return;

  const { vote } = message.payload || {};

  if (!vote) return;

  const participant = gameState.participants.find((p) => p.id === ws.userId);

  if (participant) {
    participant.vote = vote;
    participant.hasVoted = true;
    gameState.currentVotes[participant.id] = vote;

    void persistRoomState(ws.roomId, gameState);
    broadcastState(ws.roomId);
  }
}
