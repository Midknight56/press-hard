import type { Page, TestInfo } from '@playwright/test';
import { editRecordValue, expectScreen, holdStamp, noShareSheet, tearOffTo, writeText } from './support.js';

/**
 * Opens every screen of the app in turn, through the controls a person would use, and calls
 * `visit` on each one. Later tasks add their screens to this list.
 */
export async function walkScreens(
  page: Page,
  testInfo: TestInfo,
  visit: (name: string) => Promise<void>,
): Promise<void> {
  await noShareSheet(page);
  await page.goto('/app/');
  await expectScreen(page, 'pick');
  await visit('pick');

  await page.click('[data-control="pick-blank"]');
  await expectScreen(page, 'fill');
  await page.click('[data-control="add-line-text"]');
  await page.click('[data-control="add-line-photo"]');
  await visit('fill, blank form with two lines');

  await page.click('[data-control="nav-home"]');
  await page.click('[data-control="pick-rental-return"]');
  await expectScreen(page, 'fill');
  await visit('fill, rental return, empty');

  await page.click('[data-control="nav-home"]');
  await page.click('[data-control="pick-tool-loan"]');
  await expectScreen(page, 'fill');
  await visit('fill, tool loan, empty');

  await page.click('[data-control="nav-home"]');
  await page.click('[data-control="pick-prefilled"]');
  await expectScreen(page, 'fill');
  await visit('fill, prefilled');

  await holdStamp(page, 1300);
  await expectScreen(page, 'copy');
  // The peel moves the fold for 0.7 s. The layout is measured at its rest place.
  await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished)).then(() => undefined));
  await visit('copy');
  const first = await tearOffTo(page, testInfo, 'walk-copy.html');

  await page.click('[data-control="tamper"]');
  await expectScreen(page, 'tamper');
  await visit('tamper');
  await page.fill('[data-control="field-item"]', 'Cargo trailer, 3 m');
  await page.locator('[data-role="diff"]').first().waitFor();
  await visit('tamper, one line changed');
  await page.click('[data-control="back"]');
  await expectScreen(page, 'copy');

  await page.click('[data-control="nav-library"]');
  await expectScreen(page, 'library');
  await visit('library');
  await page.click('[data-control^="delete-"]');
  await visit('library, delete box');
  await page.click('[data-control="cancel-delete"]');

  await page.click('[data-control="nav-help"]');
  await expectScreen(page, 'help');
  await visit('help');

  await page.goto('/verify/');
  await expectScreen(page, 'verify');
  await visit('verify');
  await page.setInputFiles('[data-control="verify-file"]', first.path);
  await page.locator('[data-role="verdict"]').waitFor();
  await visit('verify, one file');
  const changed = writeText(
    testInfo.outputPath('walk-changed.html'),
    editRecordValue(first.text, 'Cargo trailer, 2 m', 'Cargo trailer, 3 m'),
  );
  await page.setInputFiles('[data-control="verify-file"]', [first.path, changed]);
  await page.locator('[data-role="diff"]').first().waitFor();
  await visit('verify, two files');

  await page.goto('/');
  await expectScreen(page, 'landing');
  await visit('landing');
  await page.goto('/privacy/');
  await expectScreen(page, 'privacy');
  await visit('privacy');
}
