import { rooms } from './rooms.js';

export function createRoom(roomId, creatorId = null) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, {
      participants: [],
      votesRevealed: false,
      currentVotes: {},
      roomId: roomId,
      creatorId: creatorId,
      controllers: [],
      tasks: [],
    });
  }
  return rooms.get(roomId);
}
