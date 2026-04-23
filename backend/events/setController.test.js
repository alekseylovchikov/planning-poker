import { describe, it, expect, beforeEach, vi } from "vitest";
import { rooms } from "../rooms.js";

vi.mock("../broadcastState.js", () => ({
  broadcastState: vi.fn(),
}));

import { setController } from "./setController.js";
import { broadcastState } from "../broadcastState.js";

function makeWs(roomId, userId) {
  return { roomId, userId, send: vi.fn() };
}

function seedRoom(roomId, creatorId) {
  const state = {
    participants: [
      { id: creatorId, name: "Creator" },
      { id: "u2", name: "Bob" },
      { id: "u3", name: "Charlie" },
    ],
    votesRevealed: false,
    currentVotes: {},
    roomId,
    creatorId,
    controllers: [],
  };
  rooms.set(roomId, state);
  return state;
}

describe("setController", () => {
  beforeEach(() => {
    rooms.clear();
  });

  it("создатель добавляет контролёра", () => {
    seedRoom("r1", "creator1");
    const ws = makeWs("r1", "creator1");

    setController(ws, { payload: { participantId: "u2", canControl: true } });

    expect(rooms.get("r1").controllers).toContain("u2");
    expect(broadcastState).toHaveBeenCalledWith("r1");
  });

  it("создатель убирает контролёра", () => {
    seedRoom("r1", "creator1");
    rooms.get("r1").controllers = ["u2"];
    const ws = makeWs("r1", "creator1");

    setController(ws, { payload: { participantId: "u2", canControl: false } });

    expect(rooms.get("r1").controllers).not.toContain("u2");
    expect(broadcastState).toHaveBeenCalledWith("r1");
  });

  it("не добавляет дубли при повторном назначении", () => {
    seedRoom("r1", "creator1");
    rooms.get("r1").controllers = ["u2"];
    const ws = makeWs("r1", "creator1");

    setController(ws, { payload: { participantId: "u2", canControl: true } });

    expect(rooms.get("r1").controllers.filter((c) => c === "u2")).toHaveLength(1);
  });

  it("не-создатель получает ошибку", () => {
    seedRoom("r1", "creator1");
    const ws = makeWs("r1", "u2");

    setController(ws, { payload: { participantId: "u3", canControl: true } });

    expect(broadcastState).not.toHaveBeenCalled();

    const sent = JSON.parse(ws.send.mock.calls[0][0]);
    expect(sent.type).toBe("error");
    expect(sent.payload.message).toContain("создатель комнаты");
  });

  it("игнорирует несуществующего участника", () => {
    seedRoom("r1", "creator1");
    const ws = makeWs("r1", "creator1");

    setController(ws, { payload: { participantId: "ghost", canControl: true } });

    expect(rooms.get("r1").controllers).toHaveLength(0);
    expect(broadcastState).not.toHaveBeenCalled();
  });

  it("игнорирует, если participantId отсутствует", () => {
    seedRoom("r1", "creator1");
    const ws = makeWs("r1", "creator1");

    setController(ws, { payload: { canControl: true } });

    expect(broadcastState).not.toHaveBeenCalled();
  });

  it("игнорирует, если roomId или userId отсутствуют", () => {
    setController(makeWs(null, "u1"), { payload: { participantId: "u2", canControl: true } });
    setController(makeWs("r1", null), { payload: { participantId: "u2", canControl: true } });

    expect(broadcastState).not.toHaveBeenCalled();
  });

  it("инициализирует controllers как массив, если undefined", () => {
    seedRoom("r1", "creator1");
    rooms.get("r1").controllers = undefined;
    const ws = makeWs("r1", "creator1");

    setController(ws, { payload: { participantId: "u2", canControl: true } });

    expect(rooms.get("r1").controllers).toEqual(["u2"]);
  });
});
