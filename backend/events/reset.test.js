import { describe, it, expect, beforeEach, vi } from 'vitest';
import { rooms } from '../rooms.js';

vi.mock('../broadcastState.js', () => ({
  broadcastState: vi.fn(),
}));

import { reset } from './reset.js';
import { broadcastState } from '../broadcastState.js';

function makeWs(roomId, userId, sessionToken) {
  // Determine default sessionToken based on userId if not provided
  const defaultTokens = {
    'u1': 'token123',
    'u2': 'token456',
    'ctrl1': 'token800',
  };
  return { roomId, userId, sessionToken: sessionToken || defaultTokens[userId] || 'token123', send: vi.fn() };
}

function seedRoom(roomId, creatorId, controllers = []) {
  const participants = [
    {
      id: 'u1',
      name: 'Alice',
      vote: '5',
      hasVoted: true,
      sessionToken: 'token123',
    },
    {
      id: 'u2',
      name: 'Bob',
      vote: '8',
      hasVoted: true,
      sessionToken: 'token456',
    },
  ];
  
  // Add controllers as participants if they're not already
  controllers.forEach((ctrlId, idx) => {
    if (!participants.find(p => p.id === ctrlId)) {
      participants.push({
        id: ctrlId,
        name: `Controller${idx + 1}`,
        vote: undefined,
        hasVoted: false,
        sessionToken: `token${800 + idx}`,
      });
    }
  });

  const state = {
    participants,
    votesRevealed: true,
    currentVotes: { u1: '5', u2: '8' },
    roomId,
    creatorId,
    controllers,
  };
  rooms.set(roomId, state);
  return state;
}

describe('reset', () => {
  beforeEach(() => {
    rooms.clear();
  });

  it('создатель сбрасывает голоса', () => {
    seedRoom('r1', 'u1');
    const ws = makeWs('r1', 'u1');

    reset(ws);

    const state = rooms.get('r1');
    expect(state.votesRevealed).toBe(false);
    expect(state.currentVotes).toEqual({});
    state.participants.forEach((p) => {
      expect(p.vote).toBeUndefined();
      expect(p.hasVoted).toBe(false);
    });
    expect(broadcastState).toHaveBeenCalledWith('r1');
  });

  it('контролёр может сбрасывать голоса', () => {
    seedRoom('r1', 'u1', ['ctrl1']);
    const ws = makeWs('r1', 'ctrl1');

    reset(ws);

    expect(rooms.get('r1').votesRevealed).toBe(false);
    expect(broadcastState).toHaveBeenCalledWith('r1');
  });

  it('обычный участник получает ошибку', () => {
    seedRoom('r1', 'u1');
    const ws = makeWs('r1', 'regular');

    reset(ws);

    expect(rooms.get('r1').votesRevealed).toBe(true);
    expect(broadcastState).not.toHaveBeenCalled();

    const sent = JSON.parse(ws.send.mock.calls[0][0]);
    expect(sent.type).toBe('error');
    expect(sent.payload.message).toContain('сбрасывать голоса');
  });

  it('игнорирует, если roomId или userId отсутствуют', () => {
    reset(makeWs(null, 'u1'));
    reset(makeWs('r1', null));

    expect(broadcastState).not.toHaveBeenCalled();
  });

  it('игнорирует, если комната не существует', () => {
    reset(makeWs('unknown', 'u1'));

    expect(broadcastState).not.toHaveBeenCalled();
  });
});
