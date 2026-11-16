import { readFileSync, statSync } from 'node:fs';
import { diffRecords, parseCopyFile, sealWords, verifyRecord } from 'core';
import type { Difference, HandoverRecord, VerifyResult } from 'core';

export const MAX_BYTES = 20 * 1_048_576;

export type ErrorCode =
  | 'bad_args'
  | 'not_found'
  | 'not_a_file'
  | 'too_large'
  | 'no_record'
  | 'bad_json'
  | 'bad_record';

export interface ToolError {
  code: ErrorCode;
  message: string;
}
export type ToolResult<T> = { ok: true; value: T } | { ok: false; error: ToolError };

export interface VerifyOutput {
  result: VerifyResult;
  seal: string | null;
  sealWords: string | null;
  sealedAt: string | null;
  title: string;
  giver: string;
  receiver: string;
  photos: number;
}
export interface DiffOutput {
  equal: boolean;
  differences: Difference[];
}

const fail = (code: ErrorCode, message: string): { ok: false; error: ToolError } => ({
  ok: false,
  error: { code, message },
});

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const pathArg = (args: Record<string, unknown>, name: string): string | ToolError => {
  const value = args[name];
  if (typeof value !== 'string' || value === '') {
    return { code: 'bad_args', message: `${name} must be a non-empty text` };
  }
  return value;
};

/** Reads one copy file. Only reads: no file is created or changed. */
const loadCopy = (path: string): ToolResult<HandoverRecord> => {
  let size: number;
  try {
    const info = statSync(path);
    if (!info.isFile()) return fail('not_a_file', `not a file: ${path}`);
    size = info.size;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT' || code === 'ENOTDIR') return fail('not_found', `not found: ${path}`);
    throw error;
  }
  if (size > MAX_BYTES) return fail('too_large', `over 20 MB: ${path}`);
  const parsed = parseCopyFile(readFileSync(path, 'utf8'));
  if (!parsed.ok) {
    const detail = parsed.problems && parsed.problems.length > 0 ? `: ${parsed.problems.join('; ')}` : '';
    return fail(parsed.error, `${parsed.error} in ${path}${detail}`);
  }
  return { ok: true, value: parsed.record };
};

export const verifyCopy = (args: unknown): ToolResult<VerifyOutput> => {
  if (!isObject(args)) return fail('bad_args', 'arguments must be an object');
  const path = pathArg(args, 'path');
  if (typeof path !== 'string') return { ok: false, error: path };
  const expected = args.expectedSeal;
  if (expected !== undefined && typeof expected !== 'string') {
    return fail('bad_args', 'expectedSeal must be text');
  }
  const loaded = loadCopy(path);
  if (!loaded.ok) return loaded;
  const record = loaded.value;
  const result = verifyRecord(record, expected);
  const hasSeal = typeof record.seal === 'string';
  return {
    ok: true,
    value: {
      result,
      seal: hasSeal ? (record.seal as string) : null,
      sealWords: hasSeal ? sealWords(record.seal as string) : null,
      sealedAt: hasSeal ? record.sealedAt : null,
      title: record.form.title,
      giver: record.parties.giver,
      receiver: record.parties.receiver,
      photos: record.photos.length,
    },
  };
};

export const diffCopies = (args: unknown): ToolResult<DiffOutput> => {
  if (!isObject(args)) return fail('bad_args', 'arguments must be an object');
  const pathA = pathArg(args, 'pathA');
  if (typeof pathA !== 'string') return { ok: false, error: pathA };
  const pathB = pathArg(args, 'pathB');
  if (typeof pathB !== 'string') return { ok: false, error: pathB };
  const a = loadCopy(pathA);
  if (!a.ok) return a;
  const b = loadCopy(pathB);
  if (!b.ok) return b;
  const differences = diffRecords(a.value, b.value);
  return { ok: true, value: { equal: differences.length === 0, differences } };
};