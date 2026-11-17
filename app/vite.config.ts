import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import { appConfig } from './app.config.js';
import { cacheNameFor, precacheList } from './scripts/precache.js';
import { privacyEventsHtml } from './src/privacy.js';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = resolve(repo, 'dist');

/** Where each built page goes inside dist/. The key is the path Vite writes. */
const PAGES: Record<string, string> = {
  'app/index.html': 'app/index.html',
  'app/verify/index.html': 'verify/index.html',
  'site/index.html': 'index.html',
  'site/privacy.html': 'privacy/index.html',
};

/** The privacy page lists the beacon events from the same list that beacon.ts uses. */
function privacyList(): Plugin {
  return {
    name: 'privacy-list',
    transformIndexHtml: (html) => html.replace('<!--BEACON_EVENTS-->', privacyEventsHtml()),
  };
}

/** The product name comes from app/app.config.ts only. */
function productName(): Plugin {
  return {
    name: 'product-name',
    transformIndexHtml: (html) => html.replaceAll('%APP_TITLE%', appConfig.title),
  };
}

/** Moves the built pages to their public paths: /app/, /verify/. */
function placePages(): Plugin {
  return {
    name: 'place-pages',
    apply: 'build',
    closeBundle() {
      for (const [from, to] of Object.entries(PAGES)) {
        if (from === to) continue;
        const source = resolve(outDir, from);
        if (!existsSync(source)) continue;
        const target = resolve(outDir, to);
        mkdirSync(dirname(target), { recursive: true });
        renameSync(source, target);
      }
      // Remove the folders the pages were written to, once they are empty.
      for (const from of Object.keys(PAGES)) {
        const folder = dirname(resolve(outDir, from));
        if (folder !== outDir && existsSync(folder) && readdirSync(folder).length === 0) rmSync(folder, { recursive: true });
      }
    },
  };
}

function filesOf(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? filesOf(resolve(dir, entry.name)) : [resolve(dir, entry.name)],
  );
}

/** Writes the list of built files and the cache name into dist/sw.js, after every page is in place. */
function serviceWorker(): Plugin {
  return {
    name: 'service-worker',
    apply: 'build',
    enforce: 'post',
    closeBundle() {
      const worker = resolve(outDir, 'sw.js');
      if (!existsSync(worker)) return;
      const list = precacheList(filesOf(outDir).map((file) => relative(outDir, file)));
      const text = readFileSync(worker, 'utf8')
        .replaceAll('__PRECACHE__', JSON.stringify(list))
        .replaceAll('__CACHE_NAME__', JSON.stringify(cacheNameFor(list)));
      writeFileSync(worker, text);
    },
  };
}

export default defineConfig({
  root: repo,
  base: '/',
  publicDir: false,
  plugins: [productName(), privacyList(), placePages(), serviceWorker()],
  build: {
    outDir,
    emptyOutDir: true,
    rollupOptions: {
      input: {
        app: resolve(repo, 'app/index.html'),
        verify: resolve(repo, 'app/verify/index.html'),
        site: resolve(repo, 'site/index.html'),
        privacy: resolve(repo, 'site/privacy.html'),
        sw: resolve(repo, 'app/src/sw.ts'),
      },
      // The service worker keeps one fixed name at the root, so that its scope is the whole site.
      output: {
        entryFileNames: (chunk) => (chunk.name === 'sw' ? 'sw.js' : 'assets/[name]-[hash].js'),
      },
    },
  },
  preview: { host: '127.0.0.1', port: 4473, strictPort: true },
});
