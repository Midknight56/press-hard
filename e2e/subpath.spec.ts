import { createServer, type Server } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { expectScreen, holdStamp, noShareSheet, workerReady } from './support.js';

// A tiny static file server for the existing dist folder. It builds nothing.
// It serves /press-hard/ and nothing else, on port 4474. The normal server stays on 4473.
const PORT = 4474;
const PREFIX = '/press-hard/';
const DIST = resolve(fileURLToPath(new URL('.', import.meta.url)), '..', 'dist');
const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
};

const served: { path: string; status: number }[] = [];
let server: Server;

test.beforeAll(async () => {
  server = createServer((request, response) => {
    const path = decodeURIComponent((request.url ?? '/').split('?')[0] ?? '/');
    let status = 404;
    let body: Buffer | string = 'not found';
    let type = 'text/plain; charset=utf-8';
    if (path.startsWith(PREFIX)) {
      let file = normalize(join(DIST, path.slice(PREFIX.length)));
      if (file.startsWith(DIST) && existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
      if (file.startsWith(DIST) && existsSync(file) && statSync(file).isFile()) {
        status = 200;
        body = readFileSync(file);
        type = TYPES[extname(file)] ?? 'application/octet-stream';
      }
    }
    served.push({ path, status });
    response.writeHead(status, { 'content-type': type });
    response.end(body);
  });
  await new Promise<void>((done, fail) => {
    server.once('error', fail);
    server.listen(PORT, '127.0.0.1', done);
  });
});

test.afterAll(async () => {
  await new Promise<void>((done) => server.close(() => done()));
});

test('the built site works under /press-hard/: links, offline worker and a sealed prefilled form', async ({ browser }) => {
  expect(existsSync(join(DIST, 'index.html')), 'dist exists, run npm run build first').toBe(true);
  const origin = `http://127.0.0.1:${PORT}`;
  const context = await browser.newContext();
  const requests: string[] = [];
  const bad: string[] = [];
  const problems: string[] = [];
  context.on('request', (request) => {
    const url = request.url();
    requests.push(url);
    if (url.startsWith('data:') || url.startsWith('blob:') || url === 'about:blank') return;
    if (!url.startsWith(`${origin}${PREFIX}`)) bad.push(`outside ${PREFIX}: ${url}`);
  });
  context.on('response', (response) => {
    if (response.status() === 404) bad.push(`404: ${response.url()}`);
  });
  const page = await context.newPage();
  page.on('pageerror', (error) => problems.push(`page error: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') problems.push(`console error: ${message.text()}`);
  });
  await noShareSheet(page);

  await page.goto(`${origin}${PREFIX}`);
  await expectScreen(page, 'landing');

  await page.click('[data-control="open-verify"]');
  await expectScreen(page, 'verify');
  expect(new URL(page.url()).pathname).toBe(`${PREFIX}verify/`);
  await page.goBack();
  await expectScreen(page, 'landing');

  await page.click('[data-control="open-privacy"]');
  await expectScreen(page, 'privacy');
  expect(new URL(page.url()).pathname).toBe(`${PREFIX}privacy/`);
  await page.click('[data-control="open-home"]');
  await expectScreen(page, 'landing');
  expect(new URL(page.url()).pathname).toBe(PREFIX);

  await page.click('[data-control="start"]');
  await expectScreen(page, 'pick');
  expect(new URL(page.url()).pathname).toBe(`${PREFIX}app/`);
  await workerReady(page);
  await page.click('[data-control="pick-prefilled"]');
  await expectScreen(page, 'fill');
  await holdStamp(page, 1300);
  await expectScreen(page, 'copy');
  await expect(page.locator('.carbon-sheet .seal-words')).toHaveText(/^[a-z]+(-[a-z]+){3}$/);

  // The links inside the app lead to the other pages of the same folder.
  await page.goto(`${origin}${PREFIX}app/`);
  await expectScreen(page, 'pick');
  await page.click('[data-control="nav-verify"]');
  await expectScreen(page, 'verify');
  expect(new URL(page.url()).pathname).toBe(`${PREFIX}verify/`);

  console.log(`sub path check (Playwright context.on request, Node http server): ${requests.length} requests, ${bad.length} bad, ${problems.length} page or console errors`);
  expect(requests.length, 'the recorder saw requests').toBeGreaterThan(0);
  expect(bad, 'requests that got a 404 or went outside the sub path').toEqual([]);
  expect(problems, 'page errors and console errors').toEqual([]);
  expect(served.filter((s) => s.status === 404), 'the server answered 404').toEqual([]);
  expect(served.filter((s) => !s.path.startsWith(PREFIX)), 'the server saw a path outside the sub path').toEqual([]);
  await context.close();

  // The root of the same server serves nothing: /press-hard/ is the only place.
  const other = await browser.newContext();
  const rootPage = await other.newPage();
  const root = await rootPage.goto(`${origin}/`);
  expect(root?.status()).toBe(404);
  const rootApp = await rootPage.goto(`${origin}/app/`);
  expect(rootApp?.status()).toBe(404);
  await other.close();
});
