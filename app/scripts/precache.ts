import { createHash } from 'node:crypto';
import { CACHE_PREFIX } from '../src/sw.js';

export { CACHE_PREFIX };

/**
 * The addresses the service worker keeps for offline use, from the files of `dist/` (paths with
 * `/` or `\`). Pages get the address of their folder, files under `assets/` get their own address.
 * The worker itself and the source maps are left out.
 */
export function precacheList(files: string[]): string[] {
  const list: string[] = [];
  for (const raw of files) {
    const file = raw.replace(/\\/g, '/');
    if (file === 'sw.js' || file.endsWith('.map')) continue;
    if (file === 'index.html') list.push('/');
    else if (file.endsWith('/index.html')) list.push(`/${file.slice(0, -'index.html'.length)}`);
    else if (file.startsWith('assets/')) list.push(`/${file}`);
  }
  return [...new Set(list)].sort();
}

/** A cache name that changes when any listed file changes (the asset names hold a hash of their content). */
export function cacheNameFor(list: string[]): string {
  return CACHE_PREFIX + createHash('sha256').update(list.join('\n')).digest('hex').slice(0, 12);
}
