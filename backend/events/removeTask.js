import { rooms } from '../rooms.js';
import { broadcastState } from '../broadcastState.js';
import { removeTask as removeTaskFromDb } from '../tasksDb.js';

export async function removeTask(ws, message) {
  // Security: Validate session token for authorization
  if (!ws.roomId || !ws.userId || !ws.sessionToken) return;

  const gameState = rooms.get(ws.roomId);
  if (!gameState) return;

  // Verify session token matches stored token
  const participant = gameState.participants.find((p) => p.id === ws.userId);
  if (!participant || participant.sessionToken !== ws.sessionToken) return;

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
