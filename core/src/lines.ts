import { canonicalText } from './canonical.js';
import { sha256Hex } from './sha256.js';
import type { HandoverRecord } from './types.js';

/**
 * The line marks of a copy file: one SHA-256 for each line of the record, so that a single changed
 * file can show which line no longer matches. A line is a name, a field, a signature, a photo, the
 * form title or the time of sealing. The marks are not part of the seal. A person who edits the
 * marks too only hides the line; the seal still does not match.
 */

const LINE_NAME = /^[A-Za-z0-9.-]+$/;
const HEX64 = /^[0-9a-f]{64}$/;

const digest = (name: string, part: unknown): string =>
  sha256Hex(new TextEncoder().encode(`${name}:${canonicalText(part as HandoverRecord)}`));

/** Every line of a record with its digest, in form order. Takes a record that passed validateRecord. */
export function lineDigests(record: HandoverRecord): Array<[string, string]> {
  const lines: Array<[string, string]> = [
    ['form.title', digest('form.title', record.form.title)],
    ['parties.giver', digest('parties.giver', record.parties.giver)],
    ['parties.receiver', digest('parties.receiver', record.parties.receiver)],
  ];
  for (const field of record.fields) lines.push([`fields.${field.id}`, digest(`fields.${field.id}`, field)]);
  for (const photo of record.photos) lines.push([`photos.${photo.digest}`, digest(`photos.${photo.digest}`, photo)]);
  for (const signature of record.signatures) {
    lines.push([`signatures.${signature.party}`, digest(`signatures.${signature.party}`, signature)]);
  }
  lines.push(['sealedAt', digest('sealedAt', record.sealedAt)]);
  return lines;
}

/** The text of the data-lines attribute: name=digest pairs joined with ';'. It holds no record text. */
export function writeLineMarks(record: HandoverRecord): string {
  return lineDigests(record)
    .map(([name, hex]) => `${name}=${hex}`)
    .join(';');
}

/** Reads the marks. Returns null when the text is not marks. */
export function readLineMarks(text: string): Map<string, string> | null {
  const marks = new Map<string, string>();
  if (text === '') return marks;
  for (const pair of text.split(';')) {
    const at = pair.indexOf('=');
    const name = pair.slice(0, at);
    const hex = pair.slice(at + 1);
    if (at < 1 || !LINE_NAME.test(name) || !HEX64.test(hex) || marks.has(name)) return null;
    marks.set(name, hex);
  }
  return marks;
}

/** The lines whose digest differs from the marks: changed and added lines in form order, then removed lines. */
export function changedLines(record: HandoverRecord, marks: Map<string, string>): string[] {
  const now = lineDigests(record);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const [name, hex] of now) {
    seen.add(name);
    if (marks.get(name) !== hex) out.push(name);
  }
  for (const name of marks.keys()) if (!seen.has(name)) out.push(name);
  return out;
}
