import { diffRecords, validateRecord, verifyRecord, type Difference, type HandoverRecord, type VerifyResult } from 'core';
import { placeDifferences } from './verify/check.js';

/** A copy of a record in memory. The original is never written. */
export function duplicate(record: HandoverRecord): HandoverRecord {
  return structuredClone(record);
}

export type EditResult = { ok: true; record: HandoverRecord } | { ok: false; line: string };

/**
 * Sets the value of one line of a duplicate: a field id, or `giver` or `receiver`. Returns a new
 * record that keeps the original seal, so that checking it must give `changed`. Takes nothing
 * that `validateRecord` refuses.
 */
export function editLine(record: HandoverRecord, line: string, value: string): EditResult {
  const next = structuredClone(record);
  if (line === 'giver' || line === 'receiver') {
    next.parties[line] = value;
  } else {
    const field = next.fields.find((f) => f.id === line);
    if (field === undefined) return { ok: false, line: 'This line is not on the form' };
    if (field.kind === 'photo') return { ok: false, line: 'A photo line cannot be edited here' };
    field.value = value === '' ? null : value;
  }
  const problems = validateRecord(next);
  if (problems.length > 0) return { ok: false, line: `${line}: this value is not allowed` };
  return { ok: true, record: next };
}

export interface DuplicateCheck {
  verdict: VerifyResult;
  /** Ids of the lines that differ from the original: field ids, `giver`, `receiver`. */
  marked: string[];
  differences: Difference[];
}

/** Verifies the duplicate against its own (original) seal and compares it with the original. */
export function checkDuplicate(original: HandoverRecord, edited: HandoverRecord): DuplicateCheck {
  const differences = diffRecords(original, edited);
  const placed = placeDifferences(differences);
  const marked = [...placed.lines.keys()];
  for (const d of placed.others) {
    const party = /^parties\.(giver|receiver)$/.exec(d.path);
    if (party !== null && !marked.includes(party[1] as string)) marked.push(party[1] as string);
  }
  return { verdict: verifyRecord(edited), marked, differences };
}
