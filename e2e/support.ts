import { readFileSync, writeFileSync } from 'node:fs';
import { expect, type BrowserContext, type Page, type TestInfo } from '@playwright/test';
import { readPdf, type PdfPage } from './pdf.js';

/** What a path test watches: every request, every page error and every console error. */
export interface Watcher {
  requests: string[];
  foreign: string[];
  /** Requests that are not GET, or that carry a body. */
  withBody: string[];
  problems: string[];
  /** A copy file opened from disk is allowed as the address of a page. */
  allowFile(url: string): void;
  /** Fails when a request went to another origin, a page error or a console error happened, or nothing was recorded. */
  assertClean(): void;
}

export function watch(context: BrowserContext, origin = 'http://127.0.0.1:4173'): Watcher {
  const allowed = new Set<string>();
  const requests: string[] = [];
  const foreign: string[] = [];
  const withBody: string[] = [];
  const problems: string[] = [];
  const attach = (page: Page) => {
    page.on('pageerror', (error) => problems.push(`page error: ${error.message}`));
    page.on('console', (message) => {
      if (message.type() === 'error') problems.push(`console error: ${message.text()}`);
    });
  };
  for (const page of context.pages()) attach(page);
  context.on('page', attach);
  context.on('request', (request) => {
    const url = request.url();
    requests.push(url);
    if (request.method() !== 'GET' || request.postData() !== null) withBody.push(`${request.method()} ${url}`);
    if (url.startsWith('data:') || url.startsWith('blob:') || url === 'about:blank') return;
    if (allowed.has(url)) return;
    if (new URL(url).origin !== origin) foreign.push(url);
  });
  return {
    requests,
    foreign,
    withBody,
    problems,
    allowFile: (url) => void allowed.add(url),
    assertClean() {
      expect(requests.length, 'the request recorder saw no request').toBeGreaterThan(0);
      console.log(`request check (Playwright page.on request): ${requests.length} requests, ${foreign.length} to another origin, ${withBody.length} with a body, ${problems.length} page or console errors`);
      expect(foreign, 'requests to another origin').toEqual([]);
      expect(withBody, 'requests that are not GET or carry a body').toEqual([]);
      expect(problems, 'page errors and console errors').toEqual([]);
    },
  };
}

/** The share sheet cannot be driven without a window, so the tear off falls back to the download. */
export async function noShareSheet(page: Page): Promise<void> {
  await page.addInitScript(() => {
    Object.defineProperty(Navigator.prototype, 'share', { value: undefined, configurable: true });
    Object.defineProperty(Navigator.prototype, 'canShare', { value: undefined, configurable: true });
  });
}

/** A JPEG made in the page: a picture of the given size, as bytes. */
export async function makeJpeg(page: Page, width: number, height: number, seed = 0): Promise<Buffer> {
  const base64 = await page.evaluate(
    ([w, h, s]) => {
      const canvas = document.createElement('canvas');
      canvas.width = w as number;
      canvas.height = h as number;
      const context = canvas.getContext('2d') as CanvasRenderingContext2D;
      const gradient = context.createLinearGradient(0, 0, w as number, h as number);
      gradient.addColorStop(0, `hsl(${(s as number) * 47 + 20}, 70%, 40%)`);
      gradient.addColorStop(1, `hsl(${(s as number) * 47 + 160}, 70%, 70%)`);
      context.fillStyle = gradient;
      context.fillRect(0, 0, w as number, h as number);
      context.fillStyle = 'white';
      context.fillRect((w as number) / 4, (h as number) / 4, (w as number) / 2, (h as number) / 2);
      context.fillStyle = `hsl(${(s as number) * 90}, 80%, 30%)`;
      context.fillRect((w as number) / 3, (h as number) / 3, (w as number) / 6, (h as number) / 3);
      return canvas.toDataURL('image/jpeg', 0.9).split(',')[1] as string;
    },
    [width, height, seed],
  );
  return Buffer.from(base64, 'base64');
}

export async function addPhoto(page: Page, control: string, buffer: Buffer, name = 'photo.jpg'): Promise<void> {
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.click(`[data-control="${control}"]`)]);
  await chooser.setFiles({ name, mimeType: 'image/jpeg', buffer });
}

/** Draws a few strokes in a signature box with a real mouse. */
export async function sign(page: Page, control: string): Promise<void> {
  const box = page.locator(`[data-control="${control}"]`);
  await box.scrollIntoViewIfNeeded();
  const b = await box.boundingBox();
  if (b === null) throw new Error(`${control} has no box`);
  const at = (fx: number, fy: number) => [b.x + b.width * fx, b.y + b.height * fy] as const;
  const strokes = [
    [[0.1, 0.6], [0.25, 0.3], [0.4, 0.7], [0.55, 0.3], [0.7, 0.6]],
    [[0.15, 0.85], [0.8, 0.8]],
  ] as const;
  for (const stroke of strokes) {
    const [x0, y0] = at(stroke[0][0], stroke[0][1]);
    await page.mouse.move(x0, y0);
    await page.mouse.down();
    for (const [fx, fy] of stroke.slice(1)) {
      const [x, y] = at(fx, fy);
      await page.mouse.move(x, y, { steps: 4 });
    }
    await page.mouse.up();
  }
}

/** Presses the stamp with a real pointer down, waits, and lets go. */
export async function holdStamp(page: Page, holdMs: number): Promise<void> {
  const stamp = page.locator('[data-control="stamp"]');
  await stamp.scrollIntoViewIfNeeded();
  const b = await stamp.boundingBox();
  if (b === null) throw new Error('the stamp has no box');
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(holdMs);
  await page.mouse.up();
}

export async function tearOffTo(page: Page, testInfo: TestInfo, name: string): Promise<{ path: string; fileName: string; text: string }> {
  const [download] = await Promise.all([page.waitForEvent('download'), page.click('[data-control="tear-off"]')]);
  const path = testInfo.outputPath(name);
  await download.saveAs(path);
  return { path, fileName: download.suggestedFilename(), text: readFileSync(path, 'utf8') };
}

/** Writes a file as UTF-8 with no byte order mark, from a test. */
export function writeText(path: string, text: string): string {
  writeFileSync(path, text, { encoding: 'utf8' });
  return path;
}

/** Changes the text of one field value inside the record element only, as a person editing the file would. */
export function editRecordValue(copyText: string, from: string, to: string): string {
  const start = copyText.indexOf('<script id="record"');
  const end = copyText.indexOf('</script>', start);
  const record = copyText.slice(start, end);
  const needle = `"value":"${from}"`;
  if (!record.includes(needle)) throw new Error(`the record has no value ${from}`);
  return copyText.slice(0, start) + record.replace(needle, `"value":"${to}"`) + copyText.slice(end);
}

/** Cuts the seal out of the record element. */
export function removeSeal(copyText: string): string {
  const edited = copyText.replace(/,"seal":"[0-9a-f]{64}"/, '');
  if (edited === copyText) throw new Error('the copy has no seal in its record');
  return edited;
}

export async function expectScreen(page: Page, name: string): Promise<void> {
  await expect(page.locator(`[data-screen="${name}"]`)).toBeVisible();
}

/** Replaces `window.print` so that a click on Print is counted and no dialog opens. */
export async function stubPrint(page: Page): Promise<void> {
  await page.addInitScript(() => {
    (window as unknown as { __prints: number }).__prints = 0;
    window.print = () => {
      (window as unknown as { __prints: number }).__prints += 1;
    };
  });
}

export const printCount = (page: Page): Promise<number> =>
  page.evaluate(() => (window as unknown as { __prints: number }).__prints);

/** The page as the print layout makes it, as a PDF, read page by page. */
export async function printPages(page: Page, format: 'A4' | 'Letter'): Promise<PdfPage[]> {
  await page.emulateMedia({ media: 'print' });
  try {
    return readPdf(await page.pdf({ format, printBackground: true }));
  } finally {
    await page.emulateMedia({ media: 'screen' });
  }
}

/** Waits until the service worker has installed, cached the files and taken control of the page. */
export async function workerReady(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
}