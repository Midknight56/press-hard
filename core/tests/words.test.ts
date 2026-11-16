import { describe, expect, it } from 'vitest';
import { sealWords } from '../src/index.js';
import { WORDS } from '../src/words.js';

const seal = (bytes: number[]): string =>
  [...bytes, ...new Array<number>(32 - bytes.length).fill(0)].map((b) => b.toString(16).padStart(2, '0')).join('');

describe('word list', () => {
  it('has exactly 256 words', () => {
    expect(WORDS).toHaveLength(256);
  });

  it('has no repeated word', () => {
    expect(new Set(WORDS).size).toBe(256);
  });

  it('holds only lower case words of 3 to 6 letters', () => {
    for (const word of WORDS) expect(word, word).toMatch(/^[a-z]{3,6}$/);
  });
});

describe('sealWords', () => {
  it('picks the word at each of the first four bytes and joins with a dash', () => {
    expect(sealWords(seal([0, 1, 2, 3]))).toBe([WORDS[0], WORDS[1], WORDS[2], WORDS[3]].join('-'));
    expect(sealWords(seal([255, 128, 16, 7]))).toBe([WORDS[255], WORDS[128], WORDS[16], WORDS[7]].join('-'));
  });

  it('gives four words', () => {
    expect(sealWords('ab'.repeat(32)).split('-')).toHaveLength(4);
  });

  it('gives the same words for the same seal', () => {
    const s = 'c0ffee00'.repeat(8);
    expect(sealWords(s)).toBe(sealWords(s));
  });

  it('ignores every byte after the fourth', () => {
    expect(sealWords(seal([9, 8, 7, 6]))).toBe(sealWords(seal([9, 8, 7, 6]).slice(0, 8) + 'ff'.repeat(28)));
  });

  it('changes when one of the first four bytes changes', () => {
    const a = sealWords(seal([9, 8, 7, 6]));
    for (const changed of [[10, 8, 7, 6], [9, 9, 7, 6], [9, 8, 8, 6], [9, 8, 7, 7]]) {
      expect(sealWords(seal(changed))).not.toBe(a);
    }
  });

  it('throws for a seal that is not 64 lower case hex characters', () => {
    expect(() => sealWords('abc')).toThrow();
    expect(() => sealWords('A'.repeat(64))).toThrow();
  });
});
