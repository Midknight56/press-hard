import { describe, expect, it, vi } from 'vitest';
import { cacheNameFor, CACHE_PREFIX, precacheList } from '../scripts/precache.js';
import { installWorker, type WorkerScope } from '../src/sw.js';

describe('precacheList', () => {
  const files = [
    'index.html',
    'app/index.html',
    'verify/index.html',
    'privacy/index.html',
    'assets/app-abc.js',
    'assets/app-abc.css',
    'sw.js',
    'assets/app-abc.js.map',
    'notes.txt~',
  ];

  it('gives the address of each page and each asset, and leaves out the worker and the maps', () => {
    expect(precacheList(files)).toEqual([
      '/',
      '/app/',
      '/assets/app-abc.css',
      '/assets/app-abc.js',
      '/privacy/',
      '/verify/',
    ]);
  });

  it('does not depend on the order of the files', () => {
    expect(precacheList([...files].reverse())).toEqual(precacheList(files));
  });

  it('uses forward slashes for files found on Windows', () => {
    expect(precacheList(['app\\index.html', 'assets\\a.js'])).toEqual(['/app/', '/assets/a.js']);
  });
});

describe('cacheNameFor', () => {
  it('starts with the prefix, is the same for the same list and changes when a file changes', () => {
    const a = cacheNameFor(['/', '/assets/a-111.js']);
    expect(a.startsWith(CACHE_PREFIX)).toBe(true);
    expect(cacheNameFor(['/', '/assets/a-111.js'])).toBe(a);
    expect(cacheNameFor(['/', '/assets/a-222.js'])).not.toBe(a);
  });
});

// A worker scope with the parts the worker uses, so that its rules can be tested without a browser.
function fakeScope(initial: Record<string, Record<string, string>> = {}) {
  const stores = new Map<string, Map<string, string>>(
    Object.entries(initial).map(([name, entries]) => [name, new Map(Object.entries(entries))]),
  );
  const listeners = new Map<string, (event: unknown) => void>();
  const keyOf = (request: string | { url: string }) => new URL(typeof request === 'string' ? request : request.url, 'https://site.test').pathname;
  const caches = {
    open: vi.fn(async (name: string) => {
      if (!stores.has(name)) stores.set(name, new Map());
      const store = stores.get(name) as Map<string, string>;
      return {
        addAll: vi.fn(async (urls: string[]) => {
          for (const url of urls) store.set(url, `body of ${url}`);
        }),
      };
    }),
    keys: vi.fn(async () => [...stores.keys()]),
    delete: vi.fn(async (name: string) => stores.delete(name)),
    match: vi.fn(async (request: string | { url: string }) => {
      for (const store of stores.values()) {
        const hit = store.get(keyOf(request));
        if (hit !== undefined) return hit;
      }
      return undefined;
    }),
  };
  const scope = {
    addEventListener: (type: string, listener: (event: unknown) => void) => listeners.set(type, listener),
    skipWaiting: vi.fn(async () => undefined),
    clients: { claim: vi.fn(async () => undefined) },
    location: { origin: 'https://site.test' },
    caches,
  };
  async function dispatch(type: string, extra: object = {}): Promise<{ waited: Promise<unknown>[]; response: Promise<unknown> | null }> {
    const waited: Promise<unknown>[] = [];
    let response: Promise<unknown> | null = null;
    listeners.get(type)?.({
      ...extra,
      waitUntil: (p: Promise<unknown>) => waited.push(p),
      respondWith: (p: Promise<unknown>) => {
        response = p;
      },
    });
    await Promise.all(waited);
    return { waited, response };
  }
  return { scope: scope as unknown as WorkerScope, caches, stores, dispatch, raw: scope };
}

const request = (url: string, extra: object = {}) => ({ url: `https://site.test${url}`, method: 'GET', mode: 'cors', ...extra });

describe('installWorker', () => {
  it('on install caches the list under the name and takes over at once', async () => {
    const f = fakeScope();
    installWorker(f.scope, ['/', '/app/', '/assets/a.js'], 'app-cache-one');
    await f.dispatch('install');
    expect([...(f.stores.get('app-cache-one')?.keys() ?? [])]).toEqual(['/', '/app/', '/assets/a.js']);
    expect(f.raw.skipWaiting).toHaveBeenCalled();
  });

  it('on activate removes old caches of this app only, keeps the new one and other caches, and claims the pages', async () => {
    const f = fakeScope({ 'app-cache-old': { '/': 'x' }, 'app-cache-one': { '/': 'y' }, 'someone-else': { '/': 'z' } });
    installWorker(f.scope, ['/'], 'app-cache-one');
    await f.dispatch('activate');
    expect([...f.stores.keys()].sort()).toEqual(['app-cache-one', 'someone-else']);
    expect(f.raw.clients.claim).toHaveBeenCalled();
  });

  it('serves a cached file of this site without the network', async () => {
    const f = fakeScope({ 'app-cache-one': { '/assets/a.js': 'cached js' } });
    installWorker(f.scope, ['/assets/a.js'], 'app-cache-one');
    const network = vi.fn();
    vi.stubGlobal('fetch', network);
    const { response } = await f.dispatch('fetch', { request: request('/assets/a.js') });
    expect(await response).toBe('cached js');
    expect(network).not.toHaveBeenCalled();
    // The server of the built site sends Vary: Origin. Without ignoreVary a cached script is not found.
    expect(f.caches.match).toHaveBeenCalledWith(expect.anything(), { ignoreSearch: true, ignoreVary: true });
    vi.unstubAllGlobals();
  });

  it('leaves alone a request that is not GET and a request to another site', async () => {
    const f = fakeScope({ 'app-cache-one': { '/assets/a.js': 'cached js' } });
    installWorker(f.scope, ['/assets/a.js'], 'app-cache-one');
    expect((await f.dispatch('fetch', { request: request('/assets/a.js', { method: 'POST' }) })).response).toBeNull();
    expect((await f.dispatch('fetch', { request: { url: 'https://other.test/assets/a.js', method: 'GET', mode: 'cors' } })).response).toBeNull();
  });

  it('goes to the network for a file that is not cached', async () => {
    const f = fakeScope({ 'app-cache-one': {} });
    installWorker(f.scope, [], 'app-cache-one');
    const network = vi.fn(async () => 'from network');
    vi.stubGlobal('fetch', network);
    const { response } = await f.dispatch('fetch', { request: request('/other.json') });
    expect(await response).toBe('from network');
    vi.unstubAllGlobals();
  });

  it('shows the cached app page for a page it does not hold when the network is gone', async () => {
    const f = fakeScope({ 'app-cache-one': { '/app/': 'app page' } });
    installWorker(f.scope, ['/app/'], 'app-cache-one');
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    }));
    const { response } = await f.dispatch('fetch', { request: request('/app/other', { mode: 'navigate' }) });
    expect(await response).toBe('app page');
    vi.unstubAllGlobals();
  });
});
