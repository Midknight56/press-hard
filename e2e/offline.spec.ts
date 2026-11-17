import { expect, test } from '@playwright/test';
import { expectScreen, holdStamp, watch, workerReady } from './support.js';

test('offline: load the app, go offline, reload and seal the sample', async ({ page, context }) => {
  const watcher = watch(context);
  await page.goto('/app/');
  await expectScreen(page, 'pick');
  await workerReady(page);

  await context.setOffline(true);
  await page.reload();
  await expectScreen(page, 'pick');
  await page.click('[data-control="pick-sample"]');
  await expectScreen(page, 'fill');
  await holdStamp(page, 1300);
  await expectScreen(page, 'copy');
  await expect(page.locator('.carbon-sheet .seal-words')).toHaveText(/^[a-z]+(-[a-z]+){3}$/);

  // The other pages come from the same cache.
  await page.goto('/verify/');
  await expectScreen(page, 'verify');
  await page.goto('/');
  await expectScreen(page, 'landing');
  await page.goto('/privacy/');
  await expectScreen(page, 'privacy');
  await context.setOffline(false);
  watcher.assertClean();
});

test('offline needs the worker: with the worker blocked an offline reload fails', async ({ browser }) => {
  const context = await browser.newContext({ serviceWorkers: 'block' });
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:4173/app/');
  await expectScreen(page, 'pick');
  expect(await page.evaluate(() => navigator.serviceWorker.controller)).toBeNull();
  await context.setOffline(true);
  await expect(page.reload()).rejects.toThrow();
  await context.close();
});