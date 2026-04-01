import { WebSocket } from 'ws';

import { wss } from './wss.js';
import { rooms } from './rooms.js';
import { getSafeState } from './getSafeState.js';
import { logger } from './utils/logger.js';

export function broadcastState(roomId) {
  const roomState = rooms.get(roomId);

  if (!roomState) return;

  wss.clients.forEach((client) => {
    try {
      if (client.readyState === WebSocket.OPEN && client.roomId === roomId) {
        const safeState = getSafeState(client, roomId);

        if (safeState) {
          client.send(
            JSON.stringify({
              type: 'state',
              payload: safeState,
            }),
          );
        }
      }
    } catch (error) {
      logger.error(`Error broadcasting to client in room ${roomId}:`, error);
    }
  });
}
