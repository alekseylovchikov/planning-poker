import { describe, it, expect, beforeEach } from "vitest";
import { getSafeState } from "./getSafeState.js";
import { rooms } from "./rooms.js";

function makeRoom(overrides = {}) {
  return {
    participants: [],
    votesRevealed: false,
    currentVotes: {},
    roomId: "room1",
    creatorId: "creator1",
    controllers: [],
    ...overrides,
  };
}

describe("getSafeState", () => {
  beforeEach(() => {
    rooms.clear();
  });

  it("возвращает null для несуществующей комнаты", () => {
    const client = { userId: "u1" };

    expect(getSafeState(client, "unknown")).toBeNull();
  });

  it("устанавливает isCreator=true для создателя", () => {
    rooms.set("room1", makeRoom({ creatorId: "u1" }));

    const state = getSafeState({ userId: "u1" }, "room1");

    expect(state.isCreator).toBe(true);
    expect(state.canControlVotes).toBe(true);
  });

  it("устанавливает isCreator=false для обычного участника", () => {
    rooms.set("room1", makeRoom({ creatorId: "creator1" }));

    const state = getSafeState({ userId: "other" }, "room1");

    expect(state.isCreator).toBe(false);
    expect(state.canControlVotes).toBe(false);
  });

  it("canControlVotes=true для контролёра (не создателя)", () => {
    rooms.set(
      "room1",
      makeRoom({ creatorId: "creator1", controllers: ["ctrl1"] }),
    );

    const state = getSafeState({ userId: "ctrl1" }, "room1");

    expect(state.isCreator).toBe(false);
    expect(state.canControlVotes).toBe(true);
  });

  it("скрывает чужие голоса, пока votesRevealed=false", () => {
    rooms.set(
      "room1",
      makeRoom({
        participants: [
          { id: "u1", name: "Alice", vote: "5", hasVoted: true },
          { id: "u2", name: "Bob", vote: "8", hasVoted: true },
        ],
        currentVotes: { u1: "5", u2: "8" },
        votesRevealed: false,
      }),
    );

    const state = getSafeState({ userId: "u1" }, "room1");

    const alice = state.participants.find((p) => p.id === "u1");
    const bob = state.participants.find((p) => p.id === "u2");

    expect(alice.vote).toBe("5");
    expect(bob.vote).toBeUndefined();
    expect(state.currentVotes).toEqual({ u1: "5" });
  });

  it("показывает все голоса, когда votesRevealed=true", () => {
    rooms.set(
      "room1",
      makeRoom({
        participants: [
          { id: "u1", name: "Alice", vote: "5", hasVoted: true },
          { id: "u2", name: "Bob", vote: "8", hasVoted: true },
        ],
        currentVotes: { u1: "5", u2: "8" },
        votesRevealed: true,
      }),
    );

    const state = getSafeState({ userId: "u1" }, "room1");

    expect(state.participants.find((p) => p.id === "u2").vote).toBe("8");
    expect(state.currentVotes).toEqual({ u1: "5", u2: "8" });
  });

  it("удаляет creatorId и controllers из ответа", () => {
    rooms.set(
      "room1",
      makeRoom({ controllers: ["c1"] }),
    );

    const state = getSafeState({ userId: "u1" }, "room1");

    expect(state.creatorId).toBeUndefined();
    expect(state.controllers).toBeUndefined();
  });

  it("проставляет canControlVotes каждому участнику", () => {
    rooms.set(
      "room1",
      makeRoom({
        creatorId: "creator1",
        controllers: ["ctrl1"],
        participants: [
          { id: "creator1", name: "Creator" },
          { id: "ctrl1", name: "Controller" },
          { id: "regular", name: "Regular" },
        ],
      }),
    );

    const state = getSafeState({ userId: "regular" }, "room1");

    expect(state.participants.find((p) => p.id === "creator1").canControlVotes).toBe(true);
    expect(state.participants.find((p) => p.id === "ctrl1").canControlVotes).toBe(true);
    expect(state.participants.find((p) => p.id === "regular").canControlVotes).toBe(false);
  });
});
