import { createHash } from 'node:crypto';
import { runInNewContext } from 'node:vm';
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
import { WORDS } from '../src/words.js';

// Properties derived by hand from the acceptance criteria of
// .kiro/specs/record-core/requirements.md. The seven properties of the design
// are in properties.test.ts. These check something else. Each title ends with
// the requirement numbers.

const T = '2026-11-16T10:30:00Z';

const text = fc.oneof(
  fc.string({ unit: 'binary', maxLength: 15 }),
  fc.constantFrom('</script>', '<b>x</b>', '&amp;', '"', '\\', '\u2028', 'é', '\u{1F600}', 'seal'),
);
const idArb = fc
  .array(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789-'), { minLength: 1, maxLength: 6 })
  .map((c) => c.join(''));
const numberText = fc
  .tuple(fc.boolean(), fc.nat(100000), fc.option(fc.integer({ min: 0, max: 999 }).map((n) => String(n).padStart(3, '0')), { nil: undefined }))
  .map(([neg, whole, frac]) => `${neg && whole !== 0 ? '-' : ''}${whole}${frac === undefined ? '' : `.${frac}`}`);

const makePhoto = (bytes: Uint8Array, width: number, height: number): Photo => ({
  digest: createHash('sha256').update(bytes).digest('hex'),
  mime: 'image/jpeg',
  width,
  height,
  dataBase64: Buffer.from(bytes).toString('base64'),
});
const photoArb = fc
  .tuple(fc.uint8Array({ minLength: 1, maxLength: 40 }), fc.integer({ min: 1, max: 3000 }), fc.integer({ min: 1, max: 3000 }))
  .map(([b, w, h]) => makePhoto(b, w, h));
const strokeArb = fc
  .array(fc.tuple(fc.integer({ min: 0, max: 1000 }), fc.integer({ min: 0, max: 1000 })), { maxLength: 6 })
  .map((p) => p.flat());
const strokesArb = fc.array(strokeArb, { maxLength: 3 });

const unsealedArb: fc.Arbitrary<HandoverRecord> = fc
  .uniqueArray(photoArb, { maxLength: 2, selector: (p) => p.digest })
  .chain((photos) => {
    const textField = fc.tuple(text, fc.option(text, { nil: null })).map(([label, value]): Omit<Field, 'id'> => ({ label, kind: 'text', value }));
    const numberField = fc
      .tuple(text, numberText, fc.option(text, { nil: undefined }))
      .map(([label, value, unit]): Omit<Field, 'id'> => ({ label, kind: 'number', value, ...(unit === undefined ? {} : { unit }) }));
    const choiceField = fc
      .tuple(text, fc.uniqueArray(text, { minLength: 1, maxLength: 3 }), fc.nat())
      .map(([label, options, i]): Omit<Field, 'id'> => ({ label, kind: 'choice', options, value: options[i % options.length] as string }));
    const photoField = photos.map((p) => fc.constant<Omit<Field, 'id'>>({ label: 'p', kind: 'photo', value: null, photoDigest: p.digest }));
    return fc
      .tuple(
        fc.uniqueArray(fc.tuple(idArb, fc.oneof(textField, numberField, choiceField, ...photoField)), { maxLength: 5, selector: (t) => t[0] }),
        fc.option(strokesArb, { nil: undefined }),
        fc.option(strokesArb, { nil: undefined }),
        text,
        text,
        text,
        text,
      )
      .map(([pairs, giverStrokes, receiverStrokes, templateId, title, giver, receiver]): HandoverRecord => {
        const signatures: Signature[] = [];
        if (giverStrokes !== undefined) signatures.push({ party: 'giver', strokes: giverStrokes });
        if (receiverStrokes !== undefined) signatures.push({ party: 'receiver', strokes: receiverStrokes });
        return {
          format: 1,
          form: { templateId, title },
          sealedAt: null,
          parties: { giver, receiver },
          fields: pairs.map(([id, body]) => ({ id, ...body })),
          photos,
          signatures,
        };
      });
  });

const sealedArb = unsealedArb.map((record) => {
  const r = sealRecord(record, T);
  if (!r.ok) throw new Error(r.problems.join('; '));
  return r.record;
});

const clone = <V>(value: V): V => JSON.parse(JSON.stringify(value)) as V;
const utf8Sha = (s: string): string => createHash('sha256').update(Buffer.from(s, 'utf8')).digest('hex');
const hex64 = fc.uint8Array({ minLength: 32, maxLength: 32 }).map((b) => Buffer.from(b).toString('hex'));
const copyOptions = fc.record({ title: text, paper: fc.constantFrom('top' as const, 'carbon' as const) });
const RUNS = { numRuns: 60 };

describe('record (requirement 1)', () => {
  it('S1. validateRecord returns a list for any JSON value and never throws (1.2)', () => {
    fc.assert(
      fc.property(fc.anything(), (value) => {
        const problems = validateRecord(value);
        expect(Array.isArray(problems)).toBe(true);
        for (const p of problems) expect(typeof p).toBe('string');
      }),
    );
    fc.assert(
      fc.property(fc.anything({ withNullPrototype: true, withObjectString: true }), (value) => {
        expect(validateRecord(value).length).toBeGreaterThan(0);
      }),
    );
  });

  it('S2. one bad value gives a problem that names its path (1.2, 1.4, 1.5)', () => {
    const cases: Array<[string, (r: HandoverRecord) => void, string]> = [
      ['format', (r) => { (r as unknown as { format: number }).format = 2; }, 'format'],
      ['sealedAt', (r) => { r.sealedAt = '2026-13-01T00:00:00Z'; }, 'sealedAt'],
      ['seal', (r) => { r.seal = 'ABC'; }, 'seal'],
      ['id', (r) => { r.fields.push({ id: 'Bad Id', label: 'l', kind: 'text', value: null }); }, `fields[${'$N'}].id`],
      ['dup', (r) => { r.fields.push({ id: 'dup', label: 'l', kind: 'text', value: null }, { id: 'dup', label: 'l', kind: 'text', value: null }); }, 'fields['],
      ['choice', (r) => { r.fields.push({ id: 'zz', label: 'l', kind: 'choice', options: ['a'], value: 'b' }); }, `fields[${'$N'}].value`],
      ['number', (r) => { r.fields.push({ id: 'zz', label: 'l', kind: 'number', value: '1.2345' }); }, `fields[${'$N'}].value`],
      ['photoDigest', (r) => { r.fields.push({ id: 'zz', label: 'l', kind: 'photo', value: null, photoDigest: '0'.repeat(64) }); }, `fields[${'$N'}].photoDigest`],
      ['digest', (r) => { r.photos.push({ ...makePhoto(new Uint8Array([1, 2, 3]), 1, 1), digest: '1'.repeat(64) }); }, `photos[${'$P'}].digest`],
      ['odd stroke', (r) => { r.signatures = [{ party: 'giver', strokes: [[1, 2, 3]] }]; }, 'signatures[0].strokes[0]'],
      ['range', (r) => { r.signatures = [{ party: 'giver', strokes: [[1, 1001]] }]; }, 'signatures[0].strokes[0][1]'],
      ['fraction', (r) => { r.signatures = [{ party: 'giver', strokes: [[1.5, 1]] }]; }, 'signatures[0].strokes[0][0]'],
      ['two signatures', (r) => { r.signatures = [{ party: 'giver', strokes: [] }, { party: 'giver', strokes: [] }]; }, 'signatures[1].party'],
    ];
    fc.assert(
      fc.property(unsealedArb, fc.nat(), (base, pick) => {
        const [, mutate, template] = cases[pick % cases.length] as (typeof cases)[number];
        const r = clone(base);
        const n = r.fields.length;
        const p = r.photos.length;
        mutate(r);
        const path = template.replace('$N', String(n)).replace('$P', String(p));
        const problems = validateRecord(r);
        expect(problems.some((x) => x.startsWith(path))).toBe(true);
      }),
    );
  });

  it('S3. every limit is good exactly at its number and refused one over (1.3)', () => {
    const tiny = (i: number): Photo => makePhoto(new Uint8Array([i, i >> 8, 7]), 1, 1);
    const empty = (): HandoverRecord => ({
      format: 1, form: { templateId: 't', title: 'x' }, sealedAt: null, parties: { giver: 'a', receiver: 'b' },
      fields: [], photos: [], signatures: [],
    });
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 45 }), (count) => {
        const r = empty();
        for (let i = 0; i < count; i++) r.fields.push({ id: `f${i}`, label: 'l', kind: 'text', value: null });
        expect(validateRecord(r).some((p) => p.startsWith('fields:'))).toBe(count > 40);
      }),
    );
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 9 }), (count) => {
        const r = empty();
        for (let i = 0; i < count; i++) r.photos.push(tiny(i));
        expect(validateRecord(r).some((p) => p.startsWith('photos:'))).toBe(count > 6);
      }),
    );
    fc.assert(
      fc.property(fc.integer({ min: 480, max: 520 }), fc.constantFrom('title', 'templateId', 'giver', 'receiver', 'label', 'value', 'unit', 'option'), (length, where) => {
        const r = empty();
        const s = 'x'.repeat(length);
        if (where === 'title') r.form.title = s;
        else if (where === 'templateId') r.form.templateId = s;
        else if (where === 'giver') r.parties.giver = s;
        else if (where === 'receiver') r.parties.receiver = s;
        else if (where === 'label') r.fields.push({ id: 'a', label: s, kind: 'text', value: null });
        else if (where === 'value') r.fields.push({ id: 'a', label: 'l', kind: 'text', value: s });
        else if (where === 'unit') r.fields.push({ id: 'a', label: 'l', kind: 'number', value: '1', unit: s });
        else r.fields.push({ id: 'a', label: 'l', kind: 'choice', options: [s], value: null });
        expect(validateRecord(r).length > 0).toBe(length > 500);
      }),
    );
    fc.assert(
      fc.property(fc.integer({ min: 3990, max: 4010 }), fc.integer({ min: 1, max: 4 }), (points, strokeCount) => {
        const r = empty();
        const strokes: number[][] = [];
        let left = points;
        for (let s = 0; s < strokeCount; s++) {
          const here = s === strokeCount - 1 ? left : Math.floor(points / strokeCount);
          strokes.push(Array.from({ length: here * 2 }, () => 5));
          left -= here;
        }
        r.signatures = [{ party: 'giver', strokes }];
        expect(validateRecord(r).length > 0).toBe(points > 4000);
      }),
      { numRuns: 30 },
    );
    for (const [length, refused] of [[1_500_000, false], [1_500_004, true]] as const) {
      const bytes = new Uint8Array((length / 4) * 3).fill(9);
      const r = empty();
      r.photos.push(makePhoto(bytes, 1, 1));
      expect(validateRecord(r).length > 0).toBe(refused);
    }
  });
});

describe('canonical text (requirement 2)', () => {
  it('S4. keys are sorted at every level, arrays keep their order, no space is added, and the text is the record without its seal (2.1, 2.3)', () => {
    const sortedEverywhere = (value: unknown): boolean => {
      if (Array.isArray(value)) return value.every(sortedEverywhere);
      if (value !== null && typeof value === 'object') {
        const keys = Object.keys(value);
        const sorted = [...keys].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
        return keys.every((k, i) => k === sorted[i]) && Object.values(value).every(sortedEverywhere);
      }
      return true;
    };
    fc.assert(
      fc.property(sealedArb, (sealed) => {
        const canon = canonicalText(sealed);
        const parsed = JSON.parse(canon) as Record<string, unknown>;
        expect(sortedEverywhere(parsed)).toBe(true);
        expect('seal' in parsed).toBe(false);
        const rest = clone(sealed);
        delete rest.seal;
        expect(parsed).toEqual(rest);
        expect(canon).toBe(JSON.stringify(parsed));
      }),
      RUNS,
    );
  });

  it('S5. the seal key never changes the canonical text (2.3)', () => {
    fc.assert(
      fc.property(unsealedArb, hex64, (record, seal) => {
        expect(canonicalText({ ...record, seal })).toBe(canonicalText(record));
      }),
    );
  });

  it('S6. reordering the fields changes the canonical text (2.1, 2.2)', () => {
    fc.assert(
      fc.property(unsealedArb, (record) => {
        fc.pre(record.fields.length >= 2);
        const swapped = clone(record);
        swapped.fields.reverse();
        expect(canonicalText(swapped)).not.toBe(canonicalText(record));
      }),
    );
  });
});

describe('SHA-256 (requirement 3)', () => {
  it('S7. the result is 64 lower case hex characters, does not change the input, and is right at the block edges (3.1, 3.3)', () => {
    const edges = [0, 1, 54, 55, 56, 57, 63, 64, 65, 119, 120, 121, 127, 128, 129, 191, 192, 1000];
    fc.assert(
      fc.property(fc.constantFrom(...edges), fc.integer(), (length, seed) => {
        const bytes = Uint8Array.from({ length }, (_, i) => (Math.imul(i + 1, 2654435761) ^ seed) & 255);
        const before = Uint8Array.from(bytes);
        const out = sha256Hex(bytes);
        expect(out).toMatch(/^[0-9a-f]{64}$/);
        expect(out).toBe(createHash('sha256').update(bytes).digest('hex'));
        expect(bytes).toEqual(before);
      }),
    );
  });
});

describe('seal and seal words (requirement 4)', () => {
  it('S8. the seal is the SHA-256 of the UTF-8 canonical text and sealing changes only sealedAt and seal (4.1)', () => {
    fc.assert(
      fc.property(unsealedArb, fc.constantFrom(T, '2024-02-29T00:00:00+02:00', '2026-02-28T23:59:59.123Z'), (record, time) => {
        const result = sealRecord(record, time);
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        const sealed = result.record;
        expect(sealed.sealedAt).toBe(time);
        expect(sealed.seal).toBe(utf8Sha(canonicalText({ ...record, sealedAt: time })));
        expect(sealed.seal).toBe(utf8Sha(canonicalText(sealed)));
        expect({ ...sealed, sealedAt: null, seal: undefined }).toEqual({ ...record, seal: undefined });
        expect(verifyRecord(sealed)).toBe('matches');
        expect(validateRecord(sealed)).toEqual([]);
      }),
    );
  });

  it('S9. sealing is refused for a sealed record, a bad time and a record with problems (4.2)', () => {
    const badTimes = ['', 'yesterday', '2026-11-16', '2026-11-16T10:30:00', '2026-02-30T10:30:00Z', '2026-11-16T25:00:00Z', ' 2026-11-16T10:30:00Z'];
    fc.assert(
      fc.property(sealedArb, unsealedArb, fc.constantFrom(...badTimes), (sealed, unsealed, bad) => {
        const again = sealRecord(sealed, T);
        expect(again.ok).toBe(false);
        expect(sealRecord(unsealed, bad).ok).toBe(false);
        const broken = clone(unsealed);
        broken.format = 2 as unknown as 1;
        expect(sealRecord(broken, T).ok).toBe(false);
        const refused = sealRecord(sealed, bad);
        expect(refused.ok).toBe(false);
      }),
      RUNS,
    );
  });

  it('S10. seal words are four words of the list, one for each of the first four bytes (4.3, 4.4)', () => {
    expect(WORDS).toHaveLength(256);
    expect(new Set(WORDS).size).toBe(256);
    for (const w of WORDS) expect(w).toMatch(/^[a-z]{3,6}$/);
    fc.assert(
      fc.property(hex64, (seal) => {
        const parts = sealWords(seal).split('-');
        expect(parts).toHaveLength(4);
        for (let i = 0; i < 4; i++) expect(parts[i]).toBe(WORDS[parseInt(seal.slice(i * 2, i * 2 + 2), 16)]);
      }),
    );
  });
});

describe('copy file (requirement 5)', () => {
  it('S11. the file shows the seal, the seal words, one image for each photo and one svg for each signature, and the JSON holds no < (5.1, 5.2)', () => {
    fc.assert(
      fc.property(sealedArb, copyOptions, (record, opts) => {
        const html = buildCopyFile(record, opts);
        expect(html).toContain(record.seal as string);
        expect(html).toContain(sealWords(record.seal as string));
        expect(html.split('id="stamp"').length - 1).toBe(1);
        expect(html.split('<img ').length - 1).toBe(record.photos.length);
        expect(html.split('<svg ').length - 1).toBe(record.signatures.length);
        const open = '<script id="record" type="application/json">';
        const start = html.indexOf(open) + open.length;
        const json = html.slice(start, html.indexOf('</script>', start));
        expect(json).not.toContain('<');
        expect(JSON.parse(json)).toEqual(record);
      }),
      RUNS,
    );
  });

  it('S12. the file loads nothing from the network (5.3)', () => {
    fc.assert(
      fc.property(sealedArb, copyOptions, (record, opts) => {
        const html = buildCopyFile(record, opts);
        expect(html).not.toMatch(/https?:\/\//i);
        expect(html).not.toMatch(/@import/i);
        expect(html).not.toMatch(/<link[\s>]/i);
        expect(html).not.toMatch(/<script[^>]*\ssrc\s*=/i);
        for (const m of html.matchAll(/\s(?:src|href)\s*=\s*"([^"]*)"/gi)) {
          expect((m[1] as string).startsWith('data:') || (m[1] as string).startsWith('#')).toBe(true);
        }
        for (const m of html.matchAll(/url\(\s*['"]?([^'")]*)/gi)) {
          expect((m[1] as string).startsWith('data:') || (m[1] as string).startsWith('#')).toBe(true);
        }
      }),
      RUNS,
    );
  });

  it('S13. the inline check script agrees with verifyRecord for a good file and for a file with one changed field (5.4)', () => {
    const runStamp = (html: string): string => {
      const script = ([...html.matchAll(/<script>([\s\S]*?)<\/script>/g)][0] as RegExpMatchArray)[1] as string;
      const open = '<script id="record" type="application/json">';
      const start = html.indexOf(open) + open.length;
      const stamp = { textContent: 'not run', className: '' };
      const elements: Record<string, { textContent: string }> = {
        stamp,
        record: { textContent: html.slice(start, html.indexOf('</script>', start)) },
      };
      runInNewContext(script, { document: { getElementById: (id: string) => elements[id] ?? null }, TextEncoder });
      return stamp.textContent;
    };
    fc.assert(
      fc.property(sealedArb, copyOptions, (record, opts) => {
        expect(runStamp(buildCopyFile(record, opts))).toBe('Seal matches this copy');
        const changed = clone(record);
        changed.parties.giver += 'x';
        const html = buildCopyFile({ ...changed, seal: record.seal }, opts);
        expect(verifyRecord(changed)).toBe('changed');
        expect(runStamp(html)).toBe('This copy was changed after sealing');
      }),
      { numRuns: 25 },
    );
  });

  it('S14. parseCopyFile returns a typed result for any text and never throws (5.5)', () => {
    fc.assert(
      fc.property(fc.string({ unit: 'binary', maxLength: 200 }), (s) => {
        const r = parseCopyFile(s);
        if (!r.ok) expect(['no_record', 'bad_json', 'bad_record']).toContain(r.error);
      }),
    );
    const open = '<script id="record" type="application/json">';
    fc.assert(
      fc.property(fc.string({ maxLength: 60 }), fc.string({ maxLength: 20 }), (junk, around) => {
        let json = true;
        try { JSON.parse(junk); } catch { json = false; }
        fc.pre(!json);
        expect(parseCopyFile(`${around}${open}${junk}</script>`)).toEqual({ ok: false, error: 'bad_json' });
        expect(parseCopyFile(around.split(open).join(''))).toEqual({ ok: false, error: 'no_record' });
      }),
    );
  });

  it('S15. a record element with a refused record gives bad_record with problems, and a good one gives the same record (5.5)', () => {
    const open = '<script id="record" type="application/json">';
    fc.assert(
      fc.property(sealedArb, copyOptions, (record, opts) => {
        const html = buildCopyFile(record, opts);
        const start = html.indexOf(open) + open.length;
        const end = html.indexOf('</script>', start);
        const broken = clone(record);
        broken.format = 9 as unknown as 1;
        const bad = parseCopyFile(html.slice(0, start) + JSON.stringify(broken).replace(/</g, '\\u003c') + html.slice(end));
        expect(bad.ok).toBe(false);
        if (!bad.ok) {
          expect(bad.error).toBe('bad_record');
          expect(bad.problems?.length).toBeGreaterThan(0);
        }
        expect(parseCopyFile(html)).toEqual({ ok: true, record });
      }),
      RUNS,
    );
  });
});

describe('check and compare (requirement 6)', () => {
  it('S16. an expected seal changes only a record that matches (6.1, 6.2)', () => {
    fc.assert(
      fc.property(sealedArb, hex64, (sealed, other) => {
        fc.pre(other !== sealed.seal);
        expect(verifyRecord(sealed, sealed.seal)).toBe('matches');
        expect(verifyRecord(sealed, other)).toBe('wrong_seal');
        const changed = clone(sealed);
        changed.form.title += 'x';
        expect(verifyRecord(changed, other)).toBe('changed');
        expect(verifyRecord(changed, sealed.seal)).toBe('changed');
        const unsealed = clone(sealed);
        delete unsealed.seal;
        expect(verifyRecord(unsealed)).toBe('unsealed');
        expect(verifyRecord(unsealed, other)).toBe('unsealed');
        expect(verifyRecord(unsealed, sealed.seal)).toBe('unsealed');
        const forged = { ...sealed, seal: other };
        expect(verifyRecord(forged)).toBe('changed');
      }),
    );
  });

  it('S17. a diff swaps its sides when the records swap, and never holds image data (6.3)', () => {
    fc.assert(
      fc.property(sealedArb, sealedArb, (a, b) => {
        const ab = diffRecords(a, b);
        const ba = diffRecords(b, a);
        expect(ba.map((d) => d.path).sort()).toEqual(ab.map((d) => d.path).sort());
        for (const d of ab) {
          const mirror = ba.find((e) => e.path === d.path);
          expect(mirror).toEqual({ path: d.path, a: d.b, b: d.a });
        }
        const data = [...a.photos, ...b.photos].map((p) => p.dataBase64);
        for (const d of ab) {
          for (const v of [d.a, d.b]) if (v !== null && v.length >= 8) expect(data).not.toContain(v);
          if (d.path.startsWith('photos.')) for (const v of [d.a, d.b]) expect(v === null || /^[0-9a-f]{64}$/.test(v)).toBe(true);
        }
      }),
      RUNS,
    );
  });

  it('S18. a diff names each single change by its path (6.3)', () => {
    fc.assert(
      fc.property(unsealedArb, fc.constantFrom('giver', 'receiver', 'title', 'templateId', 'time', 'drop-field', 'drop-photo', 'add-photo', 'signature'), photoArb, (record, what, extra) => {
        const b = clone(record);
        let path: string;
        if (what === 'giver' || what === 'receiver') { b.parties[what] += 'x'; path = `parties.${what}`; }
        else if (what === 'title' || what === 'templateId') { b.form[what] += 'x'; path = `form.${what}`; }
        else if (what === 'time') { b.sealedAt = T; path = 'sealedAt'; }
        else if (what === 'drop-field') {
          fc.pre(b.fields.length > 0);
          const gone = b.fields.pop() as Field;
          fc.pre(gone.kind !== 'photo');
          path = `fields.${gone.id}`;
        } else if (what === 'drop-photo') {
          fc.pre(b.photos.length > 0 && !b.fields.some((f) => f.kind === 'photo'));
          path = `photos.${(b.photos.pop() as Photo).digest}`;
        } else if (what === 'add-photo') {
          fc.pre(!b.photos.some((p) => p.digest === extra.digest));
          b.photos.push(extra);
          path = `photos.${extra.digest}`;
        } else {
          const s = b.signatures.find((x) => x.party === 'giver');
          if (s === undefined) b.signatures.push({ party: 'giver', strokes: [[1, 2]] });
          else s.strokes.push([1, 2]);
          path = 'signatures.giver';
        }
        const result = diffRecords(record, b);
        expect(result.map((d) => d.path)).toEqual([path]);
      }),
    );
  });

  it('S19. the diff is empty exactly when the canonical texts are equal, also across seal and key order (6.4, 2.3)', () => {
    fc.assert(
      fc.property(sealedArb, hex64, (sealed, otherSeal) => {
        const bare = clone(sealed);
        delete bare.seal;
        expect(diffRecords(sealed, bare)).toEqual([]);
        expect(diffRecords(sealed, { ...sealed, seal: otherSeal })).toEqual([]);
        const reordered = Object.fromEntries(Object.entries(sealed).reverse()) as unknown as HandoverRecord;
        expect(canonicalText(reordered)).toBe(canonicalText(sealed));
        expect(diffRecords(sealed, reordered)).toEqual([]);
      }),
    );
  });
});
