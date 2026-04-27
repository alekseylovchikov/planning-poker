import { describe, it, expect, beforeEach } from "vitest";
import { createRoom } from "./createRoom.js";
import { rooms } from "./rooms.js";

describe("createRoom", () => {
  beforeEach(() => {
    rooms.clear();
  });

  it("создаёт комнату с корректными значениями по умолчанию", () => {
    const state = createRoom("room1");

    expect(state).toEqual({
      participants: [],
      votesRevealed: false,
      currentVotes: {},
      roomId: "room1",
      creatorId: null,
      controllers: [],
      tasks: [],
    });
    expect(rooms.has("room1")).toBe(true);
  });

  it("принимает creatorId при создании", () => {
    const state = createRoom("room2", "user1");

    expect(state.creatorId).toBe("user1");
  });

  it("не перезаписывает существующую комнату", () => {
    const original = createRoom("room3");
    original.participants.push({ id: "u1", name: "Alice" });

    const second = createRoom("room3", "other-creator");

    expect(second).toBe(original);
    expect(second.participants).toHaveLength(1);
    expect(second.creatorId).toBeNull();
  });

  it("сохраняет комнату в глобальном Map", () => {
    createRoom("room4");

    expect(rooms.get("room4")).toBeDefined();
    expect(rooms.get("room4").roomId).toBe("room4");
  });
});
