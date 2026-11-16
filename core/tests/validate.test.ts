import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { validateRecord } from '../src/index.js';
import type { Field, HandoverRecord, Photo, Signature } from '../src/index.js';

const fixture = (name: string): HandoverRecord =>
  JSON.parse(
    readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), 'fixtures', name), 'utf8'),
  ) as HandoverRecord;

const makePhoto = (bytes: Uint8Array): Photo => ({
  digest: createHash('sha256').update(bytes).digest('hex'),
  mime: 'image/jpeg',
  width: 16,
  height: 16,
  dataBase64: Buffer.from(bytes).toString('base64'),
});

/** A small photo that differs for each n. */
const smallPhoto = (n: number): Photo => makePhoto(new Uint8Array([0xff, 0xd8, n & 255, n >> 8, 1, 2, 3]));

const textField = (id: string, value = 'x'): Field => ({ id, label: id, kind: 'text', value });

const base = (): HandoverRecord => fixture('key-handover.json');
const withField = (record: HandoverRecord, field: Partial<Field> & { id: string }): HandoverRecord => ({
  ...record,
  fields: [...record.fields, { label: field.id, kind: 'text', value: 'x', ...field }],
});
const mustHaveProblemAt = (value: unknown, path: string): void => {
  const problems = validateRecord(value);
  expect(problems.some((p) => p.includes(path)), `${path} in ${JSON.stringify(problems)}`).toBe(true);
};

describe('fixtures', () => {
  for (const name of ['rental-return.json', 'key-handover.json', 'sold-as-seen.json']) {
    it(`${name} has no problem`, () => {
      expect(validateRecord(fixture(name))).toEqual([]);
    });
  }
});

describe('input that is not a record', () => {
  for (const value of [null, undefined, 5, 'text', [], {}]) {
    it(`gives problems and does not throw for ${JSON.stringify(value)}`, () => {
      expect(validateRecord(value).length).toBeGreaterThan(0);
    });
  }
});

describe('limits of requirement 1.3', () => {
  it('40 fields are good, 41 are refused', () => {
    const make = (n: number): HandoverRecord => ({
      ...base(),
      fields: Array.from({ length: n }, (_, i) => textField(`f${i}`)),
    });
    expect(validateRecord(make(40))).toEqual([]);
    mustHaveProblemAt(make(41), 'fields');
  });

  it('6 photos are good, 7 are refused', () => {
    const make = (n: number): HandoverRecord => ({
      ...base(),
      photos: Array.from({ length: n }, (_, i) => smallPhoto(i)),
    });
    expect(validateRecord(make(6))).toEqual([]);
    mustHaveProblemAt(make(7), 'photos');
  });

  it('a photo of 1,500,000 base64 characters is good, 1,500,001 is refused', () => {
    const bytes = new Uint8Array(1_125_000).map((_, i) => (i * 31 + 7) % 256);
    const good = makePhoto(bytes);
    expect(good.dataBase64).toHaveLength(1_500_000);
    expect(validateRecord({ ...base(), photos: [good] })).toEqual([]);
    const over = { ...good, dataBase64: good.dataBase64 + 'A' };
    mustHaveProblemAt({ ...base(), photos: [over] }, 'photos[0].dataBase64');
  });

  const textPlaces: Array<[string, (record: HandoverRecord, text: string) => HandoverRecord, string]> = [
    ['form title', (r, t) => ({ ...r, form: { ...r.form, title: t } }), 'form.title'],
    ['giver name', (r, t) => ({ ...r, parties: { ...r.parties, giver: t } }), 'parties.giver'],
    ['receiver name', (r, t) => ({ ...r, parties: { ...r.parties, receiver: t } }), 'parties.receiver'],
    ['field label', (r, t) => withField(r, { id: 'extra', label: t }), 'fields[5].label'],
    ['field value', (r, t) => withField(r, { id: 'extra', value: t }), 'fields[5].value'],
    ['field unit', (r, t) => withField(r, { id: 'extra', kind: 'number', value: '1', unit: t }), 'fields[5].unit'],
    [
      'field option',
      (r, t) => withField(r, { id: 'extra', kind: 'choice', value: 'a', options: ['a', t] }),
      'fields[5].options[1]',
    ],
  ];
  for (const [name, apply, path] of textPlaces) {
    it(`a ${name} of 500 characters is good, 501 is refused`, () => {
      expect(validateRecord(apply(base(), 'x'.repeat(500)))).toEqual([]);
      mustHaveProblemAt(apply(base(), 'x'.repeat(501)), path);
    });
  }

  it('a signature of 4000 points is good, 4001 is refused', () => {
    const make = (points: number): HandoverRecord => {
      const stroke = Array.from({ length: points * 2 }, (_, i) => i % 1001);
      const signature: Signature = { party: 'giver', strokes: [stroke] };
      return { ...base(), signatures: [signature] };
    };
    expect(validateRecord(make(4000))).toEqual([]);
    mustHaveProblemAt(make(4001), 'signatures[0]');
  });

  it('4000 points counted over several strokes are good, 4001 are refused', () => {
    const make = (points: number): HandoverRecord => ({
      ...base(),
      signatures: [
        { party: 'giver', strokes: [new Array(2000).fill(5), new Array((points - 1000) * 2).fill(6)] },
      ],
    });
    expect(validateRecord(make(4000))).toEqual([]);
    mustHaveProblemAt(make(4001), 'signatures[0]');
  });
});

describe('photo fields (requirement 1.4)', () => {
  it('refuses a photo field whose photoDigest matches no photo', () => {
    const record = withField(fixture('sold-as-seen.json'), {
      id: 'orphan',
      kind: 'photo',
      value: null,
      photoDigest: 'a'.repeat(64),
    });
    mustHaveProblemAt(record, 'fields[6].photoDigest');
  });

  it('refuses a photo field with no photoDigest', () => {
    mustHaveProblemAt(withField(base(), { id: 'orphan', kind: 'photo', value: null }), 'fields[5].photoDigest');
  });

  it('refuses a photo field with a value', () => {
    const record = fixture('sold-as-seen.json');
    const last = record.fields[5] as Field;
    record.fields[5] = { ...last, value: 'text' };
    mustHaveProblemAt(record, 'fields[5].value');
  });
});

describe('other refusals (requirement 1.5)', () => {
  for (const id of ['Upper', 'under_score', 'sp ace', '', 'ü']) {
    it(`refuses the field id ${JSON.stringify(id)}`, () => {
      mustHaveProblemAt(withField(base(), { id }), 'fields[5].id');
    });
  }

  it('accepts a field id of letters, digits and dashes', () => {
    expect(validateRecord(withField(base(), { id: 'a-1-b' }))).toEqual([]);
  });

  it('refuses a field id used twice', () => {
    mustHaveProblemAt(withField(base(), { id: 'meter' }), 'fields[5].id');
  });

  it('refuses a choice value that is not one of its options', () => {
    mustHaveProblemAt(
      withField(base(), { id: 'c', kind: 'choice', value: 'maybe', options: ['yes', 'no'] }),
      'fields[5].value',
    );
  });

  it('refuses a choice value when there are no options', () => {
    mustHaveProblemAt(withField(base(), { id: 'c', kind: 'choice', value: 'yes' }), 'fields[5].value');
  });

  for (const value of ['1.2345', 'abc', '1e3', '', ' 1', '1.', '.5', 'NaN', 'Infinity', '--1']) {
    it(`refuses the number text ${JSON.stringify(value)}`, () => {
      mustHaveProblemAt(withField(base(), { id: 'n', kind: 'number', value }), 'fields[5].value');
    });
  }

  for (const value of ['0', '12', '-3', '1.5', '0.001', '48210.500', '-0.25']) {
    it(`accepts the number text ${JSON.stringify(value)}`, () => {
      expect(validateRecord(withField(base(), { id: 'n', kind: 'number', value }))).toEqual([]);
    });
  }

  it('refuses a number that is not text', () => {
    const record = withField(base(), { id: 'n', kind: 'number' });
    (record.fields[5] as unknown as { value: unknown }).value = 5;
    mustHaveProblemAt(record, 'fields[5].value');
  });

  it('refuses a photo whose digest is not the SHA-256 of its bytes', () => {
    const record = fixture('sold-as-seen.json');
    const photo = record.photos[0] as Photo;
    const wrong = 'b'.repeat(64);
    record.photos[0] = { ...photo, digest: wrong };
    mustHaveProblemAt(record, 'photos[0].digest');
  });

  it('refuses a photo whose bytes changed but whose digest did not', () => {
    const record = fixture('sold-as-seen.json');
    const photo = record.photos[0] as Photo;
    const bytes = Buffer.from(photo.dataBase64, 'base64');
    bytes[bytes.length - 3] = (bytes[bytes.length - 3] as number) ^ 1;
    record.photos[0] = { ...photo, dataBase64: bytes.toString('base64') };
    mustHaveProblemAt(record, 'photos[0].digest');
  });

  it('refuses a photo whose data is not base64', () => {
    const record = fixture('sold-as-seen.json');
    record.photos[0] = { ...(record.photos[0] as Photo), dataBase64: '!!!not base64!!!' };
    mustHaveProblemAt(record, 'photos[0].dataBase64');
  });

  it('refuses a digest used twice', () => {
    const record = fixture('sold-as-seen.json');
    record.photos = [record.photos[0] as Photo, record.photos[0] as Photo];
    mustHaveProblemAt(record, 'photos[1].digest');
  });

  it('refuses a photo with a mime other than image/jpeg', () => {
    const record = fixture('sold-as-seen.json');
    record.photos[0] = { ...(record.photos[0] as Photo), mime: 'image/png' as 'image/jpeg' };
    mustHaveProblemAt(record, 'photos[0].mime');
  });

  it('refuses a stroke with an odd count of numbers', () => {
    const record = { ...base(), signatures: [{ party: 'giver' as const, strokes: [[1, 2, 3]] }] };
    mustHaveProblemAt(record, 'signatures[0].strokes[0]');
  });

  for (const bad of [-1, 1001, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
    it(`refuses the stroke number ${String(bad)}`, () => {
      const record = { ...base(), signatures: [{ party: 'giver' as const, strokes: [[0, bad]] }] };
      mustHaveProblemAt(record, 'signatures[0].strokes[0][1]');
    });
  }

  it('accepts stroke numbers 0 and 1000', () => {
    const record = { ...base(), signatures: [{ party: 'giver' as const, strokes: [[0, 1000, 1000, 0]] }] };
    expect(validateRecord(record)).toEqual([]);
  });

  it('refuses more than one signature for one party', () => {
    const record = base();
    record.signatures = [
      { party: 'giver', strokes: [[1, 2]] },
      { party: 'giver', strokes: [[3, 4]] },
    ];
    mustHaveProblemAt(record, 'signatures[1].party');
  });

  it('refuses a signature party that is not giver or receiver', () => {
    const record = { ...base(), signatures: [{ party: 'witness', strokes: [] }] };
    mustHaveProblemAt(record, 'signatures[0].party');
  });

  for (const sealedAt of ['yesterday', '2026-13-01T00:00:00Z', '2026-02-30T00:00:00Z', '2026-11-16', 5, '']) {
    it(`refuses sealedAt ${JSON.stringify(sealedAt)}`, () => {
      mustHaveProblemAt({ ...base(), sealedAt }, 'sealedAt');
    });
  }

  for (const sealedAt of ['2026-11-16T10:30:00Z', '2026-11-16T10:30:00.123Z', '2026-11-16T10:30:00+02:00', null]) {
    it(`accepts sealedAt ${JSON.stringify(sealedAt)}`, () => {
      expect(validateRecord({ ...base(), sealedAt })).toEqual([]);
    });
  }

  for (const seal of ['A'.repeat(64), 'a'.repeat(63), 'a'.repeat(65), 'g'.repeat(64), 5]) {
    it(`refuses the seal ${JSON.stringify(seal)}`, () => {
      mustHaveProblemAt({ ...base(), seal }, 'seal');
    });
  }

  it('accepts a seal of 64 lower case hex characters', () => {
    expect(validateRecord({ ...base(), seal: 'ab01'.repeat(16) })).toEqual([]);
  });

  it('refuses a format other than 1', () => {
    mustHaveProblemAt({ ...base(), format: 2 }, 'format');
  });

  it('does not throw for a record with wrong types inside', () => {
    const wrong = { format: 1, form: 5, sealedAt: null, parties: null, fields: [null, 5, {}], photos: [1], signatures: [{ strokes: 3 }] };
    expect(validateRecord(wrong).length).toBeGreaterThan(0);
  });
});
