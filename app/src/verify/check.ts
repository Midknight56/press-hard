import { parseCopyFile, sealWords, verifyRecord, type Difference, type HandoverRecord, type VerifyResult } from 'core';

export const VERDICT_TEXT: Record<VerifyResult, string> = {
  matches: 'Seal matches',
  changed: 'Changed after sealing',
  unsealed: 'This copy has no seal',
  wrong_seal: 'These words belong to another copy',
};

export const ERROR_TEXT = {
  no_record: 'This file is not a copy file',
  bad_json: 'This copy file cannot be read',
  bad_record: 'This copy file is not a valid record',
} as const;

export type Typed = { kind: 'none' } | { kind: 'seal'; seal: string } | { kind: 'words'; words: string };

const HEX64 = /^[0-9a-f]{64}$/;

/** Reads what the user typed or pasted: nothing, a full seal (64 hex characters) or seal words. */
export function parseTyped(text: string): Typed {
  const trimmed = text.trim().toLowerCase();
  if (trimmed === '') return { kind: 'none' };
  if (HEX64.test(trimmed)) return { kind: 'seal', seal: trimmed };
  const words = trimmed.split(/[\s,.\-_]+/).filter((w) => w !== '');
  if (words.length === 0) return { kind: 'none' };
  return { kind: 'words', words: words.join('-') };
}

export type Checked =
  | { ok: true; record: HandoverRecord; verdict: VerifyResult }
  | { ok: false; error: keyof typeof ERROR_TEXT; line: string };

/**
 * Reads the text of a copy file and checks it. A changed copy is `changed` whatever was typed. A
 * full seal goes to `verifyRecord` as the expected seal. Seal words are compared with `sealWords`
 * of the stored seal.
 */
export function checkCopy(text: string, typedText = ''): Checked {
  const parsed = parseCopyFile(text);
  if (!parsed.ok) return { ok: false, error: parsed.error, line: ERROR_TEXT[parsed.error] };
  const { record } = parsed;
  const typed = parseTyped(typedText);
  let verdict = verifyRecord(record, typed.kind === 'seal' ? typed.seal : undefined);
  if (verdict === 'matches' && typed.kind === 'words' && record.seal !== undefined) {
    if (sealWords(record.seal) !== typed.words) verdict = 'wrong_seal';
  }
  return { ok: true, record, verdict };
}

const LINE_PATH = /^fields\.([a-z0-9-]+)\.(value|label)$/;

/** A plain name for a part of a record that has no form line of its own. */
export function lineName(name: string): string {
  if (name === 'form.title') return 'Form title';
  if (name === 'sealedAt') return 'Time of sealing';
  if (name === 'signatures.giver') return 'Giver signature';
  if (name === 'signatures.receiver') return 'Receiver signature';
  if (name.startsWith('photos.')) return 'A photo';
  if (name.startsWith('fields.')) return 'A line of the form';
  return name;
}

/** Differences that belong on a form line, by field id, and every other difference in order. */
export function placeDifferences(differences: Difference[]): {
  lines: Map<string, Difference[]>;
  others: Difference[];
} {
  const lines = new Map<string, Difference[]>();
  const others: Difference[] = [];
  for (const difference of differences) {
    const match = LINE_PATH.exec(difference.path);
    if (match === null) {
      others.push(difference);
      continue;
    }
    const id = match[1] as string;
    lines.set(id, [...(lines.get(id) ?? []), difference]);
  }
  return { lines, others };
}
