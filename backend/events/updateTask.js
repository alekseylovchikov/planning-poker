import { rooms } from '../rooms.js';
import { broadcastState } from '../broadcastState.js';
import { updateTask as updateTaskInDb } from '../tasksDb.js';
import { persistRoomState } from '../roomStateDb.js';

export async function updateTask(ws, message) {
  if (!ws.roomId || !ws.userId) return;

  const gameState = rooms.get(ws.roomId);
  if (!gameState) return;

  if (gameState.creatorId !== ws.userId) {
    ws.send(
      JSON.stringify({
        type: 'error',
        payload: {
          message: 'Только создатель комнаты может редактировать задачи',
        },
      }),
    );
    return;
  }

  const { taskId, name, url, description } = message.payload || {};
  if (!taskId) return;

  const updates = {};
  if (name !== undefined) updates.name = name.trim();
  if (url !== undefined) updates.url = url.trim();
  if (description !== undefined) updates.description = description.trim();

  if (Object.keys(updates).length === 0) return;

  await updateTaskInDb(ws.roomId, taskId, updates);

  if (Array.isArray(gameState.tasks)) {
    const task = gameState.tasks.find((t) => t.taskId === taskId);
    if (task) {
      Object.assign(task, updates);
    }
  }

  await persistRoomState(ws.roomId, gameState);
  broadcastState(ws.roomId);
}
