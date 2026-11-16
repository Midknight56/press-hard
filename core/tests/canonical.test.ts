import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { canonicalText } from '../src/index.js';
import type { HandoverRecord } from '../src/index.js';

const fixture = (name: string): HandoverRecord =>
  JSON.parse(
    readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), 'fixtures', name), 'utf8'),
  ) as HandoverRecord;

const canon = (value: unknown): string => canonicalText(value as HandoverRecord);

describe('canonicalText', () => {
  it('sorts keys by code unit order with no spaces', () => {
    expect(canon({ b: 1, a: 'x', B: null })).toBe('{"B":null,"a":"x","b":1}');
  });

  it('sorts keys by code unit, not by locale', () => {
    expect(canon({ a: 1, Z: 2, '\u00e9': 3, e: 4 })).toBe('{"Z":2,"a":1,"e":4,"\u00e9":3}');
  });

  it('sorts keys of nested objects and keeps array order', () => {
    expect(canon({ z: [{ b: 2, a: 1 }, 3, [2, 1]], a: { d: 1, c: 2 } })).toBe(
      '{"a":{"c":2,"d":1},"z":[{"a":1,"b":2},3,[2,1]]}',
    );
  });

  it('writes strings with JSON.stringify', () => {
    expect(canon({ a: 'q"\\\n\u2028</script>' })).toBe(`{"a":${JSON.stringify('q"\\\n\u2028</script>')}}`);
  });

  it('writes numbers with String(n) and null as null', () => {
    expect(canon({ a: 0, b: -5, c: 1.5, d: null })).toBe('{"a":0,"b":-5,"c":1.5,"d":null}');
  });

  it('skips the top level seal key', () => {
    expect(canon({ a: 1, seal: 'f'.repeat(64) })).toBe('{"a":1}');
  });

  it('keeps a seal key that is not at the top level', () => {
    expect(canon({ a: { seal: 1 } })).toBe('{"a":{"seal":1}}');
  });

  it('skips a key whose value is undefined', () => {
    expect(canon({ a: 1, b: undefined, c: { d: undefined } })).toBe('{"a":1,"c":{}}');
  });

  it('gives the same text for deep equal records built in another key order', () => {
    const record = fixture('rental-return.json');
    const reversed = JSON.parse(JSON.stringify(record), function reviver(_k, v: unknown) {
      if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
        const entries = Object.entries(v as Record<string, unknown>).reverse();
        return Object.fromEntries(entries);
      }
      return v;
    }) as HandoverRecord;
    expect(Object.keys(reversed)).not.toEqual(Object.keys(record));
    expect(canonicalText(reversed)).toBe(canonicalText(record));
  });

  it('gives the same text with or without a seal', () => {
    const record = fixture('key-handover.json');
    expect(canonicalText({ ...record, seal: 'a'.repeat(64) })).toBe(canonicalText(record));
  });

  it('throws for a value of the wrong type from our own code', () => {
    expect(() => canon({ a: () => 1 })).toThrow();
    expect(() => canon({ a: Number.NaN })).toThrow();
    expect(() => canon({ a: Number.POSITIVE_INFINITY })).toThrow();
  });
});
