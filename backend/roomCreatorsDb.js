import { getDb } from './db.js';

export async function saveRoomCreator(roomId, creatorName) {
  try {
    const db = await getDb();

    await db
      .collection('room_creators')
      .updateOne(
        { roomId },
        { $set: { roomId, creatorName } },
        { upsert: true },
      );
  } catch (err) {
    console.error(`Ошибка сохранения создателя комнаты ${roomId}:`, err);
  }
}

export async function getRoomCreatorName(roomId) {
  try {
    const db = await getDb();
    const doc = await db.collection('room_creators').findOne({ roomId });

    return doc?.creatorName ?? null;
  } catch (err) {
    console.error(`Ошибка получения создателя комнаты ${roomId}:`, err);
    return null;
  }
}
