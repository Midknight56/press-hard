import { expect, test } from '@playwright/test';
import { collectTextColors, MIN_CONTRAST, textContrast } from '../app/src/layout.js';
import { expectScreen } from './support.js';
import { walkScreens } from './screens.js';

for (const viewport of [
  { width: 390, height: 844 },
  { width: 1280, height: 720 },
]) {
  test.describe(`${viewport.width}x${viewport.height}`, () => {
    test.use({ viewport });

    test('body text has a contrast ratio of 4.5 or more on every screen', async ({ page }, testInfo) => {
      const low: string[] = [];
      let checked = 0;
      await walkScreens(page, testInfo, async (step) => {
        const { items } = await page.evaluate(collectTextColors);
        expect(items.length, `${step} has text`).toBeGreaterThan(0);
        for (const item of items) {
          const ratio = textContrast(item);
          if (ratio === null) {
            low.push(`${step}, ${item.name} "${item.text}": colour not readable (${item.color} on ${item.background})`);
            continue;
          }
          checked += 1;
          if (ratio < MIN_CONTRAST) {
            low.push(`${step}, ${item.name} "${item.text}": ratio ${ratio.toFixed(2)} (${item.color} on ${item.background})`);
          }
        }
      });
      expect(low).toEqual([]);
      expect(checked).toBeGreaterThan(100);
    });
  });
}

test.describe('instructions', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('each instruction has at most 6 words and shows at most three times', async ({ page }) => {
    const shown: boolean[] = [];
    for (let visit = 1; visit <= 5; visit++) {
      await page.goto('/app/');
      await expectScreen(page, 'pick');
      const line = page.locator('[data-screen="pick"] [data-role="instruction"]');
      const visible = await line.isVisible();
      shown.push(visible);
      if (visible) {
        const words = ((await line.textContent()) ?? '').trim().split(/\s+/);
        expect(words.length, `the instruction "${words.join(' ')}"`).toBeLessThanOrEqual(6);
      }
    }
    expect(shown).toEqual([true, true, true, false, false]);
    await page.click('[data-control="nav-help"]');
    await expectScreen(page, 'help');
    await expect(page.locator('[data-screen="help"] li').first()).toContainText('Pick a form');
  });
});
