import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { sealRecord, type HandoverRecord } from 'core';
import { openStore, type Draft } from '../src/store.js';
import { sampleRecord } from '../src/templates/sample.js';

function sealed(time: string, giver = 'Mara Oduya'): HandoverRecord {
  const result = sealRecord({ ...sampleRecord, parties: { ...sampleRecord.parties, giver } }, time);
  if (!result.ok) throw new Error(result.problems.join('; '));
  return result.record;
}
const draft = (id: string, updatedAt = 1): Draft => ({
  id,
  templateId: 'rental-return',
  record: sampleRecord,
  updatedAt,
});

describe('store with IndexedDB', () => {
  let idb: IDBFactory;
  let onNotice: Mock<(message: string) => void>;
  beforeEach(() => {
    idb = new IDBFactory();
    onNotice = vi.fn<(message: string) => void>();
  });

  it('is persistent and shows no notice', async () => {
    const store = await openStore({ idb, onNotice });
    expect(store.persistent).toBe(true);
    expect(onNotice).not.toHaveBeenCalled();
  });

  it('saves and lists drafts, and replaces a draft with the same id', async () => {
    const store = await openStore({ idb, onNotice });
    await store.saveDraft(draft('a', 1));
    await store.saveDraft(draft('b', 2));
    await store.saveDraft({ ...draft('a', 3), templateId: 'blank' });
    const list = await store.listDrafts();
    expect(list.map((d) => d.id).sort()).toEqual(['a', 'b']);
    expect(list.find((d) => d.id === 'a')?.templateId).toBe('blank');
  });

  it('keeps data when the store is opened again on the same database', async () => {
    const first = await openStore({ idb, onNotice });
    const record = sealed('2026-11-16T09:30:00Z');
    await first.saveSealed(record);
    await first.saveDraft(draft('a'));
    const second = await openStore({ idb, onNotice });
    expect(await second.getSealed(record.seal as string)).toEqual(record);
    expect((await second.listDrafts()).map((d) => d.id)).toEqual(['a']);
  });

  it('saves, lists, gets and deletes sealed records', async () => {
    const store = await openStore({ idb, onNotice });
    const older = sealed('2026-11-16T09:30:00Z', 'Older Giver');
    const newer = sealed('2026-11-17T09:30:00Z', 'Newer Giver');
    await store.saveSealed(older);
    await store.saveSealed(newer);
    expect(await store.listSealed()).toEqual([
      { seal: newer.seal, title: 'Rental return', sealedAt: '2026-11-17T09:30:00Z' },
      { seal: older.seal, title: 'Rental return', sealedAt: '2026-11-16T09:30:00Z' },
    ]);
    expect(await store.getSealed(older.seal as string)).toEqual(older);
    await store.deleteSealed(older.seal as string);
    expect(await store.getSealed(older.seal as string)).toBeNull();
    expect((await store.listSealed()).map((e) => e.seal)).toEqual([newer.seal]);
  });

  it('returns null for an unknown seal and deletes an unknown seal without error', async () => {
    const store = await openStore({ idb, onNotice });
    expect(await store.getSealed('0'.repeat(64))).toBeNull();
    await expect(store.deleteSealed('0'.repeat(64))).resolves.toBeUndefined();
  });

  it('never changes a sealed record that is saved again under the same seal', async () => {
    const store = await openStore({ idb, onNotice });
    const record = sealed('2026-11-16T09:30:00Z');
    await store.saveSealed(record);
    const forged: HandoverRecord = { ...record, parties: { giver: 'Someone Else', receiver: 'X' } };
    await store.saveSealed(forged);
    expect(await store.getSealed(record.seal as string)).toEqual(record);
  });

  it('refuses a record with no seal', async () => {
    const store = await openStore({ idb, onNotice });
    await expect(store.saveSealed(sampleRecord)).rejects.toThrow(/seal/);
    expect(await store.listSealed()).toEqual([]);
  });
});

describe('store with storage blocked', () => {
  it('uses memory and says once that drafts will not be kept, when there is no IndexedDB', async () => {
    const onNotice = vi.fn<(message: string) => void>();
    const store = await openStore({ idb: null, onNotice });
    expect(store.persistent).toBe(false);
    expect(onNotice).toHaveBeenCalledTimes(1);
    expect(onNotice.mock.calls[0]?.[0]).toBe('Drafts will not be kept on this device.');
    await store.saveDraft(draft('a'));
    await store.saveDraft(draft('b'));
    expect(onNotice).toHaveBeenCalledTimes(1);
  });

  it('uses memory when open throws', async () => {
    const onNotice = vi.fn<(message: string) => void>();
    const idb = {
      open() {
        throw new DOMException('denied', 'SecurityError');
      },
    } as unknown as IDBFactory;
    const store = await openStore({ idb, onNotice });
    expect(store.persistent).toBe(false);
    expect(onNotice).toHaveBeenCalledTimes(1);
  });

  it('uses memory when the open request fires an error', async () => {
    const onNotice = vi.fn<(message: string) => void>();
    const idb = {
      open() {
        const request: { onerror: null | (() => void) } = { onerror: null };
        setTimeout(() => request.onerror?.(), 0);
        return request;
      },
    } as unknown as IDBFactory;
    const store = await openStore({ idb, onNotice });
    expect(store.persistent).toBe(false);
    expect(onNotice).toHaveBeenCalledTimes(1);
  });

  it('still fills, seals and lists in memory', async () => {
    const store = await openStore({ idb: null, onNotice: () => undefined });
    const a = sealed('2026-11-16T09:30:00Z', 'A Giver');
    const b = sealed('2026-11-17T09:30:00Z', 'B Giver');
    await store.saveDraft(draft('a'));
    await store.saveSealed(a);
    await store.saveSealed(b);
    expect((await store.listDrafts()).map((d) => d.id)).toEqual(['a']);
    expect((await store.listSealed()).map((e) => e.seal)).toEqual([b.seal, a.seal]);
    expect(await store.getSealed(a.seal as string)).toEqual(a);
    await store.deleteSealed(a.seal as string);
    expect(await store.getSealed(a.seal as string)).toBeNull();
  });

  it('keeps a sealed record unchanged in memory when it is saved again', async () => {
    const store = await openStore({ idb: null, onNotice: () => undefined });
    const record = sealed('2026-11-16T09:30:00Z');
    await store.saveSealed(record);
    await store.saveSealed({ ...record, parties: { giver: 'Other', receiver: 'Other' } });
    expect(await store.getSealed(record.seal as string)).toEqual(record);
  });
});

describe('storage that throws when it is touched', () => {
  it('falls back to memory with one notice when reading indexedDB throws', async () => {
    Object.defineProperty(globalThis, 'indexedDB', {
      configurable: true,
      get() {
        throw new DOMException('The operation is insecure.', 'SecurityError');
      },
    });
    try {
      const onNotice = vi.fn<(message: string) => void>();
      const store = await openStore({ onNotice });
      expect(store.persistent).toBe(false);
      const record = sealed('2026-11-16T09:30:00Z');
      await store.saveSealed(record);
      expect(await store.getSealed(record.seal as string)).toEqual(record);
      expect(onNotice).toHaveBeenCalledTimes(1);
    } finally {
      delete (globalThis as { indexedDB?: unknown }).indexedDB;
    }
  });
});