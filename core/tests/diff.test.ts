import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { canonicalText, diffRecords, sealRecord } from '../src/index.js';
import type { Field, HandoverRecord, Photo } from '../src/index.js';

const fixture = (name: string): HandoverRecord =>
  JSON.parse(
    readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), 'fixtures', name), 'utf8'),
  ) as HandoverRecord;

const clone = (record: HandoverRecord): HandoverRecord => JSON.parse(JSON.stringify(record)) as HandoverRecord;
const sha = (text: string): string => createHash('sha256').update(text, 'utf8').digest('hex');
const rental = (): HandoverRecord => fixture('rental-return.json');
const field = (record: HandoverRecord, id: string): Field => {
  const found = record.fields.find((f) => f.id === id);
  if (found === undefined) throw new Error(`no field ${id}`);
  return found;
};
const photo = (record: HandoverRecord, index: number): Photo => record.photos[index] as Photo;

describe('diffRecords', () => {
  it('gives an empty list for equal records', () => {
    expect(diffRecords(rental(), rental())).toEqual([]);
  });

  it('gives an empty list when only the key order differs', () => {
    const a = rental();
    const b = JSON.parse(JSON.stringify(a), (_k, v: unknown) =>
      v !== null && typeof v === 'object' && !Array.isArray(v)
        ? Object.fromEntries(Object.entries(v as Record<string, unknown>).reverse())
        : v,
    ) as HandoverRecord;
    expect(diffRecords(a, b)).toEqual([]);
  });

  it('does not compare the seal', () => {
    const a = rental();
    const b = { ...rental(), seal: 'a'.repeat(64) };
    expect(canonicalText(a)).toBe(canonicalText(b));
    expect(diffRecords(a, b)).toEqual([]);
  });

  it('gives exactly one entry with the path fields.<id>.value for one changed field value', () => {
    const a = rental();
    const b = clone(a);
    field(b, 'mileage').value = '48210.6';
    expect(diffRecords(a, b)).toEqual([{ path: 'fields.mileage.value', a: '48210.5', b: '48210.6' }]);
  });

  it('gives null for a value that is null', () => {
    const a = rental();
    const b = clone(a);
    field(b, 'notes').value = null;
    expect(diffRecords(a, b)).toEqual([
      { path: 'fields.notes.value', a: 'Returned with a spare tyre and one key', b: null },
    ]);
  });

  it('reports a changed label, kind, unit, options and photoDigest each on its own path', () => {
    const a = rental();
    const b = clone(a);
    field(b, 'mileage').label = 'Distance';
    field(b, 'mileage').unit = 'mi';
    field(b, 'fuel').options = ['empty', 'full'];
    field(b, 'plate').kind = 'choice';
    field(b, 'photo-front').photoDigest = 'c'.repeat(64);
    expect(diffRecords(a, b)).toEqual([
      { path: 'fields.plate.kind', a: 'text', b: 'choice' },
      { path: 'fields.mileage.label', a: 'Mileage', b: 'Distance' },
      { path: 'fields.mileage.unit', a: 'km', b: 'mi' },
      { path: 'fields.fuel.options', a: '["empty","quarter","half","full"]', b: '["empty","full"]' },
      { path: 'fields.photo-front.photoDigest', a: photo(a, 0).digest, b: 'c'.repeat(64) },
    ]);
  });

  it('reports a field on one side only, with its canonical text', () => {
    const a = rental();
    const b = clone(a);
    const removed = b.fields.splice(1, 1)[0] as Field;
    expect(diffRecords(a, b)).toEqual([
      { path: 'fields.plate', a: '{"id":"plate","kind":"text","label":"Plate","value":"KW-4471"}', b: null },
    ]);
    expect(removed.id).toBe('plate');
    expect(diffRecords(b, a)).toEqual([
      { path: 'fields.plate', a: null, b: '{"id":"plate","kind":"text","label":"Plate","value":"KW-4471"}' },
    ]);
  });

  it('reports two fields in another order as fields.order', () => {
    const a = rental();
    const b = clone(a);
    [b.fields[0], b.fields[1]] = [b.fields[1] as Field, b.fields[0] as Field];
    expect(diffRecords(a, b)).toEqual([
      {
        path: 'fields.order',
        a: 'item,plate,mileage,fuel,damage,notes,photo-front,photo-rear',
        b: 'plate,item,mileage,fuel,damage,notes,photo-front,photo-rear',
      },
    ]);
  });

  it('reports a removed photo with its digest, not its data', () => {
    const a = rental();
    const b = clone(a);
    b.photos.pop();
    const result = diffRecords(a, b);
    expect(result).toEqual([{ path: `photos.${photo(a, 1).digest}`, a: photo(a, 1).digest, b: null }]);
    expect(JSON.stringify(result)).not.toContain(photo(a, 1).dataBase64);
  });

  it('reports an added photo', () => {
    const a = rental();
    const b = clone(a);
    b.photos.pop();
    expect(diffRecords(b, a)).toEqual([{ path: `photos.${photo(a, 1).digest}`, a: null, b: photo(a, 1).digest }]);
  });

  it('reports a changed photo width', () => {
    const a = rental();
    const b = clone(a);
    photo(b, 0).width = 20;
    expect(diffRecords(a, b)).toEqual([{ path: `photos.${photo(a, 0).digest}.width`, a: '16', b: '20' }]);
  });

  it('reports a changed photo mime and height', () => {
    const a = rental();
    const b = clone(a);
    (photo(b, 1) as { mime: string }).mime = 'image/png';
    photo(b, 1).height = 9;
    expect(diffRecords(a, b)).toEqual([
      { path: `photos.${photo(a, 1).digest}.mime`, a: 'image/jpeg', b: 'image/png' },
      { path: `photos.${photo(a, 1).digest}.height`, a: '16', b: '9' },
    ]);
  });

  it('reports changed photo data as the SHA-256 of the text, never the data', () => {
    const a = rental();
    const b = clone(a);
    photo(b, 0).dataBase64 = photo(a, 0).dataBase64.slice(0, -4) + 'AAAA';
    const result = diffRecords(a, b);
    expect(result).toEqual([
      {
        path: `photos.${photo(a, 0).digest}.dataBase64`,
        a: sha(photo(a, 0).dataBase64),
        b: sha(photo(b, 0).dataBase64),
      },
    ]);
    expect(JSON.stringify(result)).not.toContain(photo(a, 0).dataBase64);
  });

  it('reports photos in another order as photos.order', () => {
    const a = rental();
    const b = clone(a);
    b.photos.reverse();
    expect(diffRecords(a, b)).toEqual([
      { path: 'photos.order', a: `${photo(a, 0).digest},${photo(a, 1).digest}`, b: `${photo(a, 1).digest},${photo(a, 0).digest}` },
    ]);
  });

  it('reports a changed signature point as signatures.<party> with the SHA-256 of the strokes', () => {
    const a = rental();
    const b = clone(a);
    const giverA = a.signatures.find((s) => s.party === 'giver');
    const giverB = b.signatures.find((s) => s.party === 'giver');
    if (giverA === undefined || giverB === undefined) throw new Error('fixture');
    (giverB.strokes[0] as number[])[0] = (giverB.strokes[0] as number[])[0]! + 1;
    expect(diffRecords(a, b)).toEqual([
      { path: 'signatures.giver', a: sha(JSON.stringify(giverA.strokes)), b: sha(JSON.stringify(giverB.strokes)) },
    ]);
  });

  it('reports a signature on one side only', () => {
    const a = rental();
    const b = clone(a);
    b.signatures = b.signatures.filter((s) => s.party !== 'receiver');
    const receiver = a.signatures.find((s) => s.party === 'receiver');
    expect(diffRecords(a, b)).toEqual([
      { path: 'signatures.receiver', a: sha(JSON.stringify(receiver?.strokes)), b: null },
    ]);
  });

  it('reports signatures in another order as signatures.order', () => {
    const a = rental();
    const b = clone(a);
    b.signatures.reverse();
    expect(diffRecords(a, b)).toEqual([{ path: 'signatures.order', a: 'giver,receiver', b: 'receiver,giver' }]);
  });

  it('reports a changed form.templateId and form.title', () => {
    const a = rental();
    const b = clone(a);
    b.form.templateId = 'other';
    b.form.title = 'Other title';
    expect(diffRecords(a, b)).toEqual([
      { path: 'form.templateId', a: 'rental-return', b: 'other' },
      { path: 'form.title', a: 'Rental return', b: 'Other title' },
    ]);
  });

  it('reports format, sealedAt and the party names in the design order', () => {
    const a = rental();
    const b = clone(a);
    (b as { format: number }).format = 2;
    b.sealedAt = '2026-11-16T10:30:00Z';
    b.parties.giver = 'G';
    b.parties.receiver = 'R';
    expect(diffRecords(a, b)).toEqual([
      { path: 'format', a: '1', b: '2' },
      { path: 'sealedAt', a: null, b: '2026-11-16T10:30:00Z' },
      { path: 'parties.giver', a: 'Mara Oduya', b: 'G' },
      { path: 'parties.receiver', a: 'Tobin Larch', b: 'R' },
    ]);
  });

  it('reports a difference that the design paths do not name as record, so that it is never empty by mistake', () => {
    const a = rental();
    const b = { ...clone(a), note: 'extra' } as HandoverRecord;
    const result = diffRecords(a, b);
    expect(result).toEqual([{ path: 'record', a: sha(canonicalText(a)), b: sha(canonicalText(b)) }]);
  });

  it('is empty exactly when the canonical texts are equal', () => {
    const base = rental();
    const sealed = sealRecord(base, '2026-11-16T10:30:00Z');
    if (!sealed.ok) throw new Error('fixture');
    const variants: HandoverRecord[] = [clone(base), sealed.record];
    for (const mutate of [
      (r: HandoverRecord) => { field(r, 'item').value = 'x'; },
      (r: HandoverRecord) => { r.parties.giver += '!'; },
      (r: HandoverRecord) => { r.photos.pop(); },
      (r: HandoverRecord) => { r.signatures.pop(); },
      (r: HandoverRecord) => { r.fields.reverse(); },
      (r: HandoverRecord) => { delete (field(r, 'mileage') as { unit?: string }).unit; },
      (r: HandoverRecord) => { (field(r, 'notes') as { value: unknown }).value = undefined; },
    ]) {
      const m = clone(base);
      mutate(m);
      variants.push(m);
    }
    for (const x of variants) {
      for (const y of variants) {
        const empty = diffRecords(x, y).length === 0;
        expect(empty, `${canonicalText(x).length} vs ${canonicalText(y).length}`).toBe(canonicalText(x) === canonicalText(y));
      }
    }
  });
});
