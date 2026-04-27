import { getDb } from './db.js';
import { logger } from './utils/logger.js';

const COLLECTION = 'room_states';

function normalizeParticipant(participant) {
  if (!participant || typeof participant !== 'object') {
    return null;
  }

  if (typeof participant.id !== 'string' || typeof participant.name !== 'string') {
    return null;
  }

  return {
    id: participant.id,
    name: participant.name,
    isOnline: Boolean(participant.isOnline),
    vote: participant.vote,
    hasVoted: Boolean(participant.hasVoted),
  };
}

function normalizeTask(task) {
  if (!task || typeof task !== 'object') {
    return null;
  }

  if (
    typeof task.taskId !== 'string' ||
    typeof task.name !== 'string' ||
    typeof task.url !== 'string'
  ) {
    return null;
  }

  return {
    taskId: task.taskId,
    name: task.name,
    url: task.url,
    description: typeof task.description === 'string' ? task.description : '',
    createdAt: task.createdAt
      ? new Date(task.createdAt).toISOString()
      : new Date().toISOString(),
  };
}

export function normalizeRoomState(roomState, roomId) {
  const participants = Array.isArray(roomState?.participants)
    ? roomState.participants
      .map(normalizeParticipant)
      .filter(Boolean)
    : [];

  const tasks = Array.isArray(roomState?.tasks)
    ? roomState.tasks
      .map(normalizeTask)
      .filter(Boolean)
    : [];

  const controllers = Array.isArray(roomState?.controllers)
    ? roomState.controllers.filter((id) => typeof id === 'string')
    : [];

  const normalizedRoomId = roomId || roomState?.roomId;

  if (!normalizedRoomId || typeof normalizedRoomId !== 'string') {
    return null;
  }

  const currentVotes =
    roomState?.currentVotes && typeof roomState.currentVotes === 'object'
      ? roomState.currentVotes
      : {};

  return {
    roomId: normalizedRoomId,
    participants,
    votesRevealed: Boolean(roomState?.votesRevealed),
    currentVotes: { ...currentVotes },
    creatorId: roomState?.creatorId ?? null,
    creatorName:
      typeof roomState?.creatorName === 'string' ? roomState.creatorName : null,
    controllers,
    tasks,
  };
}

export async function loadRoomState(roomId) {
  if (!process.env.MONGODB_URI) {
    return null;
  }

  try {
    const db = await getDb();
    const doc = await db.collection(COLLECTION).findOne({ roomId });

    if (!doc) {
      return null;
    }

    const normalized = normalizeRoomState(doc.state, roomId);

    if (!normalized) {
      return null;
    }

    // После восстановления из БД все участники считаются офлайн,
    // пока не переподключатся по WebSocket.
    normalized.participants = normalized.participants.map((participant) => ({
      ...participant,
      isOnline: false,
    }));

    return normalized;
  } catch (err) {
    logger.error(`Ошибка загрузки состояния комнаты ${roomId}:`, err);
    return null;
  }
}

export async function persistRoomState(roomId, roomState) {
  if (!process.env.MONGODB_URI) {
    return false;
  }

  try {
    const normalized = normalizeRoomState(roomState, roomId);

    if (!normalized) {
      return false;
    }

    const db = await getDb();

    await db.collection(COLLECTION).updateOne(
      { roomId: normalized.roomId },
      {
        $set: {
          roomId: normalized.roomId,
          state: normalized,
          updatedAt: new Date(),
        },
      },
      { upsert: true },
    );

    return true;
  } catch (err) {
    logger.error(`Ошибка сохранения состояния комнаты ${roomId}:`, err);
    return false;
  }
}