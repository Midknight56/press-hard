import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { expectScreen, holdStamp, noShareSheet, tearOffTo } from './support.js';

/** Task 21: the carbon copy reveal as the owner's design draws it (1e at 1920x1080, 1f at 360x640). */

type Box = { x: number; y: number; width: number; height: number };

async function sealPrefilled(page: Page): Promise<void> {
  await noShareSheet(page);
  await page.goto('/app/');
  await expectScreen(page, 'pick');
  await page.click('[data-control="pick-prefilled"]');
  await expectScreen(page, 'fill');
  await holdStamp(page, 1300);
  await expectScreen(page, 'copy');
}

const settle = (page: Page) => page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished)).then(() => undefined));

const box = async (page: Page, selector: string): Promise<Box> => {
  const b = await page.locator(selector).first().boundingBox();
  if (b === null) throw new Error(`${selector} has no box`);
  return b;
};

const overlap = (a: Box, b: Box) => a.x < b.x + b.width - 0.5 && b.x < a.x + a.width - 0.5 && a.y < b.y + b.height - 0.5 && b.y < a.y + a.height - 0.5;

/** The width of the carbon sheet that the clipped top sheet does not cover, from its computed clip-path. */
const uncoveredShare = (page: Page) =>
  page.evaluate(() => {
    const top = document.querySelector('.top-sheet [data-box="sheet"]') as HTMLElement;
    const r = top.getBoundingClientRect();
    const clip = getComputedStyle(top).clipPath;
    const points = /^polygon\((.*)\)$/.exec(clip)?.[1]?.split(/,\s*/) ?? [];
    const xs = points.map((p) => {
      const x = p.trim().split(/\s+/)[0] as string;
      return x.endsWith('%') ? (parseFloat(x) / 100) * r.width : parseFloat(x);
    });
    if (xs.length === 0) return -1;
    return (r.width - Math.max(...xs)) / r.width;
  });

/**
 * The animation a screen element has, read from its computed style (the name, duration and easing of its animation) and
 * from the keyframes rule of that name. A running animation may be over before a test asks for it, a computed style stays.
 */
const animationOf = (page: Page, selector: string, name: string) =>
  page.evaluate(
    ([sel, anim]) => {
      const el = document.querySelector(sel as string) as Element;
      const style = getComputedStyle(el);
      const names = style.animationName.split(', ');
      const i = names.indexOf(anim as string);
      if (i < 0) return null;
      const seconds = (text: string | undefined) => (text === undefined ? null : parseFloat(text) * (text.endsWith('ms') ? 1 : 1000));
      const rules: string[] = [];
      for (const sheet of Array.from(document.styleSheets)) {
        for (const rule of Array.from(sheet.cssRules)) {
          const walk = (r: CSSRule) => {
            if (r instanceof CSSKeyframesRule && r.name === anim) rules.push(r.cssText);
            if ('cssRules' in r) for (const inner of Array.from((r as CSSGroupingRule).cssRules)) walk(inner);
          };
          walk(rule);
        }
      }
      return {
        duration: seconds(style.animationDuration.split(', ')[i]),
        easing: style.animationTimingFunction.split(/, (?![^(]*\))/)[i] ?? null,
        keyframes: rules.join(' '),
      };
    },
    [selector, name],
  );
for (const viewport of [
  { width: 360, height: 640 },
  { width: 1920, height: 1080 },
]) {
  test.describe(`the pad at rest, ${viewport.width}x${viewport.height}`, () => {
    test.use({ viewport });

    test('the top sheet is clipped over the carbon sheet, with the roll on the fold', async ({ page }) => {
      await sealPrefilled(page);
      await settle(page);
      const clip = await page.locator('.top-sheet [data-box="sheet"]').evaluate((el) => getComputedStyle(el).clipPath);
      expect(clip, 'a clip-path on the top sheet').toMatch(/^polygon\(/);
      const top = await box(page, '.top-sheet [data-box="sheet"]');
      const carbon = await box(page, '.carbon-sheet [data-box="sheet"]');
      for (const key of ['x', 'y', 'width', 'height'] as const) {
        expect(Math.abs(top[key] - carbon[key]), `carbon sheet ${key} against the top sheet`).toBeLessThanOrEqual(2);
      }
      await expect(page.locator('.roll')).toHaveCount(1);
      const roll = await box(page, '.roll');
      expect(roll.width, 'the roll is drawn').toBeGreaterThan(20);
      expect(await uncoveredShare(page), 'the share of the carbon sheet that is not covered').toBeGreaterThanOrEqual(0.4);
    });

    test('the clip is the one in the design, and the roll is the width and angle in the design', async ({ page }) => {
      await sealPrefilled(page);
      await settle(page);
      const wide = viewport.width >= 1900;
      const clip = await page.locator('.top-sheet [data-box="sheet"]').evaluate((el) => getComputedStyle(el).clipPath);
      const nums = [...clip.matchAll(/(-?[\d.]+)px/g)].map((m) => Number(m[1]));
      expect(nums, clip).toContain(wide ? 430 : 190);
      expect(nums, clip).toContain(wide ? 310 : 110);
      const roll = await page.locator('.roll').evaluate((el) => {
        const s = getComputedStyle(el);
        const m = new DOMMatrix(s.transform);
        return { width: parseFloat(s.width), angle: Math.round(Math.atan2(m.b, m.a) * 18000 / Math.PI) / 100 };
      });
      expect(roll.width).toBe(wide ? 64 : 46);
      expect(roll.angle).toBeCloseTo(wide ? 9.16 : 9.58, 1);
    });

    test('swap-sheets shows the whole carbon copy and its label changes, and a second press brings the clip back', async ({ page }) => {
      await sealPrefilled(page);
      await settle(page);
      const swap = page.locator('[data-control="swap-sheets"]');
      await expect(swap).toBeVisible();
      await expect(swap).toHaveValue('Show carbon copy');
      // Which sheet shows at points over the carbon sheet's width, in the part that is in view.
      const hits = () =>
        page.evaluate(() => {
          const sheet = document.querySelector('.carbon-sheet [data-box="sheet"]') as HTMLElement;
          sheet.scrollIntoView({ block: 'center' });
          const r = sheet.getBoundingClientRect();
          const y = Math.min(Math.max(r.top + 60, 100), window.innerHeight - 120);
          const out: string[] = [];
          for (const f of [0.1, 0.3, 0.5, 0.7, 0.9]) {
            const hit = document.elementFromPoint(r.left + r.width * f, y);
            out.push(hit?.closest('.top-sheet') ? 'top' : hit?.closest('.carbon-sheet') ? 'carbon' : 'other');
          }
          return out;
        });
      const before = await hits();
      expect(before[0], 'the left of the pad shows the top copy').toBe('top');
      expect(before[4], 'the right of the pad shows the carbon copy').toBe('carbon');
      await swap.click();
      await expect(swap).toHaveValue('Show top copy');
      expect(await hits(), 'the whole carbon copy in view').toEqual(['carbon', 'carbon', 'carbon', 'carbon', 'carbon']);
      expect(await page.evaluate(() => document.getAnimations().filter((a) => a.playState === 'running').length)).toBe(0);
      await swap.click();
      await expect(swap).toHaveValue('Show carbon copy');
      expect((await hits())[0], 'the clip is back').toBe('top');
      expect(await page.locator('.top-sheet [data-box="sheet"]').evaluate((el) => getComputedStyle(el).clipPath)).toMatch(/^polygon\(/);
    });

    test('every signature path on the carbon sheet is carbon ink #23399B', async ({ page }) => {
      await sealPrefilled(page);
      await settle(page);
      const strokes = await page.locator('.carbon-sheet svg.signature polyline').evaluateAll((all) => all.map((p) => getComputedStyle(p).stroke));
      expect(strokes.length, 'signature paths on the carbon sheet').toBeGreaterThanOrEqual(2);
      for (const stroke of strokes) expect(stroke).toBe('rgb(35, 57, 155)');
    });

    test('the peel goes from the right edge to the rest in 700 ms and the carbon ink fades up in 300 ms', async ({ page }) => {
      await sealPrefilled(page);
      const peel = await animationOf(page, '.top-sheet', 'peel');
      const ink = await animationOf(page, '.carbon-sheet .form > .line', 'ink-up');
      expect(peel?.duration, 'a peel animation').toBe(700);
      expect(peel?.easing).toBe('cubic-bezier(0.2, 0.8, 0.2, 1)');
      expect(peel?.keyframes, 'the fold starts at the right edge').toContain('100%');
      expect(ink?.duration, 'an ink fade animation').toBe(300);
    });  });
}

test.describe('the pad, 1920x1080, the three columns', () => {
  test.use({ viewport: { width: 1920, height: 1080 } });

  test('the rail, the pad and the tray do not overlap, are whole in the page, and the tray holds the controls', async ({ page }) => {
    await sealPrefilled(page);
    await settle(page);
    const rail = await box(page, 'header.bar');
    const pad = await box(page, '.sheets');
    const view = await page.evaluate(() => ({ w: document.documentElement.clientWidth, h: document.documentElement.scrollHeight }));
    const trayControls = ['tear-off', 'print', 'tamper', 'library', 'new-form'];
    const tray: Box[] = [];
    for (const control of trayControls) tray.push(await box(page, `main [data-control="${control}"]`));
    const swapBox = await box(page, '[data-control="swap-sheets"]');
    const info = await box(page, '[data-role="stored-verdict"]');
    const left = Math.min(...[...tray, swapBox, info].map((b) => b.x));
    const right = Math.max(...[...tray, swapBox, info].map((b) => b.x + b.width));
    const trayBox: Box = {
      x: left,
      y: Math.min(...[...tray, swapBox].map((b) => b.y)),
      width: right - left,
      height: Math.max(...[...tray, info].map((b) => b.y + b.height)) - Math.min(...[...tray, swapBox].map((b) => b.y)),
    };
    expect(overlap(rail, pad), 'rail over the pad').toBe(false);
    expect(overlap(pad, trayBox), 'the pad over the tray').toBe(false);
    expect(overlap(rail, trayBox), 'the rail over the tray').toBe(false);
    for (const [name, b] of [['rail', rail], ['pad', pad], ['tray', trayBox]] as const) {
      expect(b.x, `${name} left`).toBeGreaterThanOrEqual(0);
      expect(b.x + b.width, `${name} right`).toBeLessThanOrEqual(view.w);
      expect(b.y, `${name} top`).toBeGreaterThanOrEqual(0);
      expect(b.y + b.height, `${name} bottom`).toBeLessThanOrEqual(view.h);
    }
    // The rail is the left column and the tray the right one.
    expect(rail.x + rail.width).toBeLessThanOrEqual(pad.x);
    expect(trayBox.x).toBeGreaterThanOrEqual(pad.x + pad.width);
    for (const [i, control] of trayControls.entries()) {
      const b = tray[i] as Box;
      expect(b.x, `${control} in the right tray`).toBeGreaterThanOrEqual(pad.x + pad.width);
    }
    // The rail holds the wordmark, the tagline, the nav and the four steps, step 4 current.
    await expect(page.locator('.brand')).toBeVisible();
    await expect(page.locator('.tagline')).toBeVisible();
    const steps = await page.locator('.steps li').evaluateAll((all) => all.map((li) => ({ n: li.getAttribute('data-n'), weight: getComputedStyle(li).fontWeight })));
    expect(steps.map((s) => s.n)).toEqual(['1', '2', '3', '4']);
    expect(Number(steps[3]?.weight)).toBeGreaterThan(Number(steps[0]?.weight));
    // The tear off pad is the big ink pad button, 480 by 100.
    const tear = tray[0] as Box;
    expect(Math.round(tear.width)).toBe(480);
    expect(Math.round(tear.height)).toBe(100);
  });

  test('after Tear off the copy the two sheets are side by side, whole, and do not overlap', async ({ page }, testInfo) => {
    await sealPrefilled(page);
    await settle(page);
    const copy = await tearOffTo(page, testInfo, 'reveal-copy.html');
    expect(copy.text.length).toBeGreaterThan(1000);
    await settle(page);
    const top = await box(page, '.top-sheet [data-box="sheet"]');
    const carbon = await box(page, '.carbon-sheet [data-box="sheet"]');
    const view = await page.evaluate(() => ({ w: document.documentElement.clientWidth, h: document.documentElement.scrollHeight }));
    expect(overlap(top, carbon), 'the sheets overlap').toBe(false);
    expect(carbon.x, 'the carbon sheet is right of the top sheet').toBeGreaterThanOrEqual(top.x + top.width);
    expect(Math.abs(carbon.y - top.y)).toBeLessThanOrEqual(2);
    for (const b of [top, carbon]) {
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.x + b.width).toBeLessThanOrEqual(view.w);
      expect(b.y + b.height).toBeLessThanOrEqual(view.h);
    }
    // Both whole: nothing clips either one.
    for (const which of ['top', 'carbon']) {
      expect(await page.locator(`.${which}-sheet [data-box="sheet"]`).evaluate((el) => getComputedStyle(el).clipPath), `${which} sheet clip`).toBe('none');
    }
    const hit = await page.evaluate(() => {
      const sheet = document.querySelector('.top-sheet [data-box="sheet"]') as HTMLElement;
      sheet.scrollIntoView({ block: 'start' });
      const r = sheet.getBoundingClientRect();
      const hit = document.elementFromPoint(r.left + r.width * 0.9, Math.min(r.top + 200, window.innerHeight - 40));
      return Boolean(hit?.closest('.top-sheet'));
    });
    expect(hit, 'the right side of the top sheet is shown').toBe(true);
  });
});

test.describe('the pad, 360x640, the two bars', () => {
  test.use({ viewport: { width: 360, height: 640 } });

  const fixedAncestor = (page: Page, selector: string) =>
    page.evaluate((sel) => {
      for (let el = document.querySelector(sel); el !== null; el = el.parentElement) {
        const s = getComputedStyle(el);
        if (s.position === 'fixed') {
          const r = el.getBoundingClientRect();
          return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width };
        }
      }
      return null;
    }, selector);

  test('Tear off the copy and Print are in a bar fixed to the bottom, the seal words in a bar fixed to the top', async ({ page }) => {
    await sealPrefilled(page);
    await settle(page);
    for (const at of [0, 400]) {
      await page.evaluate((y) => window.scrollTo(0, y), at);
      const topBar = await fixedAncestor(page, '[data-role="seal-words"]');
      expect(topBar, 'the seal words are in a fixed bar').not.toBeNull();
      expect(topBar?.top).toBe(0);
      expect(topBar?.width).toBe(360);
      for (const control of ['tear-off', 'print']) {
        const bar = await fixedAncestor(page, `[data-control="${control}"]`);
        expect(bar, `${control} is in a fixed bar`).not.toBeNull();
        expect(bar?.bottom).toBe(640);
        expect(bar?.width).toBe(360);
      }
      const swapBar = await fixedAncestor(page, '[data-control="swap-sheets"]');
      expect(swapBar?.top, 'Show carbon copy sits in the top bar').toBe(0);
    }
    await expect(page.locator('[data-control="tear-off"]')).toBeVisible();
    await expect(page.locator('[data-control="print"]')).toBeVisible();
  });

  test('the bars do not cover the last row of controls when scrolled to the end', async ({ page }) => {
    await sealPrefilled(page);
    await settle(page);
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const result = await page.evaluate(() => {
      const bars = ['[data-role="seal-words"]', '[data-control="tear-off"]'].map((sel) => {
        for (let el = document.querySelector(sel); el !== null; el = el.parentElement) {
          if (getComputedStyle(el).position === 'fixed') return el.getBoundingClientRect();
        }
        return null;
      });
      const last = ['tamper', 'library', 'new-form'].map((c) => (document.querySelector(`main [data-control="${c}"]`) as HTMLElement).getBoundingClientRect());
      const lines = ['size', 'stored-verdict'].map((r) => (document.querySelector(`[data-role="${r}"]`) as HTMLElement).getBoundingClientRect());
      const hit = (a: DOMRect, b: DOMRect) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
      return {
        bars: bars.map((b) => b !== null),
        covered: [...last, ...lines].map((r) => bars.some((b) => b !== null && hit(b, r))),
        inView: [...last, ...lines].map((r) => r.top >= 0 && r.bottom <= window.innerHeight),
      };
    });
    expect(result.bars, 'both bars found').toEqual([true, true]);
    expect(result.covered, 'a bar covers a control or a line').toEqual([false, false, false, false, false]);
    expect(result.inView).toEqual([true, true, true, true, true]);
  });
});

test.describe('motion that task 20 left out', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('a typed character inks in over 60 ms and the line does not move', async ({ page }) => {
    await page.goto('/app/');
    await expectScreen(page, 'pick');
    await page.click('[data-control="pick-rental-return"]');
    await expectScreen(page, 'fill');
    const field = page.locator('[data-control="party-giver"]');
    await field.scrollIntoViewIfNeeded();
    const before = await field.boundingBox();
    const lineBefore = await page.locator('[data-field="giver"]').boundingBox();
    await field.focus();
    await page.keyboard.type('M');
    const durations = await field.evaluate((el) => el.getAnimations().map((a) => a.effect?.getComputedTiming().duration));
    expect(durations, 'an animation on the field').toContain(60);
    const after = await field.boundingBox();
    const lineAfter = await page.locator('[data-field="giver"]').boundingBox();
    expect(after).toEqual(before);
    expect(lineAfter).toEqual(lineBefore);
  });

  test('the stamp lifts in 180 ms with a 4 px overshoot after a full hold', async ({ page }) => {
    await sealPrefilled(page);
    const lift = await animationOf(page, '.seal-stamp', 'stamp-lift');
    expect(lift, 'a stamp-lift animation').not.toBeNull();
    expect(lift?.duration).toBe(180);
    expect(lift?.keyframes).toContain('translateY(-4px)');
  });});

test.describe('the built dist and the font licences', () => {
  test('holds the four OFL texts beside the font files', () => {
    const assets = join(import.meta.dirname, '..', 'dist', 'assets');
    expect(existsSync(assets), 'dist/assets exists, run npm run build').toBe(true);
    const names = readdirSync(assets);
    for (const licence of ['OFL-saira.txt', 'OFL-sairacondensed.txt', 'OFL-gochihand.txt', 'OFL-rubikmonoone.txt']) {
      expect(names, licence).toContain(licence);
    }
    expect(names.filter((n) => n.endsWith('.woff2')).length, 'font files in the same folder').toBeGreaterThanOrEqual(6);
  });
});
