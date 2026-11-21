import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildCopyFile, findChangedLines, parseCopyFile, sealRecord, verifyRecord, type HandoverRecord } from '../src/index.js';

// Blind test 2026-11-20: one changed copy file was checked alone and the check said "Changed after
// sealing" but marked no line. The copy file now keeps one mark for each line, so that a single file
// shows the line that no longer matches. The fixture is the tool loan of the testers.
const here = dirname(fileURLToPath(import.meta.url));
const record = JSON.parse(readFileSync(resolve(here, 'fixtures', 'tool-loan-one-line.json'), 'utf8')) as HandoverRecord;
const sealed = (() => {
  const result = sealRecord(record, '2026-11-20T09:00:00Z');
  if (!result.ok) throw new Error(result.problems.join('; '));
  return result.record;
})();
const html = buildCopyFile(sealed, { title: 'Press Hard', paper: 'carbon' });

const RECORD_OPEN = '<script id="record" type="application/json">';
const editRecordElement = (text: string, from: string, to: string): string => {
  const start = text.indexOf(RECORD_OPEN) + RECORD_OPEN.length;
  const end = text.indexOf('</script>', start);
  const json = text.slice(start, end);
  expect(json).toContain(from);
  return text.slice(0, start) + json.replace(from, to) + text.slice(end);
};

const parse = (text: string) => {
  const parsed = parseCopyFile(text);
  if (!parsed.ok) throw new Error(parsed.error);
  return { record: parsed.record, changedLines: findChangedLines(text, parsed.record) ?? undefined };
};

describe('line marks of a copy file', () => {
  it('a good copy has line marks and no changed line', () => {
    const parsed = parse(html);
    expect(verifyRecord(parsed.record)).toBe('matches');
    expect(parsed.changedLines).toEqual([]);
  });

  it('a name changed in every place of the file shows the receiver line', () => {
    const changed = html.split('Tobin Larch').join('Tobin Larsh');
    expect(changed).not.toBe(html);
    const parsed = parse(changed);
    expect(verifyRecord(parsed.record)).toBe('changed');
    expect(parsed.changedLines).toEqual(['parties.receiver']);
  });

  it('a value changed in the record shows that field line only', () => {
    const parsed = parse(editRecordElement(html, '"value":"Cordless drill"', '"value":"Cordless saw"'));
    expect(verifyRecord(parsed.record)).toBe('changed');
    expect(parsed.changedLines).toEqual(['fields.tool']);
  });

  it('a removed line and an added line are both shown', () => {
    const removed = parse(editRecordElement(html, ',{"id":"notes","label":"Notes","kind":"text","value":null}', ''));
    expect(removed.changedLines).toEqual(['fields.notes']);
    const added = parse(
      editRecordElement(html, '{"id":"notes",', '{"id":"extra","label":"Extra","kind":"text","value":"x"},{"id":"notes",'),
    );
    expect(added.changedLines).toEqual(['fields.extra']);
  });

  it('a changed time of sealing and a changed signature are named', () => {
    expect(parse(editRecordElement(html, '2026-11-20T09:00:00Z', '2026-11-21T09:00:00Z')).changedLines).toEqual(['sealedAt']);
    expect(parse(editRecordElement(html, '[100,600,', '[101,600,')).changedLines).toEqual(['signatures.giver']);
  });

  it('a copy made before line marks has no line list', () => {
    const old = html.replace(/ data-lines="[^"]*"/, '');
    expect(old).not.toBe(html);
    expect(parse(old).changedLines).toBeUndefined();
  });

  it('the marks hold only line names and hex digests, never record text', () => {
    const marks = /data-lines="([^"]*)"/.exec(html)?.[1] ?? '';
    expect(marks).toMatch(/^([A-Za-z0-9.-]+=[0-9a-f]{64})(;[A-Za-z0-9.-]+=[0-9a-f]{64})*$/);
    expect(marks).not.toContain('tobin');
  });
});
