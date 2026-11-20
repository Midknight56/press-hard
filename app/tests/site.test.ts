import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { appConfig } from '../app.config.js';
import { BEACON_EVENTS } from '../src/beacon.js';
import { checkDist, REQUIRED_PAGES, WORKER_FILE } from '../scripts/check-dist.js';
import { privacyEventsHtml } from '../src/privacy.js';

const root = resolve(import.meta.dirname, '..', '..');
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');

describe('privacy page list', () => {
  const html = privacyEventsHtml();

  it('lists every beacon event with when it is sent, from the same list the beacon uses', () => {
    for (const e of BEACON_EVENTS) {
      expect(html).toContain(`<code>${e.event}</code>`);
      expect(html).toContain(e.when);
    }
    expect((html.match(/<li>/g) ?? []).length).toBe(BEACON_EVENTS.length);
  });

  it('names the two fields of the body and the other value', () => {
    expect(html).toContain('<code>event</code>');
    expect(html).toContain('<code>template</code>');
    expect(html).toContain('<code>other</code>');
  });

  it('says five forms, and no longer four forms', () => {
    expect(html).toContain('one of the five forms');
    expect(html).not.toContain('four forms');
  });
});

describe('site pages', () => {
  const pages = ['site/index.html', 'site/privacy.html'];

  it.each(pages)('%s takes the product name from the build and does not hold it', (page) => {
    const html = read(page);
    expect(html).toContain('%APP_TITLE%');
    expect(html).not.toContain(appConfig.title);
  });

  it('the privacy page has the place for the generated list', () => {
    expect(read('site/privacy.html')).toContain('<!--BEACON_EVENTS-->');
  });

  it.each(pages)('%s loads nothing from another site and uses none of the banned words', (page) => {
    const html = read(page);
    expect(html).not.toMatch(/(src|href)="https?:\/\//);
    expect(html).not.toMatch(/@import|url\(\s*['"]?https?:/);
    for (const word of ['legal proof', 'tamper proof', 'tamper-proof', 'secure', 'certified']) {
      expect(html.toLowerCase(), word).not.toContain(word);
    }
  });

  it('the privacy page uses none of the developer words', () => {
    const html = read('site/privacy.html');
    for (const word of ['Target:', 'kiro-log', 'spec', 'task 9']) {
      expect(html, word).not.toContain(word);
    }
  });

  it('the privacy page has no dash between words', () => {
    const text = read('site/privacy.html').replace(/<[^>]*>/g, ' ');
    expect(text).not.toMatch(/\s[-\u2013\u2014]\s|[A-Za-z][\u2013\u2014][A-Za-z]/);
  });
  it('the privacy page states the server sees the request, form content and the check', () => {
    const html = read('site/privacy.html').toLowerCase();
    expect(html).toContain('also sees the request');
    expect(html).toContain('form content');
    expect(html).toContain('copy file');
    expect(html).toContain('playwright');
  });
});

describe('checkDist', () => {
  const made: string[] = [];
  afterEach(() => {
    for (const dir of made.splice(0)) rmSync(dir, { recursive: true, force: true });
  });

  function dist(files: string[], worker: string | null = 'const list = ["./", "./app/"];'): string {
    const dir = mkdtempSync(join(tmpdir(), 'dist-check-'));
    made.push(dir);
    if (worker !== null) writeFileSync(join(dir, WORKER_FILE), worker);
    for (const file of files) {
      mkdirSync(join(dir, file, '..'), { recursive: true });
      writeFileSync(join(dir, file), `<html><title>${appConfig.title}</title></html>\n`);
    }
    return dir;
  }

  it('wants /, /app/, /verify/ and /privacy/', () => {
    expect(REQUIRED_PAGES).toEqual(['index.html', 'app/index.html', 'verify/index.html', 'privacy/index.html']);
  });

  it('accepts a dist with the four pages', () => {
    expect(checkDist(dist([...REQUIRED_PAGES]))).toEqual([]);
  });

  it('names each missing page', () => {
    const problems = checkDist(dist(['index.html', 'app/index.html']));
    expect(problems).toHaveLength(2);
    expect(problems.join(' ')).toContain('verify/index.html');
    expect(problems.join(' ')).toContain('privacy/index.html');
  });

  it('names a service worker that is missing, that still has a placeholder, or that lists no page', () => {
    expect(WORKER_FILE).toBe('sw.js');
    expect(checkDist(dist([...REQUIRED_PAGES], null)).join(' ')).toContain('sw.js: the file is missing');
    expect(checkDist(dist([...REQUIRED_PAGES], 'const a = __PRECACHE__; "./app/"')).join(' ')).toContain('__PRECACHE__');
    expect(checkDist(dist([...REQUIRED_PAGES], 'const a = [];')).join(' ')).toContain('does not list ./app/');
  });

  it('names a dist folder that does not exist', () => {
    expect(checkDist(join(tmpdir(), 'no-such-dist-folder')).length).toBeGreaterThan(0);
  });

  it('names a page that is empty', () => {
    const dir = dist([...REQUIRED_PAGES]);
    writeFileSync(join(dir, 'app/index.html'), '');
    expect(checkDist(dir).join(' ')).toContain('app/index.html');
  });

  it('names a page that still holds the placeholder for the product name', () => {
    const dir = dist([...REQUIRED_PAGES]);
    writeFileSync(join(dir, 'index.html'), '<title>%APP_TITLE%</title>');
    expect(checkDist(dir).join(' ')).toContain('%APP_TITLE%');
  });

  it('names a forbidden text that is in the files, such as a beacon address when none was set', () => {
    const dir = dist([...REQUIRED_PAGES]);
    writeFileSync(join(dir, 'app/index.html'), `<title>${appConfig.title}</title><script>fetch("https://beacon.example.test/in")</script>`);
    expect(checkDist(dir)).toEqual([]);
    expect(checkDist(dir, { forbidden: ['https://beacon.example.test/in'] }).join(' ')).toContain('beacon.example.test');
  });
});
