import { expect, test } from '@playwright/test';
import { appConfig } from '../app/app.config.js';
import { expectScreen, watch } from './support.js';

test.describe('site', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('the landing page plays the loop from the real screens, with no tap', async ({ page, context }) => {
    const watcher = watch(context);
    await page.goto('/');
    await expectScreen(page, 'landing');
    await expect(page).toHaveTitle(appConfig.title);
    const caption = page.locator('#loop-caption');
    // The loop: the sample form is pressed, the copy appears, one line is changed and the seal breaks.
    await expect(page.locator('#loop [data-screen="fill"]')).toBeVisible();
    await expect(caption).toHaveText('Press and hold the stamp');
    await expect(page.locator('#loop [data-screen="copy"]')).toBeVisible({ timeout: 8000 });
    await expect(page.locator('#loop [data-screen="tamper"]')).toBeVisible({ timeout: 8000 });
    await expect(page.locator('#loop [data-role="verdict"]')).toHaveText('Changed after sealing', { timeout: 8000 });
    await expect(page.locator('#loop .line.changed')).toHaveCount(1);
    await expect(caption).toHaveText('The seal breaks. The line shows.');
    // The loop is for looking: nothing in it takes a tap or a key.
    expect(await page.locator('#loop').evaluate((el) => el.hasAttribute('inert'))).toBe(true);
    watcher.assertClean();
  });

  test('the loop does not move with reduced motion and shows the two last steps', async ({ page, context }) => {
    const watcher = watch(context);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await expect(page.locator('#loop [data-screen="copy"]')).toBeVisible();
    await expect(page.locator('#loop [data-screen="tamper"] [data-role="verdict"]')).toHaveText('Changed after sealing');
    await page.waitForTimeout(1500);
    await expect(page.locator('#loop [data-screen="copy"]')).toBeVisible();
    await expect(page.locator('#loop [data-screen="fill"]')).toHaveCount(0);
    watcher.assertClean();
  });

  test('the pages link to each other and the privacy page lists the beacon events', async ({ page, context }) => {
    const watcher = watch(context);
    await page.goto('/');
    await page.click('[data-control="open-privacy"]');
    await expectScreen(page, 'privacy');
    await expect(page).toHaveURL(/\/privacy\/$/);
    const events = await page.locator('.document li code').allTextContents();
    expect(events).toEqual(['open', 'form_start', 'sealed', 'tear_off', 'verify']);
    await expect(page.locator('.document')).toContainText('also sees the request itself');
    await expect(page.locator('.document')).toContainText('Playwright 1.65.1');
    await expect(page).toHaveTitle(`Privacy, ${appConfig.title}`);
    await page.click('[data-control="open-app"]');
    await expectScreen(page, 'pick');
    await expect(page).toHaveURL(/\/app\/$/);
    await page.click('[data-control="nav-verify"]');
    await expectScreen(page, 'verify');
    await expect(page).toHaveURL(/\/verify\/$/);
    await page.click('[data-control="nav-app"]');
    await expectScreen(page, 'pick');
    await page.goto('/');
    await page.click('[data-control="open-verify"]');
    await expectScreen(page, 'verify');
    watcher.assertClean();
  });

  test('this build sends no beacon: every request is a GET to the site itself', async ({ page, context }) => {
    const watcher = watch(context);
    await page.goto('/app/');
    await page.click('[data-control="pick-prefilled"]');
    await expectScreen(page, 'fill');
    await page.goto('/verify/');
    await page.goto('/privacy/');
    expect(watcher.requests.length).toBeGreaterThan(3);
    expect(watcher.withBody).toEqual([]);
    expect(watcher.foreign).toEqual([]);
    watcher.assertClean();
  });
});
