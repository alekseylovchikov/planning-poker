import { describe, it, expect, beforeEach, vi } from "vitest";
import { WebSocket } from "ws";
import { rooms } from "./rooms.js";

vi.mock("./wss.js", () => ({
  wss: { clients: new Set() },
}));

vi.mock("./getSafeState.js", () => ({
  getSafeState: vi.fn(() => ({ mocked: true })),
}));

import { broadcastState } from "./broadcastState.js";
import { wss } from "./wss.js";
import { getSafeState } from "./getSafeState.js";

describe("broadcastState", () => {
  beforeEach(() => {
    rooms.clear();
    wss.clients.clear();
  });

  it("ничего не делает для несуществующей комнаты", () => {
    broadcastState("unknown");

    expect(getSafeState).not.toHaveBeenCalled();
  });

  it("отправляет состояние всем клиентам в комнате", () => {
    rooms.set("r1", { roomId: "r1", participants: [] });

    const client1 = {
      readyState: WebSocket.OPEN,
      roomId: "r1",
      userId: "u1",
      send: vi.fn(),
    };
    const client2 = {
      readyState: WebSocket.OPEN,
      roomId: "r1",
      userId: "u2",
      send: vi.fn(),
    };
    wss.clients.add(client1);
    wss.clients.add(client2);

    broadcastState("r1");

    expect(client1.send).toHaveBeenCalledTimes(1);
    expect(client2.send).toHaveBeenCalledTimes(1);

    const sent = JSON.parse(client1.send.mock.calls[0][0]);
    expect(sent.type).toBe("state");
    expect(sent.payload).toEqual({ mocked: true });
  });

  it("не отправляет клиентам из другой комнаты", () => {
    rooms.set("r1", { roomId: "r1", participants: [] });

    const clientOtherRoom = {
      readyState: WebSocket.OPEN,
      roomId: "r2",
      userId: "u3",
      send: vi.fn(),
    };
    wss.clients.add(clientOtherRoom);

    broadcastState("r1");

    expect(clientOtherRoom.send).not.toHaveBeenCalled();
  });

  it("не отправляет клиентам с закрытым соединением", () => {
    rooms.set("r1", { roomId: "r1", participants: [] });

    const closedClient = {
      readyState: WebSocket.CLOSED,
      roomId: "r1",
      userId: "u1",
      send: vi.fn(),
    };
    wss.clients.add(closedClient);

    broadcastState("r1");

    expect(closedClient.send).not.toHaveBeenCalled();
  });

  it("не отправляет, если getSafeState вернул null", () => {
    rooms.set("r1", { roomId: "r1", participants: [] });
    vi.mocked(getSafeState).mockReturnValueOnce(null);

    const client = {
      readyState: WebSocket.OPEN,
      roomId: "r1",
      userId: "u1",
      send: vi.fn(),
    };
    wss.clients.add(client);

    broadcastState("r1");

    expect(client.send).not.toHaveBeenCalled();
  });
});
