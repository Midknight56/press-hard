import type { HandoverRecord } from 'core';
import { sealRecord } from 'core';
import { createStamp } from '../stamp.js';
import type { Store } from '../store.js';

export const HOLD_MS = 1200;

export interface PressOptions {
  source: { stampButton: HTMLElement; getRecord(): HandoverRecord; isLocked(): boolean };
  store: Store;
  /** The device clock. */
  now: () => Date;
  reducedMotion: boolean;
  onSealed(record: HandoverRecord): void;
  /** One line that names the first problem. */
  onProblem(line: string): void;
  audio?: { stamp(): void };
}

/** Turns a problem text of `validateRecord` into one line that names the form line. */
export function describeProblem(record: HandoverRecord, problem: string): string {
  const split = /^([^:]+): (.*)$/s.exec(problem);
  if (split === null) return problem;
  const path = split[1] as string;
  const message = split[2] as string;
  const field = /^fields\[(\d+)\]/.exec(path);
  if (field !== null) {
    const label = record.fields[Number(field[1])]?.label;
    return label !== undefined ? `${label}: ${message}` : problem;
  }
  if (path === 'parties.giver') return `Giver name: ${message}`;
  if (path === 'parties.receiver') return `Receiver name: ${message}`;
  if (path.startsWith('signatures')) return `Signature: ${message}`;
  if (path.startsWith('photos')) return `Photo: ${message}`;
  return problem;
}

const isoSeconds = (date: Date) => date.toISOString().replace(/\.\d+Z$/, 'Z');

/** Joins the stamp control to `sealRecord` and the store. */
export function attachPress(options: PressOptions): { destroy(): void } {
  const { source, store } = options;
  const stamp = createStamp(source.stampButton, {
    holdMs: HOLD_MS,
    reducedMotion: options.reducedMotion,
    enabled: () => !source.isLocked(),
    onSeal() {
      const record = source.getRecord();
      const result = sealRecord(record, isoSeconds(options.now()));
      if (!result.ok) {
        options.onProblem(describeProblem(record, result.problems[0] as string));
        return;
      }
      options.audio?.stamp();
      store
        .saveSealed(result.record)
        .catch(() => undefined)
        .then(() => options.onSealed(result.record));
    },
  });
  return { destroy: () => stamp.destroy() };
}