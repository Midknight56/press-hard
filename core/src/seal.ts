import { canonicalText } from './canonical.js';
import { sha256Hex } from './sha256.js';
import type { HandoverRecord, VerifyResult } from './types.js';
import { isIsoTime, validateRecord } from './validate.js';
import { WORDS } from './words.js';

const HEX64 = /^[0-9a-f]{64}$/;

/** Four words joined with '-', picked by the first four bytes of the seal. Throws for a malformed seal. */
export function sealWords(seal: string): string {
  if (typeof seal !== 'string' || !HEX64.test(seal)) {
    throw new TypeError('sealWords: the seal must be 64 lower case hex characters');
  }
  const picked: string[] = [];
  for (let i = 0; i < 4; i++) {
    picked.push(WORDS[parseInt(seal.slice(i * 2, i * 2 + 2), 16)] as string);
  }
  return picked.join('-');
}

function computeSeal(record: HandoverRecord): string {
  return sha256Hex(new TextEncoder().encode(canonicalText(record)));
}

export function sealRecord(
  record: HandoverRecord,
  sealedAt: string,
): { ok: true; record: HandoverRecord } | { ok: false; problems: string[] } {
  const problems = validateRecord(record);
  if (!isIsoTime(sealedAt)) problems.push('sealedAt: must be ISO 8601 text');
  if (problems.length === 0 && record.seal !== undefined) problems.push('seal: the record is already sealed');
  if (problems.length > 0) return { ok: false, problems };
  const withTime: HandoverRecord = { ...record, sealedAt };
  delete withTime.seal;
  return { ok: true, record: { ...withTime, seal: computeSeal(withTime) } };
}

/** Takes a record that passed validateRecord. */
export function verifyRecord(record: HandoverRecord, expectedSeal?: string): VerifyResult {
  if (record.seal === undefined) return 'unsealed';
  if (computeSeal(record) !== record.seal) return 'changed';
  if (expectedSeal !== undefined && expectedSeal !== record.seal) return 'wrong_seal';
  return 'matches';
}
