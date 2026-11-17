import { pathToFileURL } from 'node:url';
import { expect, test } from '@playwright/test';
import {
  addPhoto,
  editRecordValue,
  expectScreen,
  holdStamp,
  makeJpeg,
  noShareSheet,
  printPages,
  removeSeal,
  sign,
  tearOffTo,
  watch,
  writeText,
} from './support.js';

test('bad path: release the stamp early and nothing is sealed', async ({ page, context }) => {
  const watcher = watch(context);
  await page.goto('/app/');
  await page.click('[data-control="pick-prefilled"]');
  await expectScreen(page, 'fill');
  // 800 ms hold, release, 600 ms more: 1400 ms in all, past the 1200 ms hold.
  await holdStamp(page, 800);
  await page.waitForTimeout(600);
  await expectScreen(page, 'fill');
  await expect(page.locator('[data-screen="copy"]')).toHaveCount(0);
  await expect(page.locator('[data-control="stamp"]')).toHaveAttribute('data-progress', '0');
  await page.click('[data-control="nav-library"]');
  await expect(page.locator('[data-role="empty"]')).toHaveText('No sealed records yet.');
  watcher.assertClean();
});

test('bad path: a seventh photo is refused in one line', async ({ page, context }) => {
  const watcher = watch(context);
  await page.goto('/app/');
  await page.click('[data-control="pick-blank"]');
  await expectScreen(page, 'fill');
  for (let i = 0; i < 7; i++) await page.click('[data-control="add-line-photo"]');
  for (let i = 1; i <= 6; i++) {
    await addPhoto(page, `add-photo-line-${i}`, await makeJpeg(page, 200, 150, i), `p${i}.jpg`);
    await expect(page.locator(`[data-field="line-${i}"] img.photo`)).toBeVisible();
  }
  await addPhoto(page, 'add-photo-line-7', await makeJpeg(page, 200, 150, 7), 'p7.jpg');
  await expect(page.locator('[data-role="note"]')).toHaveText('Six photos is the most.');
  await expect(page.locator('[data-field="line-7"] img.photo')).toHaveCount(0);
  await expect(page.locator('img.photo')).toHaveCount(6);
  watcher.assertClean();
});

test('bad path: changed copy, text file, copy with no seal', async ({ page, context }, testInfo) => {
  const watcher = watch(context);
  await noShareSheet(page);
  await page.goto('/app/');
  await page.click('[data-control="pick-prefilled"]');
  await holdStamp(page, 1300);
  await expectScreen(page, 'copy');
  const copy = await tearOffTo(page, testInfo, 'copy.html');

  // Try to change the copy in the app: the stored original still shows Seal matches.
  await page.click('[data-control="tamper"]');
  await page.selectOption('[data-control="field-condition"]', 'damaged');
  await expect(page.locator('[data-role="verdict"]')).toHaveText('Changed after sealing');
  await page.click('[data-control="back"]');
  await page.click('[data-control="library"]');
  await page.click('[data-control^="open-"]');
  await expectScreen(page, 'copy');
  await expect(page.locator('[data-role="stored-verdict"]')).toHaveText('Stored copy: Seal matches');
  await expect(page.locator('.top-sheet [data-field="condition"] .value')).toHaveText('worn');

  const changed = writeText(testInfo.outputPath('changed.html'), editRecordValue(copy.text, 'worn', 'good'));
  const unsealed = writeText(testInfo.outputPath('unsealed.html'), removeSeal(copy.text));
  const notACopy = writeText(testInfo.outputPath('note.txt'), 'This is only a text file.\n');

  // The changed file, read by the file itself in a browser.
  const changedUrl = pathToFileURL(changed).href;
  watcher.allowFile(changedUrl);
  const filePage = await context.newPage();
  await filePage.goto(changedUrl);
  await expect(filePage.locator('#stamp')).toHaveText('This copy was changed after sealing');
  await filePage.close();

  await page.goto('/verify/');
  await expectScreen(page, 'verify');
  await page.setInputFiles('[data-control="verify-file"]', changed);
  await expect(page.locator('[data-role="verdict"]')).toHaveText('Changed after sealing');

  await page.setInputFiles('[data-control="verify-file"]', notACopy);
  await expect(page.locator('[data-role="error"]')).toHaveText('This file is not a copy file');
  await expect(page.locator('[data-role="verdict"]')).toHaveCount(0);

  await page.setInputFiles('[data-control="verify-file"]', unsealed);
  await expect(page.locator('[data-role="verdict"]')).toHaveText('This copy has no seal');

  // The page still works after the bad files.
  await page.setInputFiles('[data-control="verify-file"]', copy.path);
  await expect(page.locator('[data-role="verdict"]')).toHaveText('Seal matches');
  watcher.assertClean();
});

test('bad path: storage blocked, the app still fills, seals and tears off', async ({ page, context }, testInfo) => {
  const watcher = watch(context);
  await context.addInitScript(() => {
    const blocked = () => {
      throw new DOMException('The operation is insecure.', 'SecurityError');
    };
    Object.defineProperty(window, 'indexedDB', { configurable: true, get: blocked });
    Object.defineProperty(window, 'localStorage', { configurable: true, get: blocked });
  });
  await noShareSheet(page);
  await page.goto('/app/');
  await expectScreen(page, 'pick');
  await expect(page.locator('[data-role="notice"]')).toHaveText('Drafts will not be kept on this device.');
  await page.click('[data-control="pick-prefilled"]');
  await expectScreen(page, 'fill');
  await page.fill('[data-control="field-damage"]', 'Scratch on the right panel');
  await holdStamp(page, 1300);
  await expectScreen(page, 'copy');
  const copy = await tearOffTo(page, testInfo, 'blocked.html');
  expect(copy.text).toContain('Scratch on the right panel');
  await page.click('[data-control="library"]');
  await expect(page.locator('[data-role="record"]')).toHaveCount(1);
  watcher.assertClean();
});

test('bad path: a record with 6 photos prints with no photo split', async ({ page, context }) => {
  const watcher = watch(context);
  await page.goto('/app/');
  await page.click('[data-control="pick-blank"]');
  for (let i = 0; i < 6; i++) await page.click('[data-control="add-line-photo"]');
  for (let i = 1; i <= 6; i++) {
    await addPhoto(page, `add-photo-line-${i}`, await makeJpeg(page, 1600, 1200, i), `big${i}.jpg`);
    await expect(page.locator(`[data-field="line-${i}"] img.photo`)).toBeVisible();
  }
  await page.fill('[data-control="party-giver"]', 'Mara Oduya');
  await page.fill('[data-control="party-receiver"]', 'Tobin Larch');
  await sign(page, 'signature-giver');
  await sign(page, 'signature-receiver');
  await holdStamp(page, 1300);
  await expectScreen(page, 'copy');
  const words = (await page.locator('.top-sheet .seal-words').textContent()) ?? '';
  const seal = ((await page.locator('[data-role="print-seal"]').textContent()) ?? '').trim();

  for (const format of ['A4', 'Letter'] as const) {
    const pages = await printPages(page, format);
    console.log(`${format} print: ${pages.length} pages, ${pages.map((p) => p.images).join('+')} images drawn`);
    // 6 photos of 4 by 3 need more than one page.
    expect(pages.length, `${format} pages`).toBeGreaterThan(1);
    for (const [i, p] of pages.entries()) {
      const flat = p.text.replace(/\s+/g, '');
      expect(flat, `${format} page ${i + 1} has the seal words`).toContain(words);
      expect(flat, `${format} page ${i + 1} has the full seal`).toContain(seal);
    }
    // A photo cut in two would be drawn on two pages: 6 photos must be drawn exactly 6 times in all.
    expect(pages.reduce((sum, p) => sum + p.images, 0), `${format} images drawn`).toBe(6);
  }
  watcher.assertClean();
});

test.describe('service worker blocked', () => {
  test.use({ serviceWorkers: 'block' });

  test('bad path: a blocked service worker leaves the app working', async ({ page, context }) => {
    const watcher = watch(context);
    await page.goto('/app/');
    await expectScreen(page, 'pick');
    expect(await page.evaluate(() => navigator.serviceWorker.controller)).toBeNull();
    expect(await page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length)).toBe(0);
    await page.click('[data-control="pick-prefilled"]');
    await holdStamp(page, 1300);
    await expectScreen(page, 'copy');
    await page.goto('/verify/');
    await expectScreen(page, 'verify');
    watcher.assertClean();
  });
});
