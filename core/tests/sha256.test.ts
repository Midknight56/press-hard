import { createHash, randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { sha256Hex } from '../src/index.js';

const node = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');

describe('sha256Hex known values', () => {
  it('empty input', () => {
    expect(sha256Hex(new Uint8Array(0))).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    );
  });

  it('abc', () => {
    expect(sha256Hex(new TextEncoder().encode('abc'))).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });

  it('one million a characters', () => {
    expect(sha256Hex(new TextEncoder().encode('a'.repeat(1_000_000)))).toBe(
      'cdc76e5c9914fb9281a1c7e284d73e67f1809a48a497200e046d39ccc7112cd0',
    );
  });
});

describe('sha256Hex against node crypto', () => {
  for (const length of [0, 1, 55, 56, 63, 64, 65, 119, 120, 128]) {
    it(`block edge length ${length}`, () => {
      const bytes = new Uint8Array(length).map((_, i) => (i * 7 + 3) % 256);
      expect(sha256Hex(bytes)).toBe(node(bytes));
    });
  }

  it('300 random inputs of 0 to 5000 bytes', () => {
    for (let i = 0; i < 300; i++) {
      const length = randomBytes(2).readUInt16BE(0) % 5001;
      const bytes = new Uint8Array(randomBytes(length));
      expect(sha256Hex(bytes), `length ${length}`).toBe(node(bytes));
    }
  });
});
