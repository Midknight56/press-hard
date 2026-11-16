import { sha256Hex, validateRecord } from 'core';
import { describe, expect, it } from 'vitest';
import { fitSize, photoFromResult, photoSizeKb, resizePhoto, type PhotoCodec } from '../src/photo.js';
import { sampleRecord } from '../src/templates/sample.js';

function codec(width: number, height: number, sizes: Record<number, number>, log: number[] = []): PhotoCodec {
  return {
    async measure() {
      return { width, height };
    },
    async render(_file, _w, _h, quality) {
      log.push(quality);
      return 'A'.repeat(sizes[quality] ?? 0);
    },
  };
}
const blob = new Blob(['x']);

describe('fitSize', () => {
  it('scales 4000 by 3000 to 1600 by 1200', () => {
    expect(fitSize(4000, 3000, 1600)).toEqual({ width: 1600, height: 1200 });
  });
  it('scales a tall picture by its height', () => {
    expect(fitSize(3000, 4000, 1600)).toEqual({ width: 1200, height: 1600 });
  });
  it('never enlarges and never returns a side below 1', () => {
    expect(fitSize(800, 600, 1600)).toEqual({ width: 800, height: 600 });
    expect(fitSize(10000, 1, 1600)).toEqual({ width: 1600, height: 1 });
  });
});

describe('resizePhoto quality steps', () => {
  it('uses 0.82 when it fits', async () => {
    const log: number[] = [];
    const r = await resizePhoto(blob, 1600, 1000, codec(4000, 3000, { 0.82: 1000 }, log));
    expect(r).toMatchObject({ ok: true, width: 1600, height: 1200 });
    expect(log).toEqual([0.82]);
  });
  it('steps to 0.7 and then 0.6', async () => {
    const log: number[] = [];
    const r = await resizePhoto(blob, 1600, 1000, codec(100, 100, { 0.82: 2000, 0.7: 1500, 0.6: 900 }, log));
    expect(r.ok).toBe(true);
    expect(log).toEqual([0.82, 0.7, 0.6]);
  });
  it('accepts a length equal to the limit and refuses one over it', async () => {
    expect((await resizePhoto(blob, 1600, 1000, codec(100, 100, { 0.82: 1000 }))).ok).toBe(true);
    expect(await resizePhoto(blob, 1600, 1000, codec(100, 100, { 0.82: 1001, 0.7: 1001, 0.6: 1001 }))).toEqual({
      ok: false,
      error: 'too_big',
    });
  });
  it('says unreadable when the picture cannot be measured or drawn', async () => {
    const none: PhotoCodec = { measure: async () => null, render: async () => '' };
    expect(await resizePhoto(blob, 1600, 1000, none)).toEqual({ ok: false, error: 'unreadable' });
    const broken: PhotoCodec = {
      measure: async () => ({ width: 10, height: 10 }),
      render: async () => {
        throw new Error('no');
      },
    };
    expect(await resizePhoto(blob, 1600, 1000, broken)).toEqual({ ok: false, error: 'unreadable' });
  });
});

describe('photo digest and size', () => {
  it('takes the digest from the bytes behind the base64 text', () => {
    const photo = photoFromResult({ dataBase64: 'YWJj', width: 3, height: 1 });
    expect(photo.digest).toBe(sha256Hex(new TextEncoder().encode('abc')));
    expect(photo.digest).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(photo).toMatchObject({ mime: 'image/jpeg', width: 3, height: 1, dataBase64: 'YWJj' });
  });
  it('gives a digest that validateRecord accepts for the photos of the sample', () => {
    for (const p of sampleRecord.photos) {
      const again = photoFromResult({ dataBase64: p.dataBase64, width: p.width, height: p.height });
      expect(again).toEqual(p);
    }
    expect(validateRecord(sampleRecord)).toEqual([]);
  });
  it('shows the size as length * 3 / 4 bytes, rounded, in KB', () => {
    expect(photoSizeKb('A'.repeat(4000))).toBe(3);
    expect(photoSizeKb('A'.repeat(1_500_000))).toBe(1099);
    expect(photoSizeKb('A'.repeat(4))).toBe(1);
  });
});