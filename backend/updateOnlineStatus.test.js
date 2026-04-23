import { describe, it, expect, beforeEach, vi } from "vitest";
import { WebSocket } from "ws";
import { rooms } from "./rooms.js";

vi.mock("./wss.js", () => ({
  wss: { clients: new Set() },
}));

vi.mock("./broadcastState.js", () => ({
  broadcastState: vi.fn(),
}));

import { updateOnlineStatus } from "./updateOnlineStatus.js";
import { wss } from "./wss.js";
import { broadcastState } from "./broadcastState.js";

describe("updateOnlineStatus", () => {
  beforeEach(() => {
    rooms.clear();
    wss.clients.clear();
  });

  it("помечает участника онлайн, если есть активный сокет", () => {
    rooms.set("r1", {
      roomId: "r1",
      participants: [
        { id: "u1", name: "Alice", isOnline: false },
        { id: "u2", name: "Bob", isOnline: true },
      ],
    });

    wss.clients.add({
      userId: "u1",
      roomId: "r1",
      readyState: WebSocket.OPEN,
    });

    updateOnlineStatus();

    const state = rooms.get("r1");
    expect(state.participants[0].isOnline).toBe(true);
    expect(state.participants[1].isOnline).toBe(false);
    expect(broadcastState).toHaveBeenCalledWith("r1");
  });

  it("помечает всех офлайн, если нет активных сокетов", () => {
    rooms.set("r1", {
      roomId: "r1",
      participants: [
        { id: "u1", name: "Alice", isOnline: true },
      ],
    });

    updateOnlineStatus();

    expect(rooms.get("r1").participants[0].isOnline).toBe(false);
    expect(broadcastState).toHaveBeenCalledWith("r1");
  });

  it("не учитывает закрытые сокеты", () => {
    rooms.set("r1", {
      roomId: "r1",
      participants: [{ id: "u1", name: "Alice", isOnline: true }],
    });

    wss.clients.add({
      userId: "u1",
      roomId: "r1",
      readyState: WebSocket.CLOSED,
    });

    updateOnlineStatus();

    expect(rooms.get("r1").participants[0].isOnline).toBe(false);
  });

  it("обрабатывает несколько комнат", () => {
    rooms.set("r1", {
      roomId: "r1",
      participants: [{ id: "u1", name: "Alice", isOnline: false }],
    });
    rooms.set("r2", {
      roomId: "r2",
      participants: [{ id: "u2", name: "Bob", isOnline: false }],
    });

    wss.clients.add({ userId: "u1", roomId: "r1", readyState: WebSocket.OPEN });
    wss.clients.add({ userId: "u2", roomId: "r2", readyState: WebSocket.OPEN });

    updateOnlineStatus();

    expect(rooms.get("r1").participants[0].isOnline).toBe(true);
    expect(rooms.get("r2").participants[0].isOnline).toBe(true);
    expect(broadcastState).toHaveBeenCalledTimes(2);
  });

  it("не падает на пустом списке комнат", () => {
    expect(() => updateOnlineStatus()).not.toThrow();
  });
});
