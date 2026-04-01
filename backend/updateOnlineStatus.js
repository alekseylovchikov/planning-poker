import { WebSocket } from 'ws';

import { rooms } from './rooms.js';
import { wss } from './wss.js';
import { broadcastState } from './broadcastState.js';
import { logger } from './utils/logger.js';

export function updateOnlineStatus() {
  try {
    rooms.forEach((gameState, roomId) => {
      gameState.participants.forEach((participant) => {
        participant.isOnline = false;
      });

      wss.clients.forEach((ws) => {
        if (
          ws.userId &&
          ws.roomId === roomId &&
          ws.readyState === WebSocket.OPEN
        ) {
          const participant = gameState.participants.find(
            (p) => p.id === ws.userId,
          );

          if (participant) participant.isOnline = true;
        }
      });

      broadcastState(roomId);
    });
  } catch (error) {
    logger.error('Error in updateOnlineStatus:', error);
  }
}
