import { describe, it, expect, beforeEach, vi } from 'vitest';
import { rooms } from '../rooms.js';

vi.mock('../broadcastState.js', () => ({
  broadcastState: vi.fn(),
}));

vi.mock('../getSafeState.js', () => ({
  getSafeState: vi.fn(() => ({ mocked: true })),
}));

vi.mock('../generateId.js', () => {
  let counter = 0;
  let tokenCounter = 0;
  return {
    generateId: vi.fn(() => `id${++counter}`),
    generateSessionToken: vi.fn(() => `token${++tokenCounter}`),
  };
});

vi.mock('../roomCreatorsDb.js', () => ({
  getRoomCreatorName: vi.fn(() => null),
  saveRoomCreator: vi.fn(),
}));

vi.mock('../wss.js', () => ({
  wss: { clients: new Set() },
}));

import { join } from './join.js';
import { broadcastState } from '../broadcastState.js';
import { getSafeState } from '../getSafeState.js';
import { generateId, generateSessionToken } from '../generateId.js';
import { getRoomCreatorName, saveRoomCreator } from '../roomCreatorsDb.js';
import { wss } from '../wss.js';

function makeWs() {
  return { roomId: null, userId: null, send: vi.fn() };
}

describe('join', () => {
  beforeEach(() => {
    rooms.clear();
    wss.clients.clear();
    vi.mocked(generateId).mockImplementation(() => {
      return Math.random().toString(36).substring(2, 9);
    });
  });

  it('отклоняет roomId длиной > 8', async () => {
    const ws = makeWs();

    await join(ws, { payload: { name: 'Alice', roomId: '123456789' } });

    const sent = JSON.parse(ws.send.mock.calls[0][0]);
    expect(sent.type).toBe('error');
    expect(sent.payload.message).toContain('roomId');
    expect(broadcastState).not.toHaveBeenCalled();
  });

  it('отклоняет пустое имя', async () => {
    const ws = makeWs();

    await join(ws, { payload: { name: '   ' } });

    const sent = JSON.parse(ws.send.mock.calls[0][0]);
    expect(sent.type).toBe('error');
    expect(sent.payload.message).toContain('Имя');
  });

  it('создаёт новую комнату, если roomId не указан', async () => {
    vi.mocked(generateId).mockReturnValueOnce('newroom');
    const ws = makeWs();

    await join(ws, { payload: { name: 'Alice' } });

    expect(rooms.has('newroom')).toBe(true);
    expect(ws.roomId).toBe('newroom');
    expect(ws.userId).toBeDefined();

    const state = rooms.get('newroom');
    expect(state.participants).toHaveLength(1);
    expect(state.participants[0].name).toBe('Alice');
    expect(state.creatorId).toBe(ws.userId);
  });

  it('первый участник становится создателем и сохраняется в БД', async () => {
    vi.mocked(generateId)
      .mockReturnValueOnce('room1')
      .mockReturnValueOnce('user1');
    const ws = makeWs();

    await join(ws, { payload: { name: 'Alice' } });

    expect(saveRoomCreator).toHaveBeenCalledWith('room1', 'Alice');
    expect(rooms.get('room1').creatorId).toBe('user1');
  });

  it('входит в существующую комнату без перезаписи состояния', async () => {
    rooms.set('room1', {
      participants: [
        { id: 'u1', name: 'Alice', isOnline: true, hasVoted: false },
      ],
      votesRevealed: false,
      currentVotes: {},
      roomId: 'room1',
      creatorId: 'u1',
      controllers: [],
    });
    const ws = makeWs();

    await join(ws, { payload: { name: 'Bob', roomId: 'room1' } });

    const state = rooms.get('room1');
    expect(state.participants).toHaveLength(2);
    expect(state.participants[1].name).toBe('Bob');
    expect(state.creatorId).toBe('u1');
  });

  it('переподключает участника с валидным токеном', async () => {
    rooms.set('room1', {
      participants: [
        {
          id: 'u1',
          name: 'Alice',
          isOnline: false,
          hasVoted: false,
          sessionToken: 'valid-token-123',
        },
      ],
      votesRevealed: false,
      currentVotes: {},
      roomId: 'room1',
      creatorId: 'u1',
      controllers: [],
    });

    const oldWs = {
      roomId: 'room1',
      userId: 'u1',
      sessionToken: 'valid-token-123',
      close: vi.fn(),
    };
    wss.clients.add(oldWs);

    const newWs = makeWs();
    wss.clients.add(newWs);

    await join(newWs, {
      payload: {
        name: 'Alice',
        roomId: 'room1',
        sessionToken: 'valid-token-123',
      },
    });

    expect(newWs.userId).toBe('u1');
    expect(newWs.sessionToken).toBe('valid-token-123');
    expect(oldWs.close).toHaveBeenCalled();

    const participant = rooms
      .get('room1')
      .participants.find((p) => p.id === 'u1');
    expect(participant.isOnline).toBe(true);
  });

  it('не переподключает с невалидным токеном (создает новый профиль)', async () => {
    rooms.set('room1', {
      participants: [
        {
          id: 'u1',
          name: 'Alice',
          isOnline: false,
          hasVoted: false,
          sessionToken: 'valid-token-123',
        },
      ],
      votesRevealed: false,
      currentVotes: {},
      roomId: 'room1',
      creatorId: 'u1',
      controllers: [],
    });

    vi.mocked(generateId).mockReturnValueOnce('u2');
    vi.mocked(generateSessionToken).mockReturnValueOnce('new-token');

    const ws = makeWs();

    await join(ws, {
      payload: { name: 'Alice', roomId: 'room1', sessionToken: 'wrong-token' },
    });

    // Should create new participant, not reconnect to u1
    expect(ws.userId).toBe('u2');
    expect(ws.sessionToken).toBe('new-token');
    expect(rooms.get('room1').participants).toHaveLength(2);
  });

  it('восстанавливает имя создателя из БД для несуществующей комнаты', async () => {
    vi.mocked(getRoomCreatorName).mockResolvedValueOnce('OldCreator');
    const ws = makeWs();

    await join(ws, { payload: { name: 'OldCreator', roomId: 'room1' } });

    const state = rooms.get('room1');
    expect(state.creatorName).toBe('OldCreator');
    expect(state.creatorId).toBe(ws.userId);
  });

  it('отправляет начальное состояние клиенту и делает broadcast', async () => {
    const ws = makeWs();
    vi.mocked(generateId)
      .mockReturnValueOnce('room1')
      .mockReturnValueOnce('user1');

    await join(ws, { payload: { name: 'Alice' } });

    expect(getSafeState).toHaveBeenCalled();
    expect(ws.send).toHaveBeenCalled();
    expect(broadcastState).toHaveBeenCalledWith('room1');
  });

  it('второй участник не становится создателем, если создатель уже есть', async () => {
    rooms.set('room1', {
      participants: [
        { id: 'u1', name: 'Alice', isOnline: true, hasVoted: false },
      ],
      votesRevealed: false,
      currentVotes: {},
      roomId: 'room1',
      creatorId: 'u1',
      controllers: [],
    });
    const ws = makeWs();

    await join(ws, { payload: { name: 'Bob', roomId: 'room1' } });

    expect(rooms.get('room1').creatorId).toBe('u1');
    expect(saveRoomCreator).not.toHaveBeenCalled();
  });
});
