import { rooms } from '../rooms.js';
import { broadcastState } from '../broadcastState.js';
import { addTask as addTaskToDb } from '../tasksDb.js';
import { generateId } from '../generateId.js';

export async function addTask(ws, message) {
  if (!ws.roomId || !ws.userId) return;

  const gameState = rooms.get(ws.roomId);
  if (!gameState) return;

  if (gameState.creatorId !== ws.userId) {
    ws.send(
      JSON.stringify({
        type: 'error',
        payload: { message: 'Только создатель комнаты может добавлять задачи' },
      }),
    );
    return;
  }

  const { name, url, description } = message.payload || {};

  if (!name || !name.trim()) {
    ws.send(
      JSON.stringify({
        type: 'error',
        payload: { message: 'Название задачи не может быть пустым' },
      }),
    );
    return;
  }

  if (!url || !url.trim()) {
    ws.send(
      JSON.stringify({
        type: 'error',
        payload: { message: 'Ссылка на задачу не может быть пустой' },
      }),
    );
    return;
  }

  const task = {
    taskId: generateId(),
    name: name.trim(),
    url: url.trim(),
    description: (description || '').trim(),
    createdAt: new Date().toISOString(),
  };

  await addTaskToDb(ws.roomId, task);

  if (!Array.isArray(gameState.tasks)) {
    gameState.tasks = [];
  }

  gameState.tasks.push(task);
  broadcastState(ws.roomId);
}
