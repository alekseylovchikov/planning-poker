import { describe, it, expect, beforeEach, vi } from 'vitest';
import { rooms } from '../rooms.js';

vi.mock('../broadcastState.js', () => ({
  broadcastState: vi.fn(),
}));

import { vote } from './vote.js';
import { broadcastState } from '../broadcastState.js';

function makeWs(roomId, userId, sessionToken) {
  // Determine default sessionToken based on userId if not provided
  const defaultTokens = {
    'u1': 'token123',
    'stranger': 'token999',
  };
  return { roomId, userId, sessionToken: sessionToken || defaultTokens[userId] || 'token123', send: vi.fn() };
}

function seedRoom(roomId, participants = []) {
  const stateParticipants = participants.map((p) => ({
    ...p,
    sessionToken: p.sessionToken || 'token123', // Use explicit or default token

  const state = {
    participants: stateParticipants,
    votesRevealed: false,
    currentVotes: {},
    roomId,
    creatorId: stateParticipants[0]?.id ?? null,
    controllers: [],
  };
  rooms.set(roomId, state);
  return state;
}

describe('vote', () => {
  beforeEach(() => {
    rooms.clear();
  });

  it('записывает голос участника и делает broadcast', () => {
    seedRoom('r1', [{ id: 'u1', name: 'Alice', hasVoted: false }]);
    const ws = makeWs('r1', 'u1');

    vote(ws, { payload: { vote: '5' } });

    const state = rooms.get('r1');
    const participant = state.participants[0];
    expect(participant.vote).toBe('5');
    expect(participant.hasVoted).toBe(true);
    expect(state.currentVotes.u1).toBe('5');
    expect(broadcastState).toHaveBeenCalledWith('r1');
  });

  it('игнорирует, если ws.roomId отсутствует', () => {
    const ws = makeWs(null, 'u1');

    vote(ws, { payload: { vote: '3' } });

    expect(broadcastState).not.toHaveBeenCalled();
  });

  it('игнорирует, если ws.userId отсутствует', () => {
    const ws = makeWs('r1', null);

    vote(ws, { payload: { vote: '3' } });

    expect(broadcastState).not.toHaveBeenCalled();
  });

  it('игнорирует, если комната не существует', () => {
    const ws = makeWs('unknown', 'u1');

    vote(ws, { payload: { vote: '3' } });

    expect(broadcastState).not.toHaveBeenCalled();
  });

  it('игнорирует, если голос пустой', () => {
    seedRoom('r1', [{ id: 'u1', name: 'Alice', hasVoted: false }]);
    const ws = makeWs('r1', 'u1');

    vote(ws, { payload: {} });

    expect(broadcastState).not.toHaveBeenCalled();
  });

  it('игнорирует, если участник не найден в комнате', () => {
    seedRoom('r1', [{ id: 'u1', name: 'Alice', hasVoted: false }]);
    const ws = makeWs('r1', 'stranger');

    vote(ws, { payload: { vote: '5' } });

    expect(broadcastState).not.toHaveBeenCalled();
  });

  it('позволяет переголосовать', () => {
    seedRoom('r1', [{ id: 'u1', name: 'Alice', vote: '3', hasVoted: true }]);
    rooms.get('r1').currentVotes.u1 = '3';
    const ws = makeWs('r1', 'u1');

    vote(ws, { payload: { vote: '8' } });

    expect(rooms.get('r1').participants[0].vote).toBe('8');
    expect(rooms.get('r1').currentVotes.u1).toBe('8');
  });
});
