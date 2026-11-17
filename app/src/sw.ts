/**
 * The service worker. It keeps the built files so that the app works offline after the first
 * load. The build writes the list of files and the cache name into this file in place of
 * `__PRECACHE__` and `__CACHE_NAME__`. It never touches a request to another site.
 */
export const CACHE_PREFIX = 'app-cache-';

interface WorkerEvent {
  waitUntil(promise: Promise<unknown>): void;
}
interface FetchEventLike extends WorkerEvent {
  request: { url: string; method: string; mode: string };
  respondWith(response: Promise<unknown>): void;
}

/** The parts of the worker scope that this file uses. */
export interface WorkerScope {
  addEventListener(type: 'install' | 'activate', listener: (event: WorkerEvent) => void): void;
  addEventListener(type: 'fetch', listener: (event: FetchEventLike) => void): void;
  skipWaiting(): Promise<void>;
  clients: { claim(): Promise<void> };
  location: { origin: string; href?: string };
  caches: {
    open(name: string): Promise<{ addAll(urls: string[]): Promise<void> }>;
    keys(): Promise<string[]>;
    delete(name: string): Promise<boolean>;
    match(request: unknown, options?: { ignoreSearch?: boolean; ignoreVary?: boolean }): Promise<unknown>;
  };
}

export function installWorker(scope: WorkerScope, precache: string[], cacheName: string): void {
  scope.addEventListener('install', (event) => {
    event.waitUntil(
      scope.caches
        .open(cacheName)
        .then((cache) => cache.addAll(precache))
        .then(() => scope.skipWaiting()),
    );
  });

  scope.addEventListener('activate', (event) => {
    event.waitUntil(
      scope.caches
        .keys()
        .then((names) =>
          Promise.all(names.filter((name) => name.startsWith(CACHE_PREFIX) && name !== cacheName).map((name) => scope.caches.delete(name))),
        )
        .then(() => scope.clients.claim()),
    );
  });

  scope.addEventListener('fetch', (event) => {
    const { request } = event;
    if (request.method !== 'GET') return;
    const url = new URL(request.url);
    if (url.origin !== scope.location.origin) return;
    event.respondWith(
      (async () => {
        const hit = await scope.caches.match(request, { ignoreSearch: true, ignoreVary: true });
        if (hit !== undefined) return hit;
        try {
          return await fetch(request as unknown as RequestInfo);
        } catch (error) {
          if (request.mode === 'navigate') {
            // The pages sit in folders next to this file, so the folder is counted from the folder of the worker.
            const root = new URL('./', scope.location.href ?? `${scope.location.origin}/`);
            const inside = url.pathname.startsWith(root.pathname) ? url.pathname.slice(root.pathname.length) : '';
            const folder = inside.split('/')[0] ?? '';
            const page =
              (await scope.caches.match(new URL(`${folder}/`, root).href, { ignoreVary: true })) ??
              (await scope.caches.match(new URL('app/', root).href, { ignoreVary: true }));
            if (page !== undefined) return page;
          }
          throw error;
        }
      })(),
    );
  });
}

declare const __PRECACHE__: string[] | undefined;
declare const __CACHE_NAME__: string | undefined;

if (typeof __PRECACHE__ !== 'undefined' && typeof __CACHE_NAME__ !== 'undefined') {
  installWorker(self as unknown as WorkerScope, __PRECACHE__, __CACHE_NAME__);
}
