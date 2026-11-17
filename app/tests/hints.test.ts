import { describe, expect, it } from 'vitest';
import { createHints, HELP_LINES, MAX_SHOWS } from '../src/hints.js';

function memory() {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
  };
}

describe('hints', () => {
  it('shows an instruction three times and then no more', () => {
    const hints = createHints(memory());
    expect(MAX_SHOWS).toBe(3);
    expect([1, 2, 3, 4, 5].map(() => hints.take('pick'))).toEqual([true, true, true, false, false]);
  });

  it('counts each instruction on its own', () => {
    const hints = createHints(memory());
    for (let i = 0; i < 3; i++) hints.take('pick');
    expect(hints.take('pick')).toBe(false);
    expect(hints.take('fill')).toBe(true);
  });

  it('keeps the count in storage between visits', () => {
    const storage = memory();
    const first = createHints(storage);
    for (let i = 0; i < 3; i++) first.take('pick');
    expect(createHints(storage).take('pick')).toBe(false);
  });

  it('still limits to three when storage throws or is missing', () => {
    const broken = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    for (const storage of [broken, null]) {
      const hints = createHints(storage);
      expect([1, 2, 3, 4].map(() => hints.take('pick'))).toEqual([true, true, true, false]);
    }
  });

  it('has help lines that are short plain sentences', () => {
    expect(HELP_LINES.length).toBeGreaterThanOrEqual(5);
    for (const line of HELP_LINES) {
      expect(line.split(/\s+/).length, line).toBeLessThanOrEqual(12);
    }
  });
});
