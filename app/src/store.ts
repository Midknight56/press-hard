import type { HandoverRecord } from 'core';

export interface Draft {
  id: string;
  templateId: string;
  record: HandoverRecord;
  updatedAt: number;
}

export interface SealedEntry {
  seal: string;
  title: string;
  sealedAt: string;
}

export interface Store {
  saveDraft(draft: Draft): Promise<void>;
  listDrafts(): Promise<Draft[]>;
  saveSealed(record: HandoverRecord): Promise<void>;
  listSealed(): Promise<SealedEntry[]>;
  getSealed(seal: string): Promise<HandoverRecord | null>;
  deleteSealed(seal: string): Promise<void>;
  /** False when the memory fallback is in use. */
  readonly persistent: boolean;
}

export interface StoreOptions {
  /** The IndexedDB factory. `null` means storage is blocked. Default: the browser's own. */
  idb?: IDBFactory | null;
  /** Called at most once, when drafts will not be kept. */
  onNotice?: (message: string) => void;
}

export const NOTICE = 'Drafts will not be kept on this device.';
const DB_NAME = 'counter';
const DB_VERSION = 1;

function requireSeal(record: HandoverRecord): string {
  if (typeof record.seal !== 'string') throw new Error('saveSealed: the record has no seal');
  return record.seal;
}

function sortedEntries(records: HandoverRecord[]): SealedEntry[] {
  return records
    .map((r) => ({ seal: r.seal as string, title: r.form.title, sealedAt: r.sealedAt ?? '' }))
    .sort((a, b) => (a.sealedAt < b.sealedAt ? 1 : a.sealedAt > b.sealedAt ? -1 : 0));
}

function createMemoryStore(): Omit<Store, 'persistent'> {
  const drafts = new Map<string, Draft>();
  const sealed = new Map<string, HandoverRecord>();
  return {
    async saveDraft(draft) {
      drafts.set(draft.id, structuredClone(draft));
    },
    async listDrafts() {
      return [...drafts.values()].map((d) => structuredClone(d));
    },
    async saveSealed(record) {
      const seal = requireSeal(record);
      if (!sealed.has(seal)) sealed.set(seal, structuredClone(record));
    },
    async listSealed() {
      return sortedEntries([...sealed.values()]);
    },
    async getSealed(seal) {
      const found = sealed.get(seal);
      return found === undefined ? null : structuredClone(found);
    },
    async deleteSealed(seal) {
      sealed.delete(seal);
    },
  };
}

function openDatabase(idb: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = idb.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      db.createObjectStore('drafts', { keyPath: 'id' });
      db.createObjectStore('sealed', { keyPath: 'seal' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('open failed'));
    request.onblocked = () => reject(new Error('open blocked'));
  });
}

function run<T>(
  db: IDBDatabase,
  storeName: 'drafts' | 'sealed',
  mode: IDBTransactionMode,
  work: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const request = work(tx.objectStore(storeName));
    let result: T;
    request.onsuccess = () => {
      result = request.result;
    };
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(new Error('transaction failed'));
    tx.onabort = () => reject(new Error('transaction aborted'));
  });
}

/** Reading `indexedDB` itself throws in some browsers when storage is blocked. */
function browserIndexedDb(): IDBFactory | null {
  try {
    return (globalThis as { indexedDB?: IDBFactory }).indexedDB ?? null;
  } catch {
    return null;
  }
}

export async function openStore(options: StoreOptions = {}): Promise<Store> {
  const idb = options.idb === undefined ? browserIndexedDb() : options.idb;
  const memory = createMemoryStore();
  let db: IDBDatabase | null = null;
  let noticed = false;

  const notice = () => {
    if (noticed) return;
    noticed = true;
    options.onNotice?.(NOTICE);
  };

  if (idb !== null) {
    try {
      db = await openDatabase(idb);
    } catch {
      db = null;
    }
  }
  if (db === null) notice();

  /** Runs on IndexedDB, and on any failure switches to memory for good and says so once. */
  async function use<T>(
    onDb: (database: IDBDatabase) => Promise<T>,
    onMemory: (m: Omit<Store, 'persistent'>) => Promise<T>,
  ): Promise<T> {
    if (db !== null) {
      try {
        return await onDb(db);
      } catch {
        db = null;
        notice();
      }
    }
    return onMemory(memory);
  }

  return {
    get persistent() {
      return db !== null;
    },
    saveDraft: (draft) =>
      use(
        async (d) => {
          await run(d, 'drafts', 'readwrite', (s) => s.put(draft));
        },
        (m) => m.saveDraft(draft),
      ),
    listDrafts: () =>
      use(
        (d) => run<Draft[]>(d, 'drafts', 'readonly', (s) => s.getAll()),
        (m) => m.listDrafts(),
      ),
    saveSealed: async (record) => {
      const seal = requireSeal(record);
      await use(
        (d) =>
          new Promise<void>((resolve, reject) => {
            const tx = d.transaction('sealed', 'readwrite');
            const objects = tx.objectStore('sealed');
            // A record already stored under this seal is never overwritten.
            const existing = objects.count(seal);
            existing.onsuccess = () => {
              if (existing.result === 0) objects.add(record);
            };
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(new Error('transaction failed'));
            tx.onabort = () => reject(new Error('transaction aborted'));
          }),
        (m) => m.saveSealed({ ...record, seal }),
      );
    },
    listSealed: () =>
      use(
        async (d) => sortedEntries(await run<HandoverRecord[]>(d, 'sealed', 'readonly', (s) => s.getAll())),
        (m) => m.listSealed(),
      ),
    getSealed: (seal) =>
      use(
        async (d) => (await run<HandoverRecord | undefined>(d, 'sealed', 'readonly', (s) => s.get(seal))) ?? null,
        (m) => m.getSealed(seal),
      ),
    deleteSealed: (seal) =>
      use(
        async (d) => {
          await run(d, 'sealed', 'readwrite', (s) => s.delete(seal));
        },
        (m) => m.deleteSealed(seal),
      ),
  };
}
