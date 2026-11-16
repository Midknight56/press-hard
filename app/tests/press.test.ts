import { sealWords, validateRecord, verifyRecord, type HandoverRecord } from 'core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { attachPress, describeProblem } from '../src/screens/press.js';
import { openStore, type Store } from '../src/store.js';
import { sampleRecord } from '../src/templates/sample.js';

let store: Store;
let button: HTMLButtonElement;
let locked: boolean;
let record: HandoverRecord;
let onSealed: ReturnType<typeof vi.fn<(r: HandoverRecord) => void>>;
let onProblem: ReturnType<typeof vi.fn<(m: string) => void>>;
let stampSound: ReturnType<typeof vi.fn<() => void>>;
let press: { destroy(): void };

const NOW = new Date('2026-11-16T09:30:00.456Z');

async function setup(rec: HandoverRecord = sampleRecord): Promise<void> {
  store = await openStore({ idb: null, onNotice: () => undefined });
  button = document.createElement('button');
  document.body.append(button);
  locked = false;
  record = rec;
  onSealed = vi.fn<(r: HandoverRecord) => void>();
  onProblem = vi.fn<(m: string) => void>();
  stampSound = vi.fn<() => void>();
  press = attachPress({
    source: { stampButton: button, getRecord: () => structuredClone(record), isLocked: () => locked },
    store,
    now: () => NOW,
    reducedMotion: false,
    onSealed,
    onProblem,
    audio: { stamp: stampSound },
  });
}
const hold = async (ms: number) => {
  button.dispatchEvent(new Event('pointerdown'));
  await vi.advanceTimersByTimeAsync(ms);
  button.dispatchEvent(new Event('pointerup'));
};

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  press?.destroy();
  button?.remove();
  vi.useRealTimers();
});

describe('press, a good seal', () => {
  it('seals the record with the device time after a hold of 1.2 seconds', async () => {
    await setup();
    await hold(1200);
    expect(onSealed).toHaveBeenCalledTimes(1);
    const sealed = onSealed.mock.calls[0]?.[0] as HandoverRecord;
    expect(sealed.sealedAt).toBe('2026-11-16T09:30:00Z');
    expect(validateRecord(sealed)).toEqual([]);
    expect(verifyRecord(sealed)).toBe('matches');
    expect(onProblem).not.toHaveBeenCalled();
    expect(stampSound).toHaveBeenCalledTimes(1);
  });

  it('stores the sealed record in the library before it reports it', async () => {
    await setup();
    await hold(1200);
    const sealed = onSealed.mock.calls[0]?.[0] as HandoverRecord;
    expect(await store.getSealed(sealed.seal as string)).toEqual(sealed);
    expect((await store.listSealed()).map((e) => e.seal)).toEqual([sealed.seal]);
  });

  it('seals nothing after a hold of 1199 ms', async () => {
    await setup();
    await hold(1199);
    expect(onSealed).not.toHaveBeenCalled();
    expect(await store.listSealed()).toEqual([]);
    expect(stampSound).not.toHaveBeenCalled();
  });

  it('seals nothing while the form is locked', async () => {
    await setup();
    locked = true;
    await hold(3000);
    expect(onSealed).not.toHaveBeenCalled();
    expect(await store.listSealed()).toEqual([]);
  });

  it('seals from the keyboard too', async () => {
    await setup();
    button.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
    await vi.advanceTimersByTimeAsync(1200);
    expect(onSealed).toHaveBeenCalledTimes(1);
  });

  it('gives seal words that match the seal', async () => {
    await setup();
    await hold(1200);
    const sealed = onSealed.mock.calls[0]?.[0] as HandoverRecord;
    expect(sealWords(sealed.seal as string).split('-')).toHaveLength(4);
  });
});

describe('press, sealRecord returns problems', () => {
  const bad: HandoverRecord = {
    ...sampleRecord,
    fields: sampleRecord.fields.map((f) => (f.id === 'mileage' ? { ...f, value: 'a lot' } : f)),
  };

  it('seals nothing, stores nothing and says one line that names the line', async () => {
    await setup(bad);
    await hold(1200);
    expect(onSealed).not.toHaveBeenCalled();
    expect(await store.listSealed()).toEqual([]);
    expect(stampSound).not.toHaveBeenCalled();
    expect(onProblem).toHaveBeenCalledTimes(1);
    const line = onProblem.mock.calls[0]?.[0] as string;
    expect(line).toContain('Mileage');
    expect(line).not.toContain('\n');
  });
});

describe('describeProblem', () => {
  it('names a field by its label', () => {
    expect(describeProblem(sampleRecord, 'fields[2].value: must be a number with at most 3 decimal places')).toBe(
      'Mileage: must be a number with at most 3 decimal places',
    );
  });
  it('names the two name lines and the signatures', () => {
    expect(describeProblem(sampleRecord, 'parties.giver: must be text')).toBe('Giver name: must be text');
    expect(describeProblem(sampleRecord, 'parties.receiver: text is longer than 500 characters')).toBe(
      'Receiver name: text is longer than 500 characters',
    );
    expect(describeProblem(sampleRecord, 'signatures[0].strokes: has 4001 points, more than 4000')).toBe(
      'Signature: has 4001 points, more than 4000',
    );
  });
  it('falls back to the problem text', () => {
    expect(describeProblem(sampleRecord, 'format: must be 1')).toBe('format: must be 1');
  });
});