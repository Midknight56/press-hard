import { expect, test } from '@playwright/test';
import { collectBoxes, findLayoutProblems, VIEWPORTS } from '../app/src/layout.js';
import { expectScreen } from './support.js';
import { walkScreens } from './screens.js';

for (const viewport of VIEWPORTS) {
  test.describe(`${viewport.width}x${viewport.height}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    test('every control on every screen fits', async ({ page }, testInfo) => {
      const problems: string[] = [];
      const seen: string[] = [];
      await walkScreens(page, testInfo, async (step) => {
        const result = await page.evaluate(collectBoxes);
        seen.push(`${step}: ${result.boxes.length} controls`);
        expect(result.boxes.length, `${step} has controls`).toBeGreaterThan(0);
        for (const p of findLayoutProblems(result.boxes, { width: result.viewWidth, height: viewport.height }, result.pageHeight)) {
          problems.push(`${viewport.width}x${viewport.height}, ${step}, ${p.control}: ${p.problem}`);
        }
        if (result.scrollWidth > result.viewWidth) {
          problems.push(`${viewport.width}x${viewport.height}, ${step}, ${result.screen}: the page scrolls sideways (${result.scrollWidth} px in ${result.viewWidth} px)`);
        }
      });
      expect(problems).toEqual([]);
      expect(seen.length).toBeGreaterThanOrEqual(10);
    });
  });
}

test.describe('keyboard', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  async function tabThrough(page: import('@playwright/test').Page, screen: string): Promise<void> {
    const expected = await page.evaluate(() =>
      Array.from(document.querySelectorAll('[data-control]'))
        .filter((el) => el.getBoundingClientRect().width > 0)
        .map((el) => el.getAttribute('data-control') as string),
    );
    expect(expected.length, `${screen} has controls`).toBeGreaterThan(0);
    const reached = new Set<string>();
    const unmarked: string[] = [];
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    for (let i = 0; i < expected.length + 12; i++) {
      await page.keyboard.press('Tab');
      const state = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (el === null) return null;
        const style = getComputedStyle(el);
        return {
          control: el.getAttribute('data-control'),
          outline: style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0,
        };
      });
      if (state?.control) {
        reached.add(state.control);
        if (!state.outline) unmarked.push(state.control);
      }
    }
    expect([...expected].filter((c) => !reached.has(c)), `${screen}: controls the Tab key did not reach`).toEqual([]);
    expect(unmarked, `${screen}: focused controls with no visible focus mark`).toEqual([]);
  }

  test('the Tab key reaches every control, with a visible focus mark', async ({ page }) => {
    await page.goto('/app/');
    await expectScreen(page, 'pick');
    await tabThrough(page, 'pick');
    await page.click('[data-control="pick-sample"]');
    await expectScreen(page, 'fill');
    await tabThrough(page, 'fill');
    await page.goto('/verify/');
    await expectScreen(page, 'verify');
    await tabThrough(page, 'verify');
  });
});
