import { expect, test } from '@playwright/test';
import { expectScreen, holdStamp, printCount, printPages, stubPrint, watch } from './support.js';

for (const format of ['A4', 'Letter'] as const) {
  test(`print layout on ${format}: one top copy, seal words and full seal on every page, photos whole`, async ({ page, context }) => {
    const watcher = watch(context);
    await stubPrint(page);
    await page.goto('/app/');
    await page.click('[data-control="pick-prefilled"]');
    await holdStamp(page, 1300);
    await expectScreen(page, 'copy');
    const words = (await page.locator('.top-sheet .seal-words').textContent()) ?? '';
    expect(words).toMatch(/^[a-z]+(-[a-z]+){3}$/);
    const seal = ((await page.locator('[data-role="print-seal"]').textContent()) ?? '').trim();
    expect(seal).toMatch(/^[0-9a-f]{64}$/);

    await page.click('[data-control="print"]');
    expect(await printCount(page)).toBe(1);

    await page.emulateMedia({ media: 'print' });
    // The print layout hides the controls and the carbon sheet, and keeps each photo whole.
    for (const hidden of ['.bar', '.copy-actions', '.carbon-sheet']) {
      expect(await page.locator(hidden).evaluateAll((els) => els.every((el) => getComputedStyle(el).display === 'none')), hidden).toBe(true);
    }
    const photoRules = await page.locator('img.photo').evaluateAll((els) => els.map((el) => getComputedStyle(el).breakInside));
    expect(photoRules.length).toBeGreaterThan(0);
    expect(photoRules.every((rule) => rule === 'avoid')).toBe(true);
    await page.emulateMedia({ media: 'screen' });

    const pages = await printPages(page, format);
    console.log(`${format} print: ${pages.length} pages, ${pages.map((p) => p.images).join('+')} images drawn`);
    expect(pages.length).toBeGreaterThanOrEqual(1);
    for (const [i, p] of pages.entries()) {
      const flat = p.text.replace(/\s+/g, '');
      expect(flat, `${format} page ${i + 1} has the seal words`).toContain(words);
      expect(flat, `${format} page ${i + 1} has the full seal`).toContain(seal);
    }
    const all = pages.map((p) => p.text).join(' ');
    expect(all).toContain('Cargo trailer, 2 m');
    expect(all.split('Cargo trailer, 2 m')).toHaveLength(2);
    expect(all).not.toContain('Tear off');
    expect(all).not.toContain('Hold to seal');
    expect(pages.reduce((sum, p) => sum + p.images, 0)).toBe(2);
    watcher.assertClean();
  });
}
