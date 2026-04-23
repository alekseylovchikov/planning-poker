import { describe, it, expect, beforeEach, vi } from "vitest";
import { rooms } from "../rooms.js";

vi.mock("../broadcastState.js", () => ({
  broadcastState: vi.fn(),
}));

import { reset } from "./reset.js";
import { broadcastState } from "../broadcastState.js";

function makeWs(roomId, userId) {
  return { roomId, userId, send: vi.fn() };
}

function seedRoom(roomId, creatorId, controllers = []) {
  const state = {
    participants: [
      { id: "u1", name: "Alice", vote: "5", hasVoted: true },
      { id: "u2", name: "Bob", vote: "8", hasVoted: true },
    ],
    votesRevealed: true,
    currentVotes: { u1: "5", u2: "8" },
    roomId,
    creatorId,
    controllers,
  };
  rooms.set(roomId, state);
  return state;
}

describe("reset", () => {
  beforeEach(() => {
    rooms.clear();
  });

  it("создатель сбрасывает голоса", () => {
    seedRoom("r1", "u1");
    const ws = makeWs("r1", "u1");

    reset(ws);

    const state = rooms.get("r1");
    expect(state.votesRevealed).toBe(false);
    expect(state.currentVotes).toEqual({});
    state.participants.forEach((p) => {
      expect(p.vote).toBeUndefined();
      expect(p.hasVoted).toBe(false);
    });
    expect(broadcastState).toHaveBeenCalledWith("r1");
  });

  it("контролёр может сбрасывать голоса", () => {
    seedRoom("r1", "u1", ["ctrl1"]);
    const ws = makeWs("r1", "ctrl1");

    reset(ws);

    expect(rooms.get("r1").votesRevealed).toBe(false);
    expect(broadcastState).toHaveBeenCalledWith("r1");
  });

  it("обычный участник получает ошибку", () => {
    seedRoom("r1", "u1");
    const ws = makeWs("r1", "regular");

    reset(ws);

    expect(rooms.get("r1").votesRevealed).toBe(true);
    expect(broadcastState).not.toHaveBeenCalled();

    const sent = JSON.parse(ws.send.mock.calls[0][0]);
    expect(sent.type).toBe("error");
    expect(sent.payload.message).toContain("сбрасывать голоса");
  });

  it("игнорирует, если roomId или userId отсутствуют", () => {
    reset(makeWs(null, "u1"));
    reset(makeWs("r1", null));

    expect(broadcastState).not.toHaveBeenCalled();
  });

  it("игнорирует, если комната не существует", () => {
    reset(makeWs("unknown", "u1"));

    expect(broadcastState).not.toHaveBeenCalled();
  });
});
