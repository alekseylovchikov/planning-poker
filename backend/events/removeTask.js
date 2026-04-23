import { rooms } from '../rooms.js';
import { broadcastState } from '../broadcastState.js';
import { removeTask as removeTaskFromDb } from '../tasksDb.js';

export async function removeTask(ws, message) {
  if (!ws.roomId || !ws.userId) return;

  const gameState = rooms.get(ws.roomId);
  if (!gameState) return;

  if (gameState.creatorId !== ws.userId) {
    ws.send(
      JSON.stringify({
        type: 'error',
        payload: { message: 'Только создатель комнаты может удалять задачи' },
      }),
    );
    return;
  }

  const { taskId } = message.payload || {};
  if (!taskId) return;

  await removeTaskFromDb(ws.roomId, taskId);

  if (Array.isArray(gameState.tasks)) {
    gameState.tasks = gameState.tasks.filter((t) => t.taskId !== taskId);
  }

  broadcastState(ws.roomId);
}
