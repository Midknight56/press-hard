import { expect, test, type Page } from '@playwright/test';
import { appConfig } from '../app/app.config.js';
import { expectScreen, holdStamp, noShareSheet, watch, workerReady } from './support.js';

const ORIGIN = 'http://127.0.0.1:4473';
const FAMILIES = ['Saira', 'Saira Condensed', 'Gochi Hand', 'Rubik Mono One'];

async function openFill(page: Page): Promise<void> {
  await page.goto('/app/');
  await expectScreen(page, 'pick');
  await page.click('[data-control="pick-prefilled"]');
  await expectScreen(page, 'fill');
}

/** The families of the faces that the browser has loaded, without quotes. */
const loadedFamilies = (page: Page) =>
  page.evaluate(async () => {
    await document.fonts.ready;
    return [...new Set([...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family.replace(/^["']|["']$/g, '')))].sort();
  });

test.describe('fonts', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('are served from the app origin and the four families are loaded on the fill screen', async ({ page, context }) => {
    const watcher = watch(context);
    const fontUrls: string[] = [];
    page.on('response', (response) => {
      if (response.request().resourceType() === 'font') fontUrls.push(response.url());
    });
    await openFill(page);
    expect(await loadedFamilies(page)).toEqual([...FAMILIES].sort());
    expect(fontUrls.length, 'font requests seen').toBeGreaterThanOrEqual(FAMILIES.length);
    for (const url of fontUrls) {
      expect(new URL(url).origin, url).toBe(ORIGIN);
      expect(url).toMatch(/\.woff2$/);
    }
    // The page really draws with them: the computed family of the wordmark, a label, a written value and the button.
    const used = await page.evaluate(() => {
      const family = (selector: string) => getComputedStyle(document.querySelector(selector) as Element).fontFamily;
      return {
        brand: family('.brand'),
        label: family('[data-box="sheet"] .label'),
        written: family('[data-control="party-giver"]'),
        button: family('[data-control="stamp"]'),
      };
    });
    expect(used.brand).toContain('Rubik Mono One');
    expect(used.label).toContain('Saira Condensed');
    expect(used.written).toContain('Gochi Hand');
    expect(used.button).toContain('Saira');
    watcher.assertClean();
  });

  test('are still there offline, from the service worker cache', async ({ page, context }) => {
    await page.goto('/app/');
    await expectScreen(page, 'pick');
    await workerReady(page);
    await context.setOffline(true);
    await page.reload();
    await expectScreen(page, 'pick');
    await page.click('[data-control="pick-prefilled"]');
    await expectScreen(page, 'fill');
    expect(await loadedFamilies(page)).toEqual([...FAMILIES].sort());
    await context.setOffline(false);
  });
});

/** Every pseudo element content string on the page, with the element's class and whether it is drawn. */
const pseudoContents = (page: Page) =>
  page.evaluate(() => {
    const found: { where: string; content: string; drawn: boolean }[] = [];
    for (const el of Array.from(document.querySelectorAll('body *'))) {
      for (const pseudo of ['::before', '::after'] as const) {
        const style = getComputedStyle(el, pseudo);
        if (style.content === 'none' || style.content === 'normal' || style.content === '""') continue;
        const rect = el.getBoundingClientRect();
        const drawn = style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0 && style.opacity !== '0';
        found.push({ where: `${el.tagName.toLowerCase()}.${String(el.getAttribute('class'))}${pseudo}`, content: style.content, drawn });
      }
    }
    return found;
  });

/** Every place where text could be read: the page text, the text nodes, and the attributes that readers use. */
const readableText = (page: Page) =>
  page.evaluate(() => {
    const parts = [document.body.innerText, document.body.textContent ?? ''];
    for (const el of Array.from(document.querySelectorAll('[aria-label], [title], img[alt]'))) {
      parts.push(el.getAttribute('aria-label') ?? '', el.getAttribute('title') ?? '', el.getAttribute('alt') ?? '');
    }
    return parts.join('\n');
  });

test.describe('decorative words', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('the instruction line is drawn on the fill screen and is not in the page text', async ({ page }) => {
    await openFill(page);
    const line = (await pseudoContents(page)).find((p) => p.content.includes('PEN ONLY') && p.content.includes('YOU ARE MAKING 2 COPIES'));
    expect(line, 'a pseudo element with the instruction line').toBeDefined();
    expect(line?.drawn, 'the instruction line is drawn').toBe(true);
    const text = await readableText(page);
    expect(text).not.toMatch(/PEN ONLY|YOU ARE MAKING/);
  });

  test('the stamp words and the date are drawn on the sealed sheets and are not in the page text', async ({ page }) => {
    await noShareSheet(page);
    await openFill(page);
    await holdStamp(page, 1300);
    await expectScreen(page, 'copy');
    const all = await pseudoContents(page);
    for (const needle of ['HANDED OVER', 'SEALED']) {
      const hits = all.filter((p) => p.content.includes(needle));
      expect(hits.length, `pseudo elements with ${needle}`).toBeGreaterThanOrEqual(2);
      expect(
        hits.every((h) => h.drawn),
        `${needle} is drawn: ${JSON.stringify(hits)}`,
      ).toBe(true);
    }
    const dates = all.filter((p) => /\d{1,2} [A-Z]{3} \d{4}/.test(p.content));
    expect(dates.length, 'a drawn date on each sheet').toBeGreaterThanOrEqual(2);
    expect(dates.every((d) => d.drawn)).toBe(true);
    const text = await readableText(page);
    expect(text).not.toMatch(/HANDED OVER|SEALED|\d{1,2} [A-Z]{3} \d{4}/);
    // The words of the page that are real text stay: the strip and the seal words.
    await expect(page.locator('.seal-strip-text')).toContainText('Sealed. Seal words:');
  });
});

type Box = { left: number; right: number; top: number; bottom: number };
const boxOf = (page: Page, selector: string): Promise<Box> =>
  page.evaluate((s) => {
    const el = document.querySelector(s);
    if (el === null) throw new Error(`no element for ${s}`);
    const r = el.getBoundingClientRect();
    return { left: r.left + window.scrollX, right: r.right + window.scrollX, top: r.top + window.scrollY, bottom: r.bottom + window.scrollY };
  }, selector);
const apart = (a: Box, b: Box) => a.right <= b.left + 0.01 || b.right <= a.left + 0.01 || a.bottom <= b.top + 0.01 || b.bottom <= a.top + 0.01;

test.describe('fill screen, 1920x1080', () => {
  test.use({ viewport: { width: 1920, height: 1080 } });

  test('three columns: the rail, the sheet and the tray do not overlap, are whole in the page, and the stamp is in the tray', async ({ page }) => {
    await openFill(page);
    const rail = await boxOf(page, '.bar');
    const sheet = await boxOf(page, '[data-screen="fill"] [data-box="sheet"]');
    const tray = await boxOf(page, '.stamp-area');
    const stamp = await boxOf(page, '[data-control="stamp"]');
    const page_ = await page.evaluate(() => ({ w: document.documentElement.clientWidth, h: document.documentElement.scrollHeight, sw: document.documentElement.scrollWidth }));
    expect(apart(rail, sheet), 'the rail and the sheet overlap').toBe(true);
    expect(apart(sheet, tray), 'the sheet and the tray overlap').toBe(true);
    expect(apart(rail, tray), 'the rail and the tray overlap').toBe(true);
    expect(rail.right, 'the rail is left of the sheet').toBeLessThanOrEqual(sheet.left);
    expect(sheet.right, 'the sheet is left of the tray').toBeLessThanOrEqual(tray.left);
    for (const [name, b] of [['rail', rail], ['sheet', sheet], ['tray', tray]] as const) {
      expect(b.left, `${name} left`).toBeGreaterThanOrEqual(0);
      expect(b.top, `${name} top`).toBeGreaterThanOrEqual(0);
      expect(b.right, `${name} right`).toBeLessThanOrEqual(page_.w);
      expect(b.bottom, `${name} bottom`).toBeLessThanOrEqual(page_.h);
    }
    expect(stamp.left, 'Hold to seal inside the tray, left').toBeGreaterThanOrEqual(tray.left);
    expect(stamp.right, 'Hold to seal inside the tray, right').toBeLessThanOrEqual(tray.right);
    expect(stamp.top, 'Hold to seal inside the tray, top').toBeGreaterThanOrEqual(tray.top);
    expect(stamp.bottom, 'Hold to seal inside the tray, bottom').toBeLessThanOrEqual(tray.bottom);
    expect(page_.sw, 'no sideways scroll').toBeLessThanOrEqual(page_.w);
  });

  test('the rail holds the wordmark, the tagline and the five nav buttons', async ({ page }) => {
    await openFill(page);
    const rail = await boxOf(page, '.bar');
    await expect(page.locator('.bar .tagline')).toBeVisible();
    await expect(page.locator('.bar .tagline')).toHaveText('The carbon copy, back from the dead.');
    for (const control of ['nav-home', 'nav-library', 'nav-help', 'nav-verify', 'nav-sound']) {
      const b = await boxOf(page, `[data-control="${control}"]`);
      expect(b.left, control).toBeGreaterThanOrEqual(rail.left);
      expect(b.right, control).toBeLessThanOrEqual(rail.right);
    }
  });
});

test.describe('fill screen, 360x640', () => {
  test.use({ viewport: { width: 360, height: 640 } });

  test('Hold to seal sits in a bar fixed to the bottom of the screen', async ({ page }) => {
    await openFill(page);
    const bar = await page.evaluate(() => {
      const el = document.querySelector('.stamp-area') as HTMLElement;
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      const stamp = (document.querySelector('[data-control="stamp"]') as HTMLElement).getBoundingClientRect();
      return { position: s.position, left: r.left, right: r.right, bottom: r.bottom, top: r.top, stampTop: stamp.top, stampBottom: stamp.bottom, view: window.innerHeight, width: document.documentElement.clientWidth };
    });
    expect(bar.position).toBe('fixed');
    expect(bar.bottom).toBe(bar.view);
    expect(bar.left).toBe(0);
    expect(bar.right).toBe(bar.width);
    expect(bar.stampTop).toBeGreaterThanOrEqual(bar.top);
    expect(bar.stampBottom).toBeLessThanOrEqual(bar.bottom);
    // The bar stays at the bottom while the page scrolls.
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const after = await boxOf(page, '.stamp-area');
    expect(after.bottom - (await page.evaluate(() => window.scrollY)), 'bar bottom after scrolling').toBe(640);
  });

  test('the bar does not cover the last form row when the page is scrolled to the end', async ({ page }) => {
    await openFill(page);
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const result = await page.evaluate(() => {
      const sheet = document.querySelector('[data-screen="fill"] [data-box="sheet"]') as HTMLElement;
      const last = sheet.lastElementChild as HTMLElement;
      const bar = (document.querySelector('.stamp-area') as HTMLElement).getBoundingClientRect();
      const row = last.getBoundingClientRect();
      const signatures = (sheet.querySelector('.signatures') as HTMLElement).getBoundingClientRect();
      return { rowBottom: row.bottom, signaturesBottom: signatures.bottom, barTop: bar.top, atEnd: Math.abs(window.scrollY + window.innerHeight - document.documentElement.scrollHeight) <= 1 };
    });
    expect(result.atEnd, 'the page is scrolled to its end').toBe(true);
    expect(result.rowBottom, 'last row bottom above the bar').toBeLessThanOrEqual(result.barTop);
    expect(result.signaturesBottom, 'signature boxes above the bar').toBeLessThanOrEqual(result.barTop);
  });
});

test.describe('first screen, 390x844', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('draws the app name once, in the top bar, and no visible heading has it', async ({ page }) => {
    await page.goto('/app/');
    await expectScreen(page, 'pick');
    const title = appConfig.title;
    const found = await page.evaluate((name) => {
      const drawn = (el: Element) => {
        const r = el.getBoundingClientRect();
        const s = getComputedStyle(el);
        return r.width > 2 && r.height > 2 && s.visibility !== 'hidden' && s.display !== 'none' && s.clipPath === 'none';
      };
      const withText = Array.from(document.querySelectorAll('body *')).filter(
        (el) => Array.from(el.childNodes).some((n) => n.nodeType === 3 && (n.textContent ?? '').trim() === name) && drawn(el),
      );
      const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6, [role="heading"]')).filter(
        (el) => (el.textContent ?? '').trim() === name && drawn(el),
      );
      return { shown: withText.map((el) => el.className || el.tagName), headings: headings.length, h1: document.querySelectorAll('h1').length };
    }, title);
    expect(found.headings, 'visible headings with the app title').toBe(0);
    expect(found.shown, 'visible elements with the app title').toHaveLength(1);
    expect(found.shown[0]).toBe('brand');
    expect(found.h1, 'h1 elements kept for screen readers').toBe(1);
  });
});