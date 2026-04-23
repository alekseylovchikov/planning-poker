import { describe, it, expect, beforeEach, vi } from "vitest";

const mockUpdateOne = vi.fn();
const mockFindOne = vi.fn();
const mockCollection = vi.fn(() => ({
  updateOne: mockUpdateOne,
  findOne: mockFindOne,
}));

vi.mock("./db.js", () => ({
  getDb: vi.fn(() => Promise.resolve({ collection: mockCollection })),
}));

import { saveRoomCreator, getRoomCreatorName } from "./roomCreatorsDb.js";

describe("roomCreatorsDb", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("saveRoomCreator", () => {
    it("сохраняет создателя через upsert", async () => {
      mockUpdateOne.mockResolvedValueOnce({});

      await saveRoomCreator("room1", "Alice");

      expect(mockCollection).toHaveBeenCalledWith("room_creators");
      expect(mockUpdateOne).toHaveBeenCalledWith(
        { roomId: "room1" },
        { $set: { roomId: "room1", creatorName: "Alice" } },
        { upsert: true },
      );
    });

    it("не бросает исключение при ошибке БД", async () => {
      mockUpdateOne.mockRejectedValueOnce(new Error("DB error"));

      await expect(saveRoomCreator("room1", "Alice")).resolves.toBeUndefined();
    });
  });

  describe("getRoomCreatorName", () => {
    it("возвращает имя создателя", async () => {
      mockFindOne.mockResolvedValueOnce({ roomId: "room1", creatorName: "Alice" });

      const result = await getRoomCreatorName("room1");

      expect(result).toBe("Alice");
      expect(mockCollection).toHaveBeenCalledWith("room_creators");
      expect(mockFindOne).toHaveBeenCalledWith({ roomId: "room1" });
    });

    it("возвращает null, если запись не найдена", async () => {
      mockFindOne.mockResolvedValueOnce(null);

      const result = await getRoomCreatorName("unknown");

      expect(result).toBeNull();
    });

    it("возвращает null при ошибке БД", async () => {
      mockFindOne.mockRejectedValueOnce(new Error("DB error"));

      const result = await getRoomCreatorName("room1");

      expect(result).toBeNull();
    });
  });
});
