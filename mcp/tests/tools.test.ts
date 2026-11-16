import { createHash } from 'node:crypto';
import {
  closeSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  truncateSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildCopyFile, sealRecord, sealWords } from 'core';
import type { HandoverRecord } from 'core';
import { diffCopies, verifyCopy } from '../src/tools.js';

const fixture = (name: string): HandoverRecord =>
  JSON.parse(
    readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../../core/tests/fixtures', name), 'utf8'),
  ) as HandoverRecord;

const sealed = (record: HandoverRecord): HandoverRecord => {
  const result = sealRecord(record, '2026-11-16T10:00:00Z');
  if (!result.ok) throw new Error(result.problems.join('; '));
  return result.record;
};

const options = { title: 'Copy', paper: 'top' } as const;

let dir: string;
let good: string;
let changed: string;
let unsealed: string;
let goodRecord: HandoverRecord;

/** Every file and folder under dir with its size, change time and content hash. */
const snapshot = (): string[] => {
  const out: string[] = [];
  const walk = (folder: string): void => {
    for (const name of readdirSync(folder).sort()) {
      const full = join(folder, name);
      const info = statSync(full);
      if (info.isDirectory()) {
        out.push(`${full} dir ${info.mtimeMs}`);
        walk(full);
      } else {
        const hash = info.size > 1_000_000 ? 'big' : createHash('sha256').update(readFileSync(full)).digest('hex');
        out.push(`${full} ${info.size} ${info.mtimeMs} ${hash}`);
      }
    }
  };
  walk(dir);
  return out;
};

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'press-hard-mcp-'));
  goodRecord = sealed(fixture('rental-return.json'));
  good = join(dir, 'good.html');
  writeFileSync(good, buildCopyFile(goodRecord, options));
  const altered: HandoverRecord = structuredClone(goodRecord);
  const mileage = altered.fields.find((f) => f.id === 'mileage');
  if (!mileage) throw new Error('fixture has no mileage field');
  mileage.value = '99999';
  changed = join(dir, 'changed.html');
  writeFileSync(changed, buildCopyFile(altered, options));
  unsealed = join(dir, 'unsealed.html');
  // buildCopyFile refuses an unsealed record, so cut the seal out of the record element of a sealed copy.
  const bare: HandoverRecord = structuredClone(sealed(fixture('key-handover.json')));
  delete bare.seal;
  bare.sealedAt = null;
  const open = '<script id="record" type="application/json">';
  const html = buildCopyFile(sealed(fixture('key-handover.json')), options);
  const start = html.indexOf(open) + open.length;
  const end = html.indexOf('</script>', start);
  writeFileSync(unsealed, html.slice(0, start) + JSON.stringify(bare).replace(/</g, '\\u003c') + html.slice(end));
  mkdirSync(join(dir, 'folder'));
  writeFileSync(join(dir, 'plain.html'), '<html><body>no record here</body></html>');
  writeFileSync(
    join(dir, 'badjson.html'),
    '<html><script id="record" type="application/json">{not json</script></html>',
  );
  writeFileSync(
    join(dir, 'badrecord.html'),
    '<html><script id="record" type="application/json">{"format":1}</script></html>',
  );
});

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

const errorOf = (result: { ok: boolean }): string => {
  if (result.ok) throw new Error('expected an error result');
  return (result as { ok: false; error: { code: string } }).error.code;
};

describe('verify_copy', () => {
  it('returns matches with seal, words, time, title, parties and photo count', () => {
    const result = verifyCopy({ path: good });
    expect(result).toEqual({
      ok: true,
      value: {
        result: 'matches',
        seal: goodRecord.seal,
        sealWords: sealWords(goodRecord.seal as string),
        sealedAt: '2026-11-16T10:00:00Z',
        title: goodRecord.form.title,
        giver: goodRecord.parties.giver,
        receiver: goodRecord.parties.receiver,
        photos: 2,
      },
    });
  });

  it('returns changed for a copy edited after sealing', () => {
    const result = verifyCopy({ path: changed });
    expect(result.ok && result.value.result).toBe('changed');
  });

  it('returns unsealed with null seal, words and time', () => {
    const result = verifyCopy({ path: unsealed });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.result).toBe('unsealed');
    expect(result.value.seal).toBeNull();
    expect(result.value.sealWords).toBeNull();
    expect(result.value.sealedAt).toBeNull();
    expect(result.value.photos).toBe(0);
  });

  it('returns wrong_seal for another expected seal and matches for the right one', () => {
    const other = verifyCopy({ path: good, expectedSeal: 'a'.repeat(64) });
    expect(other.ok && other.value.result).toBe('wrong_seal');
    const right = verifyCopy({ path: good, expectedSeal: goodRecord.seal });
    expect(right.ok && right.value.result).toBe('matches');
  });

  it('returns no photo data', () => {
    const text = JSON.stringify(verifyCopy({ path: good }));
    for (const photo of goodRecord.photos) expect(text).not.toContain(photo.dataBase64);
  });

  it('gives bad_args when the path is missing or not text', () => {
    expect(errorOf(verifyCopy({}))).toBe('bad_args');
    expect(errorOf(verifyCopy(undefined))).toBe('bad_args');
    expect(errorOf(verifyCopy({ path: 5 }))).toBe('bad_args');
    expect(errorOf(verifyCopy({ path: '' }))).toBe('bad_args');
    expect(errorOf(verifyCopy({ path: good, expectedSeal: 5 }))).toBe('bad_args');
  });

  it('gives not_found, not_a_file, no_record, bad_json and bad_record', () => {
    expect(errorOf(verifyCopy({ path: join(dir, 'missing.html') }))).toBe('not_found');
    expect(errorOf(verifyCopy({ path: join(dir, 'folder') }))).toBe('not_a_file');
    expect(errorOf(verifyCopy({ path: join(dir, 'plain.html') }))).toBe('no_record');
    expect(errorOf(verifyCopy({ path: join(dir, 'badjson.html') }))).toBe('bad_json');
    expect(errorOf(verifyCopy({ path: join(dir, 'badrecord.html') }))).toBe('bad_record');
  });

  it('gives too_large one byte over 20 MB and reads a file of exactly 20 MB', () => {
    const limit = 20 * 1_048_576;
    const exact = join(dir, 'exact.bin');
    const over = join(dir, 'over.bin');
    for (const [file, size] of [
      [exact, limit],
      [over, limit + 1],
    ] as const) {
      closeSync(openSync(file, 'w'));
      truncateSync(file, size);
    }
    expect(errorOf(verifyCopy({ path: exact }))).toBe('no_record');
    expect(errorOf(verifyCopy({ path: over }))).toBe('too_large');
    rmSync(exact);
    rmSync(over);
  });
});

describe('diff_copies', () => {
  it('returns equal true and an empty list for the same copy twice', () => {
    expect(diffCopies({ pathA: good, pathB: good })).toEqual({ ok: true, value: { equal: true, differences: [] } });
  });

  it('returns the one difference fields.mileage.value for the changed copy', () => {
    const result = diffCopies({ pathA: good, pathB: changed });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.equal).toBe(false);
    expect(result.value.differences).toHaveLength(1);
    expect(result.value.differences[0]?.path).toBe('fields.mileage.value');
    expect(result.value.differences[0]?.b).toBe('99999');
  });

  it('gives bad_args when a path is missing', () => {
    expect(errorOf(diffCopies({ pathA: good }))).toBe('bad_args');
    expect(errorOf(diffCopies({ pathB: good }))).toBe('bad_args');
    expect(errorOf(diffCopies(null))).toBe('bad_args');
  });

  it('reports the error code of the file that fails', () => {
    expect(errorOf(diffCopies({ pathA: good, pathB: join(dir, 'missing.html') }))).toBe('not_found');
    expect(errorOf(diffCopies({ pathA: join(dir, 'plain.html'), pathB: good }))).toBe('no_record');
    expect(errorOf(diffCopies({ pathA: join(dir, 'folder'), pathB: good }))).toBe('not_a_file');
    expect(errorOf(diffCopies({ pathA: good, pathB: join(dir, 'badjson.html') }))).toBe('bad_json');
    expect(errorOf(diffCopies({ pathA: good, pathB: join(dir, 'badrecord.html') }))).toBe('bad_record');
  });
});

describe('no file is written', () => {
  it('leaves the same files with the same times after every call', () => {
    const before = snapshot();
    const paths = [good, changed, unsealed, join(dir, 'missing.html'), join(dir, 'folder'), join(dir, 'plain.html')];
    for (const path of paths) {
      verifyCopy({ path });
      verifyCopy({ path, expectedSeal: 'b'.repeat(64) });
      diffCopies({ pathA: path, pathB: good });
    }
    verifyCopy({});
    diffCopies({});
    expect(snapshot()).toEqual(before);
  });
});