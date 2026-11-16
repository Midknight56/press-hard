import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { canonicalText, sealRecord, validateRecord, verifyRecord } from '../src/index.js';
import type { HandoverRecord } from '../src/index.js';

const fixture = (name: string): HandoverRecord =>
  JSON.parse(
    readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), 'fixtures', name), 'utf8'),
  ) as HandoverRecord;

const TIME = '2026-11-16T10:30:00Z';

const sealed = (name = 'rental-return.json'): HandoverRecord => {
  const result = sealRecord(fixture(name), TIME);
  if (!result.ok) throw new Error(result.problems.join('; '));
  return result.record;
};

describe('sealRecord', () => {
  it('sets sealedAt and a seal that is the SHA-256 of the canonical text', () => {
    const record = sealed();
    expect(record.sealedAt).toBe(TIME);
    const expected = createHash('sha256').update(canonicalText({ ...record, seal: undefined }), 'utf8').digest('hex');
    expect(record.seal).toBe(expected);
    expect(record.seal).toMatch(/^[0-9a-f]{64}$/);
  });

  it('seals all three fixtures to records that validate', () => {
    for (const name of ['rental-return.json', 'key-handover.json', 'sold-as-seen.json']) {
      expect(validateRecord(sealed(name))).toEqual([]);
    }
  });

  it('does not change the record it was given', () => {
    const original = fixture('key-handover.json');
    const before = JSON.stringify(original);
    sealRecord(original, TIME);
    expect(JSON.stringify(original)).toBe(before);
  });

  it('gives different seals for different times', () => {
    const a = sealRecord(fixture('key-handover.json'), TIME);
    const b = sealRecord(fixture('key-handover.json'), '2026-11-16T10:30:01Z');
    expect(a.ok && b.ok && a.record.seal !== b.record.seal).toBe(true);
  });

  it('refuses to seal twice', () => {
    const again = sealRecord(sealed(), '2026-11-17T10:30:00Z');
    expect(again.ok).toBe(false);
    if (!again.ok) expect(again.problems.join(' ')).toMatch(/seal/);
  });

  it('refuses a record that has problems', () => {
    const bad = fixture('rental-return.json');
    bad.fields[0] = { ...(bad.fields[0] as HandoverRecord['fields'][number]), id: 'Bad Id' };
    const result = sealRecord(bad, TIME);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.problems.some((p) => p.includes('fields[0].id'))).toBe(true);
  });

  for (const time of ['yesterday', '2026-11-16', '', '2026-13-40T00:00:00Z']) {
    it(`refuses sealedAt ${JSON.stringify(time)}`, () => {
      const result = sealRecord(fixture('rental-return.json'), time);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.problems.some((p) => p.includes('sealedAt'))).toBe(true);
    });
  }

  it('does not throw for input that is not a record', () => {
    expect(sealRecord(null as unknown as HandoverRecord, TIME).ok).toBe(false);
  });
});

describe('verifyRecord', () => {
  it('gives matches for a sealed fixture', () => {
    expect(verifyRecord(sealed())).toBe('matches');
  });

  it('gives matches when the expected seal is the seal', () => {
    const record = sealed();
    expect(verifyRecord(record, record.seal)).toBe('matches');
  });

  it('gives changed when one character of one field changes', () => {
    const record = sealed();
    const field = record.fields.find((f) => f.id === 'mileage');
    if (field === undefined || field.value === null) throw new Error('fixture');
    field.value = field.value.slice(0, -1) + '9';
    expect(verifyRecord(record)).toBe('changed');
  });

  it('gives changed when a photo byte, a party name or a signature point changes', () => {
    const photo = sealed();
    const bytes = Buffer.from((photo.photos[0] as HandoverRecord['photos'][number]).dataBase64, 'base64');
    bytes[10] = (bytes[10] as number) ^ 1;
    (photo.photos[0] as HandoverRecord['photos'][number]).dataBase64 = bytes.toString('base64');
    expect(verifyRecord(photo)).toBe('changed');

    const name = sealed();
    name.parties.receiver = name.parties.receiver + '.';
    expect(verifyRecord(name)).toBe('changed');

    const point = sealed();
    const stroke = (point.signatures[0] as HandoverRecord['signatures'][number]).strokes[0] as number[];
    stroke[0] = (stroke[0] as number) + 1;
    expect(verifyRecord(point)).toBe('changed');
  });

  it('gives changed when sealedAt changes', () => {
    const record = sealed();
    record.sealedAt = '2026-11-16T10:30:01Z';
    expect(verifyRecord(record)).toBe('changed');
  });

  it('gives changed when the stored seal is replaced', () => {
    const record = sealed();
    record.seal = '0'.repeat(64);
    expect(verifyRecord(record)).toBe('changed');
  });

  it('gives unsealed for a record with no seal', () => {
    expect(verifyRecord(fixture('rental-return.json'))).toBe('unsealed');
  });

  it('gives unsealed also when an expected seal is given', () => {
    expect(verifyRecord(fixture('rental-return.json'), 'a'.repeat(64))).toBe('unsealed');
  });

  it('gives wrong_seal for a good record and another expected seal', () => {
    expect(verifyRecord(sealed(), 'a'.repeat(64))).toBe('wrong_seal');
  });

  it('gives changed for a changed record and another expected seal', () => {
    const record = sealed();
    record.parties.giver = 'Someone Else';
    expect(verifyRecord(record, 'a'.repeat(64))).toBe('changed');
    expect(verifyRecord(record, record.seal)).toBe('changed');
  });
});
