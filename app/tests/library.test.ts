import { sealRecord, sealWords, type HandoverRecord } from 'core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createLibraryScreen } from '../src/screens/library.js';
import { openStore, type Store } from '../src/store.js';
import { sampleRecord } from '../src/templates/sample.js';

function sealed(time: string, giver: string): HandoverRecord {
  const r = sealRecord({ ...sampleRecord, parties: { ...sampleRecord.parties, giver } }, time);
  if (!r.ok) throw new Error('did not seal');
  return r.record;
}
const older = sealed('2026-11-15T08:00:00Z', 'Older Giver');
const newer = sealed('2026-11-16T09:30:00Z', 'Newer Giver');
const key = (r: HandoverRecord) => (r.seal as string).slice(0, 8);

let store: Store;
let screen: Awaited<ReturnType<typeof make>>;
const onOpen = vi.fn<(seal: string) => void>();
const onTearOff = vi.fn<(seal: string) => void>();
const onBack = vi.fn<() => void>();

async function make() {
  const s = createLibraryScreen({ store, onOpen, onTearOff, onBack });
  document.body.append(s.element);
  await s.ready;
  return s;
}
const q = (sel: string) => screen.element.querySelector(sel) as HTMLElement | null;
const rows = () => [...screen.element.querySelectorAll('[data-role="record"]')];
const flush = async () => {
  await new Promise((r) => setTimeout(r, 0));
};

beforeEach(async () => {
  onOpen.mockReset();
  onTearOff.mockReset();
  onBack.mockReset();
  store = await openStore({ idb: null, onNotice: () => undefined });
  await store.saveSealed(older);
  await store.saveSealed(newer);
  screen = await make();
});
afterEach(() => {
  screen.element.remove();
});

describe('library list', () => {
  it('is marked as the library screen', () => {
    expect(screen.element.getAttribute('data-screen')).toBe('library');
  });

  it('lists sealed records newest first, with title, date and seal words', () => {
    expect(rows()).toHaveLength(2);
    const first = rows()[0] as HTMLElement;
    expect(first.textContent).toContain('Rental return');
    expect(first.textContent).toContain('2026-11-16');
    expect(first.textContent).toContain(sealWords(newer.seal as string));
    expect(rows()[1]?.textContent).toContain(sealWords(older.seal as string));
    expect(rows()[1]?.textContent).toContain('2026-11-15');
  });

  it('puts data-control on every button, and a different one for each record', () => {
    const controls = [...screen.element.querySelectorAll('button')].map((b) => b.getAttribute('data-control'));
    for (const c of controls) expect(c).toBeTruthy();
    expect(new Set(controls).size).toBe(controls.length);
  });

  it('opens and tears off a record, and goes back', () => {
    q(`[data-control="open-${key(newer)}"]`)?.click();
    q(`[data-control="tear-off-${key(older)}"]`)?.click();
    q('[data-control="back"]')?.click();
    expect(onOpen).toHaveBeenCalledWith(newer.seal);
    expect(onTearOff).toHaveBeenCalledWith(older.seal);
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('shows one short line when the library is empty', async () => {
    screen.element.remove();
    store = await openStore({ idb: null, onNotice: () => undefined });
    screen = await make();
    expect(rows()).toHaveLength(0);
    const empty = q('[data-role="empty"]');
    expect(empty).not.toBeNull();
    expect((empty?.textContent ?? '').trim().split(/\s+/).length).toBeLessThanOrEqual(6);
  });

  it('has no control that edits a sealed record', () => {
    const controls = [...screen.element.querySelectorAll('button')].map((b) => b.getAttribute('data-control') ?? '');
    expect(controls.filter((c) => /edit|save|change/.test(c))).toEqual([]);
  });
});

describe('library delete with a confirmation box', () => {
  it('asks first and deletes nothing until the user confirms', async () => {
    q(`[data-control="delete-${key(older)}"]`)?.click();
    const box = q('[role="dialog"]');
    expect(box).not.toBeNull();
    expect(box?.textContent).toContain(sealWords(older.seal as string));
    expect(await store.getSealed(older.seal as string)).toEqual(older);
    expect(rows()).toHaveLength(2);
  });

  it('keeps the record when the user cancels', async () => {
    q(`[data-control="delete-${key(older)}"]`)?.click();
    q('[data-control="cancel-delete"]')?.click();
    await flush();
    expect(q('[role="dialog"]')).toBeNull();
    expect(await store.getSealed(older.seal as string)).toEqual(older);
    expect(rows()).toHaveLength(2);
  });

  it('deletes the record and refreshes the list when the user confirms', async () => {
    q(`[data-control="delete-${key(older)}"]`)?.click();
    q('[data-control="confirm-delete"]')?.click();
    await flush();
    await flush();
    expect(q('[role="dialog"]')).toBeNull();
    expect(await store.getSealed(older.seal as string)).toBeNull();
    expect(await store.getSealed(newer.seal as string)).toEqual(newer);
    expect(rows()).toHaveLength(1);
    expect(rows()[0]?.textContent).toContain(sealWords(newer.seal as string));
  });

  it('closes the box with the Escape key without deleting', async () => {
    q(`[data-control="delete-${key(newer)}"]`)?.click();
    q('[role="dialog"]')?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await flush();
    expect(q('[role="dialog"]')).toBeNull();
    expect(await store.getSealed(newer.seal as string)).toEqual(newer);
  });
});