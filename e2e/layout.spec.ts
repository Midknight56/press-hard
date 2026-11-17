import { expect, test } from '@playwright/test';
import {
  collectBoxes,
  collectFacts,
  findCentreProblems,
  findFirstViewProblems,
  findLayoutProblems,
  findPictureProblems,
  VIEWPORTS,
} from '../app/src/layout.js';
import { expectScreen, holdStamp, noShareSheet } from './support.js';
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
        // The first view is the page at scroll 0.
        await page.evaluate(() => window.scrollTo(0, 0));
        const facts = await page.evaluate(collectFacts);
        const where = `${viewport.width}x${viewport.height}, ${step}`;
        const more = [
          ...findPictureProblems(facts.pictures),
          ...findCentreProblems(facts.screen, facts.column, facts.boxes, facts.viewWidth),
          ...findFirstViewProblems(facts.screen, facts.firstView, { width: facts.viewWidth, height: viewport.height }),
        ];
        for (const p of more) problems.push(`${where}, ${p.control}: ${p.problem}`);
        if (result.scrollWidth > result.viewWidth) {
          problems.push(`${viewport.width}x${viewport.height}, ${step}, ${result.screen}: the page scrolls sideways (${result.scrollWidth} px in ${result.viewWidth} px)`);
        }
      });
      expect(problems).toEqual([]);
      expect(seen.length).toBeGreaterThanOrEqual(10);
    });
  });
}

test.describe('top nav at 360 wide', () => {
  test.use({ viewport: { width: 360, height: 640 } });

  test('the five buttons sit on one row', async ({ page }) => {
    await page.goto('/app/');
    await expectScreen(page, 'pick');
    const tops = await page.evaluate(() =>
      Array.from(document.querySelectorAll('nav [data-control]')).map((el) => ({
        control: el.getAttribute('data-control'),
        top: Math.round(el.getBoundingClientRect().top),
        bottom: Math.round(el.getBoundingClientRect().bottom),
      })),
    );
    expect(tops.map((t) => t.control)).toEqual(['nav-home', 'nav-library', 'nav-help', 'nav-verify', 'nav-sound']);
    expect(new Set(tops.map((t) => t.top)).size, `the nav buttons are on more than one row: ${JSON.stringify(tops)}`).toBe(1);
  });
});

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
    await page.click('[data-control="pick-prefilled"]');
    await expectScreen(page, 'fill');
    await tabThrough(page, 'fill');
    await page.goto('/verify/');
    await expectScreen(page, 'verify');
    await tabThrough(page, 'verify');
  });
});

type Box = { x: number; y: number; width: number; height: number };

async function sealPrefilled(page: import('@playwright/test').Page): Promise<void> {
  await noShareSheet(page);
  await page.goto('/app/');
  await expectScreen(page, 'pick');
  await page.click('[data-control="pick-prefilled"]');
  await expectScreen(page, 'fill');
  await holdStamp(page, 1300);
  await expectScreen(page, 'copy');
}

const settle = (page: import('@playwright/test').Page) =>
  page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished)).then(() => undefined));

const sheetBox = async (page: import('@playwright/test').Page, which: 'top' | 'carbon'): Promise<Box> => {
  const box = await page.locator(`.${which}-sheet [data-box="sheet"]`).boundingBox();
  if (box === null) throw new Error(`the ${which} sheet has no box`);
  return box;
};

/** Which sheet is drawn on top at the middle of the area where they overlap. */
const frontAt = (page: import('@playwright/test').Page) =>
  page.evaluate(() => {
    const r = (s: string) => (document.querySelector(`${s} [data-box="sheet"]`) as HTMLElement).getBoundingClientRect();
    const first = r('.carbon-sheet');
    window.scrollBy(0, first.top - 100);
    const t = r('.top-sheet');
    const c = r('.carbon-sheet');
    const x = (Math.max(t.left, c.left) + Math.min(t.right, c.right)) / 2;
    const y = Math.max(t.top, c.top) + 40;
    const hit = document.elementFromPoint(x, y);
    return hit?.closest('.top-sheet') ? 'top' : hit?.closest('.carbon-sheet') ? 'carbon' : 'neither';
  });

test.describe('copy screen sheets, 360x640', () => {
  test.use({ viewport: { width: 360, height: 640 } });

  test('the carbon copy shows a blue strip on the right and the bottom, inside 16 px', async ({ page }) => {
    await sealPrefilled(page);
    await settle(page);
    const top = await sheetBox(page, 'top');
    const carbon = await sheetBox(page, 'carbon');
    const view = await page.evaluate(() => document.documentElement.clientWidth);
    expect(carbon.x + carbon.width - (top.x + top.width), 'carbon right edge beyond the top sheet').toBeGreaterThanOrEqual(20);
    expect(carbon.y + carbon.height - (top.y + top.height), 'carbon bottom edge below the top sheet').toBeGreaterThanOrEqual(20);
    expect(view - (carbon.x + carbon.width), 'carbon to the right screen edge').toBeGreaterThanOrEqual(16);
    expect(top.x, 'top sheet to the left screen edge').toBeGreaterThanOrEqual(16);
    expect(view - (top.x + top.width), 'top sheet to the right screen edge').toBeGreaterThanOrEqual(16);
  });

  test('swap-sheets brings the other sheet to the front, without motion', async ({ page }) => {
    await sealPrefilled(page);
    await settle(page);
    const swap = page.locator('[data-control="swap-sheets"]');
    await expect(swap).toHaveValue('Show carbon copy');
    expect(await frontAt(page)).toBe('top');
    await swap.click();
    expect(await frontAt(page)).toBe('carbon');
    await expect(swap).toHaveValue('Show top copy');
    expect(await page.evaluate(() => document.getAnimations().filter((a) => a.playState === 'running').length)).toBe(0);
    await swap.click();
    expect(await frontAt(page)).toBe('top');
  });

  test('at the end of the hold the whole carbon copy is in view, and the peel takes 3.3 s', async ({ page }) => {
    await sealPrefilled(page);
    const info = await page.evaluate(() => {
      const a = document.getAnimations().find((x) => (x as CSSAnimation).animationName === 'peel');
      if (a === undefined) return null;
      a.pause();
      a.currentTime = 1800;
      return a.effect?.getComputedTiming().duration ?? null;
    });
    expect(info, 'a running peel animation').toBe(3300);
    const top = await sheetBox(page, 'top');
    const carbon = await sheetBox(page, 'carbon');
    expect(top.x + top.width, 'the peeled sheet is clear of the carbon copy').toBeLessThanOrEqual(carbon.x);
  });
});

test.describe('copy screen sheets, 360x640, reduced motion', () => {
  test.use({ viewport: { width: 360, height: 640 }, reducedMotion: 'reduce' });

  test('there is no peel and the carbon copy fades in at its rest place', async ({ page }) => {
    await sealPrefilled(page);
    const names = await page.evaluate(() => document.getAnimations().map((a) => (a as CSSAnimation).animationName));
    expect(names).not.toContain('peel');
    await settle(page);
    await expect(page.locator('.carbon-sheet')).toHaveCSS('opacity', '1');
    const top = await sheetBox(page, 'top');
    const carbon = await sheetBox(page, 'carbon');
    expect(carbon.x + carbon.width - (top.x + top.width)).toBeGreaterThanOrEqual(20);
  });
});

test.describe('copy screen sheets, 1920x1080', () => {
  test.use({ viewport: { width: 1920, height: 1080 } });

  test('the sheets sit side by side, whole, 24 px apart, centred, with labels', async ({ page }) => {
    await sealPrefilled(page);
    await settle(page);
    const top = await sheetBox(page, 'top');
    const carbon = await sheetBox(page, 'carbon');
    const view = await page.evaluate(() => ({ w: document.documentElement.clientWidth, h: document.documentElement.scrollHeight }));
    const overlap = top.x < carbon.x + carbon.width && carbon.x < top.x + top.width && top.y < carbon.y + carbon.height && carbon.y < top.y + top.height;
    expect(overlap, 'the sheets overlap').toBe(false);
    for (const b of [top, carbon]) {
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.x + b.width).toBeLessThanOrEqual(view.w);
      expect(b.y).toBeGreaterThanOrEqual(0);
      expect(b.y + b.height).toBeLessThanOrEqual(view.h);
    }
    expect(Math.round(carbon.x - (top.x + top.width)), 'gap').toBe(24);
    expect(Math.abs((top.x + carbon.x + carbon.width) / 2 - view.w / 2), 'centre offset').toBeLessThanOrEqual(2);
    await expect(page.locator('.top-sheet .sheet-label')).toHaveText('Top copy');
    await expect(page.locator('.carbon-sheet .sheet-label')).toHaveText('Carbon copy');
    const label = await page.locator('.top-sheet .sheet-label').boundingBox();
    expect(label !== null && label.y + label.height <= top.y, 'label above the sheet').toBe(true);
    await expect(page.locator('[data-control="swap-sheets"]')).toBeHidden();
  });
});