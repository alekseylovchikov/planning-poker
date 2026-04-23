import { getDb } from './db.js';
import { logger } from './utils/logger.js';

export async function getTasksByRoom(roomId) {
  try {
    const db = await getDb();

    return await db
      .collection('room_tasks')
      .find({ roomId })
      .sort({ createdAt: -1 })
      .toArray();
  } catch (err) {
    logger.error(`Ошибка получения задач комнаты ${roomId}:`, err);
    return [];
  }
}

export async function addTask(roomId, task) {
  try {
    const db = await getDb();
    const doc = {
      roomId,
      taskId: task.taskId,
      name: task.name,
      url: task.url,
      description: task.description || '',
      createdAt: new Date(),
    };

    await db.collection('room_tasks').insertOne(doc);
    return doc;
  } catch (err) {
    logger.error(`Ошибка добавления задачи в комнату ${roomId}:`, err);
    return null;
  }
}

export async function removeTask(roomId, taskId) {
  try {
    const db = await getDb();
    const result = await db
      .collection('room_tasks')
      .deleteOne({ roomId, taskId });

    return result.deletedCount > 0;
  } catch (err) {
    logger.error(`Ошибка удаления задачи ${taskId} из комнаты ${roomId}:`, err);
    return false;
  }
}

export async function updateTask(roomId, taskId, updates) {
  try {
    const db = await getDb();
    const $set = {};

    if (updates.name !== undefined) $set.name = updates.name;
    if (updates.url !== undefined) $set.url = updates.url;
    if (updates.description !== undefined) $set.description = updates.description;

    if (Object.keys($set).length === 0) return false;

    const result = await db
      .collection('room_tasks')
      .updateOne({ roomId, taskId }, { $set });

    return result.matchedCount > 0;
  } catch (err) {
    logger.error(`Ошибка обновления задачи ${taskId} в комнате ${roomId}:`, err);
    return false;
  }
}
