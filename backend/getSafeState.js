import { rooms } from './rooms.js';
import { logger } from './utils/logger.js';

export function getSafeState(client, roomId) {
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
    delete clientState.creatorName;
    delete clientState.controllers;

    return clientState;
  } catch (error) {
    logger.error(`Error in getSafeState for room ${roomId}:`, error);
    return null;
  }
}
