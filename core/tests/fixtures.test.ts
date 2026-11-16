import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { HandoverRecord } from '../src/index.js';

const dir = resolve(dirname(fileURLToPath(import.meta.url)), 'fixtures');
const load = (name: string): HandoverRecord =>
  JSON.parse(readFileSync(resolve(dir, name), 'utf8')) as HandoverRecord;

/** Reads width and height from the first start-of-frame marker of a JPEG. */
const jpegSize = (bytes: Buffer): { width: number; height: number } => {
  expect(bytes[0]).toBe(0xff);
  expect(bytes[1]).toBe(0xd8);
  let i = 2;
  while (i < bytes.length) {
    expect(bytes[i]).toBe(0xff);
    const marker = bytes[i + 1] as number;
    const length = bytes.readUInt16BE(i + 2);
    if (marker >= 0xc0 && marker <= 0xc3) {
      return { height: bytes.readUInt16BE(i + 5), width: bytes.readUInt16BE(i + 7) };
    }
    i += 2 + length;
  }
  throw new Error('no start of frame');
};

const expectations = [
  { file: 'rental-return.json', fields: 8, photoFields: 2, photos: 2 },
  { file: 'key-handover.json', fields: 5, photoFields: 0, photos: 0 },
  { file: 'sold-as-seen.json', fields: 6, photoFields: 1, photos: 1 },
];

describe('fixture records', () => {
  for (const e of expectations) {
    describe(e.file, () => {
      const record = load(e.file);

      it('is unsealed with both signatures', () => {
        expect(record.format).toBe(1);
        expect(record.sealedAt).toBeNull();
        expect('seal' in record).toBe(false);
        expect(record.signatures.map((s) => s.party).sort()).toEqual(['giver', 'receiver']);
      });

      it('has the planned counts', () => {
        expect(record.fields).toHaveLength(e.fields);
        expect(record.fields.filter((f) => f.kind === 'photo')).toHaveLength(e.photoFields);
        expect(record.photos).toHaveLength(e.photos);
      });

      it('has 16 by 16 JPEG photos with the real SHA-256 digest', () => {
        for (const photo of record.photos) {
          const bytes = Buffer.from(photo.dataBase64, 'base64');
          expect(createHash('sha256').update(bytes).digest('hex')).toBe(photo.digest);
          expect(jpegSize(bytes)).toEqual({ width: 16, height: 16 });
          expect(photo.width).toBe(16);
          expect(photo.height).toBe(16);
          expect(photo.mime).toBe('image/jpeg');
        }
      });
    });
  }

  it('rental-return has a number field with id mileage', () => {
    const mileage = load('rental-return.json').fields.find((f) => f.id === 'mileage');
    expect(mileage?.kind).toBe('number');
  });
});
