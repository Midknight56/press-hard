import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { expect, test } from '@playwright/test';
import { parseCopyFile, sealWords, verifyRecord } from 'core';
import {
  addPhoto,
  editRecordValue,
  expectScreen,
  holdStamp,
  makeJpeg,
  noShareSheet,
  printCount,
  sign,
  stubPrint,
  tearOffTo,
  watch,
  workerReady,
  writeText,
} from './support.js';

test('good path: pick, fill, photo, sign twice, press, tear off, verify, change one line', async ({ page, context }, testInfo) => {
  const watcher = watch(context);
  await noShareSheet(page);
  await stubPrint(page);
  await page.goto('/app/');
  await expectScreen(page, 'pick');

  // Pick a form and fill it.
  await page.click('[data-control="pick-rental-return"]');
  await expectScreen(page, 'fill');
  await expect(page.locator('[data-control="stamp"]')).toHaveAttribute('data-locked', 'true');
  await page.fill('[data-control="party-giver"]', 'Mara Oduya');
  await page.fill('[data-control="party-receiver"]', 'Tobin Larch');
  await page.fill('[data-control="field-item"]', 'Cargo trailer');
  await page.selectOption('[data-control="field-condition"]', 'good');
  await page.fill('[data-control="field-mileage"]', '312.5');

  // Add a photo of 4000 by 3000 px. The app must shrink it to 1600 by 1200.
  const big = await makeJpeg(page, 4000, 3000, 1);
  await addPhoto(page, 'add-photo-photo-front', big, 'front.jpg');
  await expect(page.locator('[data-field="photo-front"] img.photo')).toBeVisible();
  await expect(page.locator('[data-field="photo-front"] .photo-size')).toContainText('KB');

  // The stamp stays locked until both signatures are in.
  await expect(page.locator('[data-control="stamp"]')).toHaveAttribute('data-locked', 'true');
  await sign(page, 'signature-giver');
  await expect(page.locator('[data-control="stamp"]')).toHaveAttribute('data-locked', 'true');
  await sign(page, 'signature-receiver');
  await expect(page.locator('[data-control="stamp"]')).toHaveAttribute('data-locked', 'false');

  // Press and hold with a real pointer for 1300 ms.
  await holdStamp(page, 1300);
  await expectScreen(page, 'copy');
  await expect(page.locator('.ink-carbon')).toBeVisible();
  const words = (await page.locator('.carbon-sheet .seal-words').textContent()) ?? '';
  expect(words).toMatch(/^[a-z]+(-[a-z]+){3}$/);
  await expect(page.locator('.top-sheet .seal-words')).toHaveText(words);
  await expect(page.locator('[data-role="size"]')).toContainText('File size:');

  // Tear off.
  const copy = await tearOffTo(page, testInfo, 'copy.html');
  expect(copy.fileName).toBe(`copy-${words.split('-').slice(0, 2).join('-')}.html`);
  const parsed = parseCopyFile(copy.text);
  expect(parsed.ok).toBe(true);
  if (!parsed.ok) return;
  expect(verifyRecord(parsed.record)).toBe('matches');
  expect(sealWords(parsed.record.seal as string)).toBe(words);
  // The photo size check: 4000 by 3000 comes out 1600 by 1200.
  expect(parsed.record.photos).toHaveLength(1);
  expect(parsed.record.photos[0]?.width).toBe(1600);
  expect(parsed.record.photos[0]?.height).toBe(1200);
  await expect(page.locator('[data-role="tear-status"]')).toHaveText('Copy saved to your downloads.');

  // Try to change this copy: edit one line of a duplicate and see the broken seal.
  await page.click('[data-control="tamper"]');
  await expectScreen(page, 'tamper');
  await expect(page.locator('[data-role="verdict"]')).toHaveText('Seal matches');
  await page.fill('[data-control="field-item"]', 'Cargo trailor');
  await expect(page.locator('[data-role="verdict"]')).toHaveText('Changed after sealing');
  await expect(page.locator('[data-field="item"]')).toHaveClass(/changed/);
  await expect(page.locator('[data-field="item"] [data-role="diff"]')).toContainText('Cargo trailer');
  await expect(page.locator('.line.changed')).toHaveCount(1);
  await page.click('[data-control="back"]');
  await expectScreen(page, 'copy');

  // Print: the button opens the print layout, which has the seal words and the full seal in its foot.
  await page.click('[data-control="print"]');
  expect(await printCount(page)).toBe(1);
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('.print-foot')).toBeVisible();
  await expect(page.locator('.print-foot')).toContainText(words);
  await expect(page.locator('[data-role="print-seal"]')).toHaveText(parsed.record.seal as string);
  await expect(page.locator('.carbon-sheet')).toBeHidden();
  await page.emulateMedia({ media: 'screen' });

  // Open the downloaded file from disk and read its own check.
  const fileUrl = pathToFileURL(copy.path).href;
  watcher.allowFile(fileUrl);
  const filePage = await context.newPage();
  await filePage.goto(fileUrl);
  await expect(filePage.locator('#stamp')).toHaveText('Seal matches this copy');
  await filePage.close();

  // Load the file in the verify page.
  await page.goto('/verify/');
  await expectScreen(page, 'verify');
  await page.setInputFiles('[data-control="verify-file"]', copy.path);
  await expect(page.locator('[data-role="verdict"]')).toHaveText('Seal matches');
  await page.fill('[data-control="verify-typed"]', words.replace(/-/g, ' '));
  await expect(page.locator('[data-role="verdict"]')).toHaveText('Seal matches');
  await page.fill('[data-control="verify-typed"]', 'elm elm elm elm');
  await expect(page.locator('[data-role="verdict"]')).toHaveText('These words belong to another copy');
  await page.fill('[data-control="verify-typed"]', '');

  // Change one line of the copy: the seal breaks and the changed line shows.
  const changed = writeText(testInfo.outputPath('changed.html'), editRecordValue(copy.text, 'Cargo trailer', 'Cargo trailor'));
  await page.setInputFiles('[data-control="verify-file"]', changed);
  await expect(page.locator('[data-role="verdict"]')).toHaveText('Changed after sealing');
  await page.setInputFiles('[data-control="verify-file"]', [copy.path, changed]);
  const line = page.locator('[data-field="item"]');
  await expect(line).toHaveClass(/changed/);
  await expect(line.locator('[data-role="diff"]')).toContainText('Cargo trailer');
  await expect(line.locator('[data-role="diff"]')).toContainText('Cargo trailor');
  await expect(page.locator('[data-role="verdict-b"]')).toHaveText('Second copy: Changed after sealing');

  // The same file on disk says it was changed.
  const changedUrl = pathToFileURL(changed).href;
  watcher.allowFile(changedUrl);
  const changedPage = await context.newPage();
  await changedPage.goto(changedUrl);
  await expect(changedPage.locator('#stamp')).toHaveText('This copy was changed after sealing');
  await changedPage.close();

  expect(readFileSync(copy.path, 'utf8')).toBe(copy.text);

  // Offline: a reload while offline shows the pick screen.
  await page.goto('/app/');
  await expectScreen(page, 'pick');
  await workerReady(page);
  await context.setOffline(true);
  await page.reload();
  await expectScreen(page, 'pick');
  await expect(page.locator('[data-control="pick-sample"]')).toBeVisible();
  await context.setOffline(false);
  watcher.assertClean();
});

test('good path, short: open the sample and seal it', async ({ page, context }) => {
  const watcher = watch(context);
  await page.goto('/app/');
  await page.click('[data-control="pick-sample"]');
  await expectScreen(page, 'fill');
  await expect(page.locator('[data-role="sample-badge"]')).toHaveText('Sample');
  await expect(page.locator('[data-control="stamp"]')).toHaveAttribute('data-locked', 'false');
  await holdStamp(page, 1300);
  await expectScreen(page, 'copy');
  await expect(page.locator('.carbon-sheet .seal-words')).toHaveText(/^[a-z]+(-[a-z]+){3}$/);
  watcher.assertClean();
});
