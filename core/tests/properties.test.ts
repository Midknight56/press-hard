import { createHash } from 'node:crypto';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  buildCopyFile,
  canonicalText,
  diffRecords,
  parseCopyFile,
  sealRecord,
  sealWords,
  sha256Hex,
  validateRecord,
  verifyRecord,
} from '../src/index.js';
import type { Field, HandoverRecord, Photo, Signature } from '../src/index.js';

// ---------------------------------------------------------------------------
// Generators. They make valid records with at most 6 fields and photos of at
// most 64 bytes. Each photo digest is the real SHA-256 of the photo bytes.
// ---------------------------------------------------------------------------

const HOSTILE = ['</script>', '<script>', '<!--', '-->', '<b>x</b>', '&amp;', '"', "'", '\\', '\u2028', '\u2029', 'é', '\u{1F600}', '\n'];

const text: fc.Arbitrary<string> = fc.oneof(
  { weight: 3, arbitrary: fc.string({ unit: 'binary', maxLength: 20 }) },
  { weight: 1, arbitrary: fc.constantFrom(...HOSTILE) },
  {
    weight: 1,
    arbitrary: fc
      .tuple(fc.string({ maxLength: 5 }), fc.constantFrom(...HOSTILE), fc.string({ maxLength: 5 }))
      .map((parts) => parts.join('')),
  },
);

const idChars = [...'abcdefghijklmnopqrstuvwxyz0123456789-'];
const idArb = fc.array(fc.constantFrom(...idChars), { minLength: 1, maxLength: 8 }).map((c) => c.join(''));

const numberText = fc
  .tuple(
    fc.boolean(),
    fc.nat(1_000_000),
    fc.option(fc.array(fc.integer({ min: 0, max: 9 }), { minLength: 1, maxLength: 3 }).map((d) => d.join('')), { nil: undefined }),
  )
  .map(([negative, whole, fraction]) => `${negative ? '-' : ''}${whole}${fraction === undefined ? '' : `.${fraction}`}`);

const photoArb: fc.Arbitrary<Photo> = fc
  .tuple(fc.uint8Array({ maxLength: 64 }), fc.integer({ min: 1, max: 4000 }), fc.integer({ min: 1, max: 4000 }))
  .map(([bytes, width, height]) => ({
    digest: createHash('sha256').update(bytes).digest('hex'),
    mime: 'image/jpeg' as const,
    width,
    height,
    dataBase64: Buffer.from(bytes).toString('base64'),
  }));

const photosArb = fc.uniqueArray(photoArb, { maxLength: 3, selector: (p) => p.digest });

const fieldBody = (digests: string[]): fc.Arbitrary<Omit<Field, 'id'>> => {
  const textField = fc
    .tuple(text, fc.option(text, { nil: null }))
    .map(([label, value]): Omit<Field, 'id'> => ({ label, kind: 'text', value }));
  const choiceField = fc
    .tuple(text, fc.uniqueArray(text, { minLength: 1, maxLength: 3 }))
    .chain(([label, options]) =>
      fc.option(fc.constantFrom(...options), { nil: null }).map((value): Omit<Field, 'id'> => ({ label, kind: 'choice', value, options })),
    );
  const numberField = fc
    .tuple(text, fc.option(numberText, { nil: null }), fc.option(text, { nil: undefined }))
    .map(([label, value, unit]): Omit<Field, 'id'> => ({ label, kind: 'number', value, ...(unit === undefined ? {} : { unit }) }));
  const photoField =
    digests.length === 0
      ? []
      : [
          fc
            .tuple(text, fc.constantFrom(...digests))
            .map(([label, photoDigest]): Omit<Field, 'id'> => ({ label, kind: 'photo', value: null, photoDigest })),
        ];
  return fc.oneof(textField, choiceField, numberField, ...photoField);
};

const strokeArb = fc
  .array(fc.tuple(fc.integer({ min: 0, max: 1000 }), fc.integer({ min: 0, max: 1000 })), { maxLength: 8 })
  .map((points) => points.flat());

const signaturesArb: fc.Arbitrary<Signature[]> = fc
  .tuple(
    fc.option(fc.array(strokeArb, { maxLength: 3 }), { nil: undefined }),
    fc.option(fc.array(strokeArb, { maxLength: 3 }), { nil: undefined }),
  )
  .map(([giver, receiver]) => {
    const result: Signature[] = [];
    if (giver !== undefined) result.push({ party: 'giver', strokes: giver });
    if (receiver !== undefined) result.push({ party: 'receiver', strokes: receiver });
    return result;
  });

const TIMES = ['2026-11-16T10:30:00Z', '2026-02-28T23:59:59.123Z', '2024-02-29T00:00:00+02:00'];

/** A valid record that is not sealed. */
const unsealedArb: fc.Arbitrary<HandoverRecord> = photosArb.chain((photos) =>
  fc
    .tuple(
      fc.uniqueArray(fc.tuple(idArb, fieldBody(photos.map((p) => p.digest))), { maxLength: 6, selector: (t) => t[0] }),
      signaturesArb,
      text,
      text,
      text,
      text,
    )
    .map(([fieldPairs, signatures, templateId, title, giver, receiver]): HandoverRecord => ({
      format: 1,
      form: { templateId, title },
      sealedAt: null,
      parties: { giver, receiver },
      fields: fieldPairs.map(([id, body]) => ({ id, ...body })),
      photos,
      signatures,
    })),
);

const sealedArb: fc.Arbitrary<HandoverRecord> = fc.tuple(unsealedArb, fc.constantFrom(...TIMES)).map(([record, time]) => {
  const result = sealRecord(record, time);
  if (!result.ok) throw new Error(`generator made a record that cannot be sealed: ${result.problems.join('; ')}`);
  return result.record;
});

const clone = (record: HandoverRecord): HandoverRecord => JSON.parse(JSON.stringify(record)) as HandoverRecord;

/** Rebuilds every object with its keys in another order, chosen by the seed. */
const shuffleKeys = (value: unknown, seed: number): unknown => {
  if (Array.isArray(value)) return value.map((item) => shuffleKeys(item, seed));
  if (value !== null && typeof value === 'object') {
    const hash = (key: string): number => {
      let h = seed | 0;
      for (let i = 0; i < key.length; i++) h = (Math.imul(h, 31) + key.charCodeAt(i)) | 0;
      return h;
    };
    const entries = Object.entries(value).map(([key, item]) => [key, shuffleKeys(item, seed)] as const);
    entries.sort((a, b) => hash(a[0]) - hash(b[0]) || (a[0] < b[0] ? -1 : 1));
    return Object.fromEntries(entries);
  }
  return value;
};

const options = fc.record({ title: text, paper: fc.constantFrom('top' as const, 'carbon' as const) });

describe('generators', () => {
  it('make valid records, sealed and unsealed', () => {
    fc.assert(
      fc.property(unsealedArb, sealedArb, (unsealed, sealed) => {
        expect(validateRecord(unsealed)).toEqual([]);
        expect(validateRecord(sealed)).toEqual([]);
        expect(unsealed.fields.length).toBeLessThanOrEqual(6);
        for (const photo of sealed.photos) expect(photo.dataBase64.length).toBeLessThanOrEqual(88);
      }),
    );
  });
});

describe('properties of the record core', () => {
  it('1. key order does not matter', () => {
    fc.assert(
      fc.property(unsealedArb, fc.integer(), (record, seed) => {
        const shuffled = shuffleKeys(record, seed) as HandoverRecord;
        expect(canonicalText(shuffled)).toBe(canonicalText(record));
        const a = sealRecord(record, TIMES[0] as string);
        const b = sealRecord(shuffled, TIMES[0] as string);
        expect(a.ok && b.ok).toBe(true);
        if (a.ok && b.ok) {
          expect(b.record.seal).toBe(a.record.seal);
          const reshuffled = shuffleKeys(a.record, seed + 1) as HandoverRecord;
          expect(verifyRecord(reshuffled)).toBe('matches');
        }
      }),
    );
  });

  it('2. any change breaks the seal', () => {
    fc.assert(
      fc.property(sealedArb, fc.nat(), (sealed, pick) => {
        const mutators: Array<(r: HandoverRecord) => void> = [
          (r) => { r.parties.giver += 'x'; },
          (r) => { r.parties.receiver += 'x'; },
          (r) => { r.form.title += 'x'; },
        ];
        if (sealed.fields.length > 0) {
          mutators.push((r) => { const f = r.fields[0] as Field; f.label += 'x'; });
          mutators.push((r) => {
            const f = r.fields.find((x) => x.kind !== 'photo');
            if (f === undefined) r.fields[0] = { ...(r.fields[0] as Field), label: (r.fields[0] as Field).label + 'y' };
            else f.value = (f.value ?? '') + 'x';
          });
        }
        if (sealed.photos.length > 0) {
          mutators.push((r) => {
            const photo = r.photos[0] as Photo;
            const bytes = Buffer.from(photo.dataBase64, 'base64');
            if (bytes.length > 0) {
              bytes[0] = (bytes[0] as number) ^ 1;
              photo.dataBase64 = bytes.toString('base64');
            } else {
              photo.dataBase64 = 'AAAA';
            }
          });
        }
        mutators.push((r) => {
          const signature = r.signatures[0];
          const stroke = signature?.strokes[0];
          if (signature === undefined) r.signatures.push({ party: 'giver', strokes: [[1, 2]] });
          else if (stroke === undefined || stroke.length === 0) signature.strokes.push([1, 2]);
          else stroke[0] = (stroke[0] as number) === 1000 ? 999 : (stroke[0] as number) + 1;
        });
        const changed = clone(sealed);
        (mutators[pick % mutators.length] as (r: HandoverRecord) => void)(changed);
        expect(canonicalText(changed)).not.toBe(canonicalText(sealed));
        expect(verifyRecord(changed)).toBe('changed');
        expect(verifyRecord(sealed)).toBe('matches');
      }),
    );
  });

  it('3. copy file round trip', () => {
    fc.assert(
      fc.property(sealedArb, options, (record, opts) => {
        const parsed = parseCopyFile(buildCopyFile(record, opts));
        expect(parsed.ok).toBe(true);
        if (!parsed.ok) return;
        expect(canonicalText(parsed.record)).toBe(canonicalText(record));
        expect(verifyRecord(parsed.record)).toBe('matches');
      }),
    );
  });

  it('4. own SHA-256 equals the platform SHA-256', () => {
    fc.assert(
      fc.property(fc.uint8Array({ maxLength: 5000 }), (bytes) => {
        expect(sha256Hex(bytes)).toBe(createHash('sha256').update(bytes).digest('hex'));
      }),
    );
  });

  it('5. script safety: one record element and the same value back', () => {
    const hostile = fc.oneof(
      text,
      fc.tuple(fc.string({ maxLength: 10 }), fc.constantFrom('</script>', '</SCRIPT >', '<!--<script>', '\u003c/script>')).map((p) => p.join('')),
    );
    fc.assert(
      fc.property(sealedArb, hostile, options, (base, value, opts) => {
        const record = clone(base);
        delete record.seal;
        record.sealedAt = null;
        const evilField: Field = { id: 'evil', label: value, kind: 'text', value };
        record.fields = [evilField, ...record.fields.filter((f) => f.id !== 'evil')].slice(0, 6);
        const sealed = sealRecord(record, TIMES[0] as string);
        expect(sealed.ok).toBe(true);
        if (!sealed.ok) return;
        const html = buildCopyFile(sealed.record, opts);
        expect(html.split('id="record"').length - 1).toBe(1);
        expect(html.split('</script>').length - 1).toBe(2);
        const parsed = parseCopyFile(html);
        expect(parsed.ok).toBe(true);
        if (!parsed.ok) return;
        const evil = parsed.record.fields.find((f) => f.id === 'evil');
        expect(evil?.value).toBe(value);
        expect(evil?.label).toBe(value);
        expect(verifyRecord(parsed.record)).toBe('matches');
      }),
    );
  });

  it('6. diff is exact', () => {
    fc.assert(
      fc.property(sealedArb, sealedArb, (a, b) => {
        expect(diffRecords(a, clone(a))).toEqual([]);
        expect(diffRecords(a, b).length === 0).toBe(canonicalText(a) === canonicalText(b));
        expect(diffRecords(b, a).length === 0).toBe(canonicalText(a) === canonicalText(b));
      }),
    );
    fc.assert(
      fc.property(unsealedArb, fc.nat(), (record, pick) => {
        const candidates = record.fields.filter((f) => f.kind !== 'photo');
        fc.pre(candidates.length > 0);
        const target = candidates[pick % candidates.length] as Field;
        const changed = clone(record);
        const changedField = changed.fields.find((f) => f.id === target.id) as Field;
        changedField.value = (target.value ?? '') + 'x';
        const result = diffRecords(record, changed);
        expect(result).toHaveLength(1);
        expect(result[0]).toEqual({ path: `fields.${target.id}.value`, a: target.value, b: changedField.value });
      }),
    );
  });

  it('7. seal words follow the first four bytes of the seal', () => {
    const bytes32 = fc.uint8Array({ minLength: 32, maxLength: 32 });
    const hex = (bytes: Uint8Array): string => Buffer.from(bytes).toString('hex');
    fc.assert(
      fc.property(bytes32, bytes32, fc.integer({ min: 0, max: 3 }), fc.integer({ min: 1, max: 255 }), (a, tail, index, delta) => {
        const same = Uint8Array.from([...a.slice(0, 4), ...tail.slice(4)]);
        expect(sealWords(hex(same))).toBe(sealWords(hex(a)));
        const other = Uint8Array.from(a);
        other[index] = ((a[index] as number) + delta) % 256;
        expect(sealWords(hex(other))).not.toBe(sealWords(hex(a)));
      }),
    );
  });
});
