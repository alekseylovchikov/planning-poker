import { describe, it, expect, beforeEach, vi } from 'vitest';
import { rooms } from '../rooms.js';

vi.mock('../broadcastState.js', () => ({
  broadcastState: vi.fn(),
}));

import { reveal } from './reveal.js';
import { broadcastState } from '../broadcastState.js';

function makeWs(roomId, userId, sessionToken) {
  // Determine default sessionToken based on userId if not provided
  const defaultTokens = {
    'creator1': 'token123',
    'ctrl1': 'token800',
  };
  return { roomId, userId, sessionToken: sessionToken || defaultTokens[userId] || 'token123', send: vi.fn() };
}

function seedRoom(roomId, creatorId, controllers = []) {
  const participants = [
    { id: creatorId, name: 'Creator', sessionToken: 'token123' },
  ];
  
  // Add controllers as participants if they're not already
  controllers.forEach((ctrlId, idx) => {
    if (!participants.find(p => p.id === ctrlId)) {
      participants.push({
        id: ctrlId,
        name: `Controller${idx + 1}`,
        sessionToken: `token${800 + idx}`,
      });
    }
  });
  
  const state = {
    participants,
    votesRevealed: false,
    currentVotes: {},
    roomId,
    creatorId,
    controllers,
  };
  rooms.set(roomId, state);
  return state;
}

describe('reveal', () => {
  beforeEach(() => {
    rooms.clear();
  });

  it('создатель может открыть карты', () => {
    seedRoom('r1', 'creator1');
    const ws = makeWs('r1', 'creator1');

    reveal(ws);

    expect(rooms.get('r1').votesRevealed).toBe(true);
    expect(broadcastState).toHaveBeenCalledWith('r1');
  });

  it('контролёр может открыть карты', () => {
    seedRoom('r1', 'creator1', ['ctrl1']);
    const ws = makeWs('r1', 'ctrl1');

    reveal(ws);

    expect(rooms.get('r1').votesRevealed).toBe(true);
    expect(broadcastState).toHaveBeenCalledWith('r1');
  });

  it('обычный участник получает ошибку', () => {
    seedRoom('r1', 'creator1');
    const ws = makeWs('r1', 'regular');

    reveal(ws);

    expect(rooms.get('r1').votesRevealed).toBe(false);
    expect(broadcastState).not.toHaveBeenCalled();

    const sent = JSON.parse(ws.send.mock.calls[0][0]);
    expect(sent.type).toBe('error');
    expect(sent.payload.message).toContain('открывать карты');
  });

  it('игнорирует, если roomId или userId отсутствуют', () => {
    reveal(makeWs(null, 'u1'));
    reveal(makeWs('r1', null));

    expect(broadcastState).not.toHaveBeenCalled();
  });

  it('игнорирует, если комната не существует', () => {
    reveal(makeWs('unknown', 'u1'));

    expect(broadcastState).not.toHaveBeenCalled();
  });
});
