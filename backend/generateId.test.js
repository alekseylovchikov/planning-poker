import { describe, it, expect } from 'vitest';
import { generateId, generateSessionToken } from './generateId.js';

describe('generateId', () => {
  it('возвращает строку длиной 8 символов (hex)', () => {
    const id = generateId();

    expect(typeof id).toBe('string');
    expect(id).toHaveLength(8);
  });

  it('содержит только шестнадцатеричные символы', () => {
    for (let i = 0; i < 50; i++) {
      expect(generateId()).toMatch(/^[a-f0-9]{8}$/);
    }
  });

  it('генерирует уникальные id', () => {
    const ids = new Set(Array.from({ length: 200 }, () => generateId()));
    expect(ids.size).toBe(200);
  });
});

describe('generateSessionToken', () => {
  it('возвращает строку длиной 32 символа (16 байт = 32 hex)', () => {
    const token = generateSessionToken();

    expect(typeof token).toBe('string');
    expect(token).toHaveLength(32);
  });

  it('содержит только шестнадцатеричные символы', () => {
    for (let i = 0; i < 50; i++) {
      expect(generateSessionToken()).toMatch(/^[a-f0-9]{32}$/);
    }
  });

  it('генерирует уникальные токены', () => {
    const tokens = new Set(
      Array.from({ length: 200 }, () => generateSessionToken()),
    );

    expect(tokens.size).toBe(200);
  });
});
