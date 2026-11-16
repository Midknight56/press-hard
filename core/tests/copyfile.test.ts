import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
import {
  buildCopyFile,
  canonicalText,
  parseCopyFile,
  sealRecord,
  sealWords,
  verifyRecord,
} from '../src/index.js';
import type { HandoverRecord } from '../src/index.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixture = (name: string): HandoverRecord =>
  JSON.parse(readFileSync(resolve(here, 'fixtures', name), 'utf8')) as HandoverRecord;

const seal = (record: HandoverRecord): HandoverRecord => {
  const result = sealRecord(record, '2026-11-16T10:30:00Z');
  if (!result.ok) throw new Error(result.problems.join('; '));
  return result.record;
};
const sealedFixture = (name: string): HandoverRecord => seal(fixture(name));
const FIXTURES = ['rental-return.json', 'key-handover.json', 'sold-as-seen.json'];
const options = { title: 'Copy of a handover', paper: 'carbon' as const };

const count = (text: string, part: string): number => text.split(part).length - 1;

const RECORD_OPEN = '<script id="record" type="application/json">';
/** Replaces the first match of `from` inside the record element only, never in the visible page. */
const editRecordElement = (html: string, from: string, to: string): string => {
  const start = html.indexOf(RECORD_OPEN) + RECORD_OPEN.length;
  const end = html.indexOf('</script>', start);
  const json = html.slice(start, end);
  expect(json).toContain(from);
  return html.slice(0, start) + json.replace(from, to) + html.slice(end);
};

describe('buildCopyFile and parseCopyFile', () => {
  for (const name of FIXTURES) {
    it(`round trip of ${name} keeps the canonical text and the seal`, () => {
      const record = sealedFixture(name);
      const parsed = parseCopyFile(buildCopyFile(record, options));
      expect(parsed.ok).toBe(true);
      if (!parsed.ok) return;
      expect(canonicalText(parsed.record)).toBe(canonicalText(record));
      expect(parsed.record.seal).toBe(record.seal);
      expect(verifyRecord(parsed.record)).toBe('matches');
    });
  }

  it('builds one HTML document', () => {
    const html = buildCopyFile(sealedFixture('rental-return.json'), options);
    expect(html.startsWith('<!DOCTYPE html>')).toBe(true);
    expect(html.trimEnd().endsWith('</html>')).toBe(true);
    expect(html).toContain('<script id="record" type="application/json">');
    expect(html).toContain('<title>Copy of a handover</title>');
  });

  it('shows the seal words, the full seal, every field, photo and signature', () => {
    const record = sealedFixture('rental-return.json');
    const html = buildCopyFile(record, options);
    expect(html).toContain(sealWords(record.seal as string));
    expect(html).toContain(record.seal as string);
    expect(html).toContain('id="stamp"');
    for (const field of record.fields) expect(html, field.label).toContain(field.label);
    expect(html).toContain('Mara Oduya');
    expect(html).toContain('Tobin Larch');
    expect(html).toContain('48210.5');
    expect(count(html, '<img ')).toBe(record.photos.length);
    for (const photo of record.photos) {
      expect(count(html, `data:image/jpeg;base64,${photo.dataBase64}`)).toBe(1);
    }
    expect(count(html, '<svg ')).toBe(record.signatures.length);
  });

  it('shows an image once for each photo even when two fields name one photo', () => {
    const record = fixture('sold-as-seen.json');
    const photoField = record.fields.find((f) => f.kind === 'photo');
    if (photoField === undefined) throw new Error('fixture');
    record.fields.push({ ...photoField, id: 'photo-again' });
    expect(count(buildCopyFile(seal(record), options), '<img ')).toBe(1);
  });

  it('shows a photo that no field names', () => {
    const record = fixture('sold-as-seen.json');
    record.fields = record.fields.filter((f) => f.kind !== 'photo');
    expect(count(buildCopyFile(seal(record), options), '<img ')).toBe(1);
  });

  it('uses a different look for top and carbon paper', () => {
    const record = sealedFixture('key-handover.json');
    const top = buildCopyFile(record, { title: 'x', paper: 'top' });
    const carbon = buildCopyFile(record, { title: 'x', paper: 'carbon' });
    expect(top).not.toBe(carbon);
    expect(top).toContain('paper-top');
    expect(carbon).toContain('paper-carbon');
  });

  it('is the same text for the same input', () => {
    const record = sealedFixture('key-handover.json');
    expect(buildCopyFile(record, options)).toBe(buildCopyFile(record, options));
  });

  it('throws for a record that is not sealed or has problems (a mistake of the caller)', () => {
    expect(() => buildCopyFile(fixture('key-handover.json'), options)).toThrow();
    const bad = sealedFixture('key-handover.json');
    bad.fields[0] = { ...(bad.fields[0] as HandoverRecord['fields'][number]), id: 'Bad Id' };
    expect(() => buildCopyFile(bad, options)).toThrow();
  });
});

describe('text that tries to break the file', () => {
  const hostile = '</script><b>x';

  it('a text value with </script> builds a file that still parses to the same record', () => {
    const record = fixture('key-handover.json');
    record.fields.push({ id: 'evil', label: 'Evil', kind: 'text', value: hostile });
    const sealed = seal(record);
    const html = buildCopyFile(sealed, options);
    const parsed = parseCopyFile(html);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.record.fields.find((f) => f.id === 'evil')?.value).toBe(hostile);
    expect(canonicalText(parsed.record)).toBe(canonicalText(sealed));
    expect(count(html, '</script>')).toBe(2);
    expect(count(html, 'id="record"')).toBe(1);
  });

  it('writes every < of the embedded JSON as \\u003c', () => {
    const record = fixture('key-handover.json');
    record.fields.push({ id: 'evil', label: '<i>L</i>', kind: 'text', value: hostile });
    const html = buildCopyFile(seal(record), options);
    const start = html.indexOf('<script id="record" type="application/json">') + '<script id="record" type="application/json">'.length;
    const json = html.slice(start, html.indexOf('</script>', start));
    expect(json).not.toContain('<');
    expect(json).toContain('\\u003c');
  });

  it('escapes record text in the page body', () => {
    const record = fixture('key-handover.json');
    record.parties.giver = '<img src=x onerror=1> & "q"';
    record.fields.push({ id: 'evil', label: '<b>bold</b>', kind: 'text', value: '<u>under</u>' });
    const html = buildCopyFile(seal(record), options);
    expect(html).not.toContain('<b>bold</b>');
    expect(html).not.toContain('<u>under</u>');
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;b&gt;bold&lt;/b&gt;');
    expect(count(html, '<img ')).toBe(0);
  });

  it('escapes the page title', () => {
    const html = buildCopyFile(sealedFixture('key-handover.json'), { title: '</title><script>x', paper: 'top' });
    expect(html).toContain('<title>&lt;/title&gt;&lt;script&gt;x</title>');
  });
});

describe('no network', () => {
  for (const name of FIXTURES) {
    it(`${name} copy loads nothing from outside`, () => {
      const html = buildCopyFile(sealedFixture(name), options);
      expect(html).not.toMatch(/https?:\/\//i);
      expect(html).not.toMatch(/@import/i);
      expect(html).not.toMatch(/<link\b/i);
      expect(html).not.toMatch(/<script\b[^>]*\ssrc\b/i);
      expect(html).not.toMatch(/<iframe|<object|<embed|<form\b/i);
      const attributes = html.matchAll(/\b(?:src|href)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi);
      for (const match of attributes) {
        const value = match[1] ?? match[2] ?? match[3] ?? '';
        expect(value.startsWith('data:') || value.startsWith('#'), value.slice(0, 40)).toBe(true);
      }
      for (const match of html.matchAll(/url\(\s*(['"]?)([^)'"]*)/gi)) {
        const value = match[2] ?? '';
        expect(value.startsWith('data:') || value.startsWith('#'), value.slice(0, 40)).toBe(true);
      }
    });
  }
});

describe('parseCopyFile errors', () => {
  const wrap = (body: string): string =>
    `<!DOCTYPE html><html><body><script id="record" type="application/json">${body}</script></body></html>`;

  it('gives no_record for text with no record element', () => {
    for (const text of ['', 'hello', '<html><script>1</script></html>', '<script id="record" type="application/json">{']) {
      expect(parseCopyFile(text)).toEqual({ ok: false, error: 'no_record' });
    }
  });

  it('gives no_record when the input is not text', () => {
    expect(parseCopyFile(null as unknown as string)).toEqual({ ok: false, error: 'no_record' });
  });

  it('gives bad_json for JSON that does not parse', () => {
    expect(parseCopyFile(wrap('{"format": 1,'))).toEqual({ ok: false, error: 'bad_json' });
    expect(parseCopyFile(wrap(''))).toEqual({ ok: false, error: 'bad_json' });
  });

  it('gives bad_record with problems for a record that validateRecord refuses', () => {
    const result = parseCopyFile(wrap('{"format":2}'));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('bad_record');
    expect(result.problems?.some((p) => p.startsWith('format'))).toBe(true);
    const array = parseCopyFile(wrap('[]'));
    expect(array.ok === false && array.error === 'bad_record').toBe(true);
  });

  it('gives bad_record for a good file with a changed digest', () => {
    const record = sealedFixture('sold-as-seen.json');
    const html = buildCopyFile(record, options);
    const digest = (record.photos[0] as HandoverRecord['photos'][number]).digest;
    const wrong = html.replace(`"digest":"${digest}"`, `"digest":"${'0'.repeat(64)}"`);
    expect(wrong).not.toBe(html);
    const result = parseCopyFile(wrong);
    expect(result.ok === false && result.error === 'bad_record').toBe(true);
  });

  it('reads a record whose seal was changed as a record, so that verifyRecord can say changed', () => {
    const record = sealedFixture('key-handover.json');
    const html = editRecordElement(buildCopyFile(record, options), record.seal as string, 'f'.repeat(64));
    const result = parseCopyFile(html);
    expect(result.ok).toBe(true);
    if (result.ok) expect(verifyRecord(result.record)).toBe('changed');
  });
});

describe('inline check script, run in Node with a small fake document', () => {
  const MATCH = 'Seal matches this copy';
  const CHANGED = 'This copy was changed after sealing';

  const inlineScript = (html: string): string => {
    const found = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
    expect(found).toHaveLength(1);
    return (found[0] as RegExpMatchArray)[1] as string;
  };
  const recordText = (html: string): string => {
    const open = '<script id="record" type="application/json">';
    const start = html.indexOf(open) + open.length;
    return html.slice(start, html.indexOf('</script>', start));
  };
  const run = (html: string): string => {
    const stamp = { textContent: 'not run', className: '' };
    const elements: Record<string, { textContent: string }> = {
      stamp,
      record: { textContent: recordText(html) },
    };
    const document = { getElementById: (id: string) => elements[id] ?? null };
    runInNewContext(inlineScript(html), { document, TextEncoder });
    return stamp.textContent;
  };

  for (const name of FIXTURES) {
    it(`shows "${MATCH}" for a good ${name} copy`, () => {
      expect(run(buildCopyFile(sealedFixture(name), options))).toBe(MATCH);
    });
  }

  it('shows the changed text for a file with one changed character', () => {
    const html = buildCopyFile(sealedFixture('rental-return.json'), options);
    const changed = editRecordElement(html, 'Cargo van, white', 'Cargo van, whitf');
    expect(changed).not.toBe(html);
    expect(run(changed)).toBe(CHANGED);
  });

  it('shows the changed text for a changed number, a changed seal and a removed seal', () => {
    const record = sealedFixture('rental-return.json');
    const html = buildCopyFile(record, options);
    expect(run(editRecordElement(html, '"value":"48210.5"', '"value":"48210.6"'))).toBe(CHANGED);
    expect(run(editRecordElement(html, record.seal as string, '0'.repeat(64)))).toBe(CHANGED);
    expect(run(editRecordElement(html, `"seal":"${record.seal as string}"`, '"x":1'))).toBe(CHANGED);
  });

  it('shows the changed text when the record element holds text that is not JSON', () => {
    const html = buildCopyFile(sealedFixture('key-handover.json'), options);
    const open = '<script id="record" type="application/json">';
    const broken = html.replace(open, `${open}{broken `);
    expect(run(broken)).toBe(CHANGED);
  });

  it('gives the same answer as verifyRecord for a record with hostile text', () => {
    const record = fixture('key-handover.json');
    record.fields.push({ id: 'evil', label: '\u2028 é "q" \\', kind: 'text', value: '</script><b>x \u{1F600}' });
    expect(run(buildCopyFile(seal(record), options))).toBe(MATCH);
  });

  it('holds the check logic once: it is built from sha256.ts and canonical.ts', () => {
    const script = inlineScript(buildCopyFile(sealedFixture('key-handover.json'), options));
    expect(script).toContain('function sha256Hex(');
    expect(script).toContain('function canonicalText(');
    expect(script).not.toMatch(/\bimport\b|\bexport\b/);
  });

  it('is wired as pretest and prebuild of core', () => {
    const pkg = JSON.parse(readFileSync(resolve(here, '..', 'package.json'), 'utf8')) as {
      scripts: Record<string, string>;
    };
    expect(pkg.scripts.pretest).toContain('gen-check');
    expect(pkg.scripts.prebuild).toContain('gen-check');
  });
});
