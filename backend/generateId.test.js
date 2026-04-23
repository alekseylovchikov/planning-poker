import { describe, it, expect } from "vitest";
import { generateId } from "./generateId.js";

describe("generateId", () => {
  it("возвращает строку длиной 7 символов", () => {
    const id = generateId();

    expect(typeof id).toBe("string");
    expect(id).toHaveLength(7);
  });

  it("содержит только буквенно-цифровые символы (base36)", () => {
    for (let i = 0; i < 50; i++) {
      expect(generateId()).toMatch(/^[a-z0-9]{7}$/);
    }
  });

  it("генерирует уникальные id", () => {
    const ids = new Set(Array.from({ length: 200 }, () => generateId()));

    expect(ids.size).toBe(200);
  });
});
