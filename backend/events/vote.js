import { rooms } from '../rooms.js';
import { broadcastState } from '../broadcastState.js';

// Security: Validate vote value
const VALID_VOTES = ['0.5', '1', '2', '3', '5', '8', '13', '???'];

export function vote(ws, message) {
  // Security: Check both userId and sessionToken for authorization
  if (!ws.roomId || !ws.userId || !ws.sessionToken) {
    return;
  }

  const gameState = rooms.get(ws.roomId);

  if (!gameState) {
    return;
  }

  const { vote } = message.payload || {};

  if (!vote || !VALID_VOTES.includes(String(vote))) {
    return;
  }

  const participant = gameState.participants.find((p) => p.id === ws.userId);

  if (!participant) {
    return;
  }

  // Security: Verify session token matches
  if (participant.sessionToken !== ws.sessionToken) {
    return;
  }

  participant.vote = vote;
  participant.hasVoted = true;
  gameState.currentVotes[participant.id] = vote;

  broadcastState(ws.roomId);
}
