import { expect, test } from '@playwright/test';
import { walkScreens } from './screens.js';

// The film and the pictures show these screens, so these words must not be visible anywhere.
const BANNED = /sample|simulated|synthetic/i;

test('no screen shows the words sample, simulated or synthetic', async ({ page }, testInfo) => {
  const seen: string[] = [];
  const found: string[] = [];
  await walkScreens(page, testInfo, async (name) => {
    seen.push(name);
    const texts = await page.evaluate(() => [
      `text: ${document.body.innerText}`,
      `document title: ${document.title}`,
      ...[...document.querySelectorAll('[title]')].map((e) => `title: ${e.getAttribute('title') ?? ''}`),
      ...[...document.querySelectorAll('[aria-label]')].map((e) => `aria-label: ${e.getAttribute('aria-label') ?? ''}`),
      ...[...document.querySelectorAll('img[alt]')].map((e) => `alt: ${e.getAttribute('alt') ?? ''}`),
    ]);
    for (const text of texts) {
      const hit = BANNED.exec(text);
      if (hit !== null) {
        const at = hit.index;
        found.push(`${name}: ${text.slice(0, text.indexOf(':'))} holds "${hit[0]}" near "${text.slice(Math.max(0, at - 20), at + 30).replace(/\s+/g, ' ')}"`);
      }
    }
  });
  expect(seen.length, 'the walk visited the screens').toBeGreaterThanOrEqual(10);
  expect(found, 'visible words that are banned').toEqual([]);
});
