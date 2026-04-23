import { createdServer as server } from './backend/createdServer.js';
import { getDb } from './backend/db.js';
import { rooms } from './backend/rooms.js';
import { updateOnlineStatus } from './backend/updateOnlineStatus.js';
import { wss } from './backend/wss.js';
// events
import { join } from './backend/events/join.js';
import { vote } from './backend/events/vote.js';
import { reset } from './backend/events/reset.js';
import { reveal } from './backend/events/reveal.js';
import { setController } from './backend/events/setController.js';
import { addTask } from './backend/events/addTask.js';
import { removeTask } from './backend/events/removeTask.js';
import { updateTask } from './backend/events/updateTask.js';
import { logger } from './backend/utils/logger.js';

const PORT = process.env.PORT || 8080;

const HEARTBEAT_INTERVAL_MS = 10_000;
const heartbeat = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) {
      ws.terminate();

      return;
    }

    ws.isAlive = false;

    ws.ping();
  });
}, HEARTBEAT_INTERVAL_MS);

wss.on('close', () => clearInterval(heartbeat));

wss.on('connection', (ws) => {
  logger.info('Новое подключение WebSocket');

  ws.userId = null;
  ws.roomId = null;
  ws.isAlive = true;

  ws.on('pong', () => {
    ws.isAlive = true;
  });

  ws.on('message', async (data) => {
    try {
      const message = JSON.parse(data.toString());

      switch (message.type) {
        case 'join': {
          void join(ws, message);

          break;
        }

        case 'vote': {
          vote(ws, message);

          break;
        }

        case 'reset': {
          reset(ws);

          break;
        }

        case 'reveal': {
          reveal(ws);

          break;
        }

        case 'set_controller': {
          setController(ws, message);

          break;
        }

        case 'add_task': {
          void addTask(ws, message);

          break;
        }

        case 'remove_task': {
          void removeTask(ws, message);

          break;
        }

        case 'update_task': {
          void updateTask(ws, message);

          break;
        }
      }
    } catch (error) {
      logger.error('Ошибка обработки сообщения:', error);
    }
  });

  ws.on('close', () => {
    try {
      if (ws.roomId && ws.userId) {
        const gameState = rooms.get(ws.roomId);

        if (gameState) {
          const participant = gameState.participants.find(
            (p) => p.id === ws.userId,
          );

          if (participant) {
            participant.isOnline = false;
          }
        }
      }
      setTimeout(updateOnlineStatus, 100);
    } catch (error) {
      logger.error('Error in close handler:', error);
    }
  });
});

setInterval(updateOnlineStatus, 5000);

server.listen(PORT, async () => {
  logger.info(`Сервер запущен на порту ${PORT}`);
  logger.info(`HTTP сервер: http://localhost:${PORT}`);
  logger.info(`WebSocket сервер: ws://localhost:${PORT}`);
  logger.info(`Health check: http://localhost:${PORT}/health`);

  try {
    await getDb();

    logger.info(`MongoDB подключена: ${process.env.MONGODB_URI}`);
  } catch (err) {
    logger.error('Ошибка подключения к MongoDB:', err.message);
  }
});
