// What three first-time testers found on 2026-11-20, checked in a headless browser with sound muted.
// The list with the tester of each row is docs/acceptance/blind-test-fixes-2026-11-20.md.
import { expect, test, type Page } from '@playwright/test';
import { expectScreen, holdStamp, noShareSheet, sign, tearOffTo, watch, writeText } from './support.js';

type Rect = { left: number; top: number; right: number; bottom: number };

/** Waits for the copy step of the landing loop and for the copy to stop moving. */
async function copyAtRest(page: Page): Promise<void> {
  await expect(page.locator('#loop [data-screen="copy"]')).toBeVisible({ timeout: 8000 });
  await page.waitForTimeout(1800);
  await expect(page.locator('#loop [data-screen="copy"]')).toBeVisible();
}

/** The roll of the copy in the loop, when it is drawn, and the sheets it could cover. */
const rollAndSheets = (page: Page) =>
  page.evaluate(() => {
    const box = (el: Element): Rect => {
      const r = el.getBoundingClientRect();
      return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
    };
    const roll = document.querySelector('#loop .roll');
    const style = roll === null ? null : getComputedStyle(roll);
    const drawn = roll !== null && style !== null && style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) > 0;
    return {
      roll: drawn && roll !== null ? box(roll) : null,
      sheets: [...document.querySelectorAll('#loop [data-box="sheet"]')].map(box),
    };
  });

const overlaps = (a: Rect, b: Rect) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

for (const viewport of [
  { width: 360, height: 640 },
  { width: 1920, height: 1080 },
]) {
  test.describe(`landing page, ${viewport.width}x${viewport.height}`, () => {
    test.use({ viewport });

    test('the carbon copy demo comes to rest with the roller off the form', async ({ page, context }) => {
      const watcher = watch(context);
      await page.goto('/');
      await copyAtRest(page);
      const { roll, sheets } = await rollAndSheets(page);
      expect(sheets.length, 'the copy shows its sheets').toBeGreaterThan(0);
      if (roll !== null) {
        for (const sheet of sheets) expect(overlaps(roll, sheet), `roller ${JSON.stringify(roll)} over sheet ${JSON.stringify(sheet)}`).toBe(false);
      }
      watcher.assertClean();
    });

    test('the bars of the copy in the loop stay inside the loop and cover no link', async ({ page, context }) => {
      const watcher = watch(context);
      await page.goto('/');
      await copyAtRest(page);
      const outside = await page.evaluate(() => {
        const loop = (document.getElementById('loop') as HTMLElement).getBoundingClientRect();
        return [...document.querySelectorAll('#loop *')]
          .filter((el) => {
            const r = el.getBoundingClientRect();
            if (r.width === 0 || r.height === 0) return false;
            const style = getComputedStyle(el);
            if (style.visibility === 'hidden') return false;
            const position = style.position;
            return position === 'fixed' || r.top < loop.top - 1 || r.bottom > loop.bottom + 1;
          })
          .map((el) => `${el.tagName.toLowerCase()}.${el.className}`);
      });
      expect(outside, 'parts of the loop drawn outside the loop box').toEqual([]);
      watcher.assertClean();
    });

    test('the demo copy shows no button that does nothing', async ({ page }) => {
      await page.goto('/');
      await copyAtRest(page);
      // Read once: a retrying check would pass when the loop moves on to the next step.
      expect(await page.locator('#loop [data-control="swap-sheets"]').isVisible(), 'Show carbon copy in the demo').toBe(false);
    });
  });
}

test.describe('landing page, reduced motion', () => {
  test.use({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });

  test('the still copy shows no roller over the form', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#loop [data-screen="copy"]')).toBeVisible();
    const { roll, sheets } = await rollAndSheets(page);
    if (roll !== null) for (const sheet of sheets) expect(overlaps(roll, sheet)).toBe(false);
  });
});

test.describe('landing page words', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('the page says what the seal words are for', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('main > p.lead')).toContainText([
      'Two people fill one form on one phone.',
      'The four seal words name the copy. Anyone can check a copy with them.',
    ]);
  });
});

test.describe('app at 390x844', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('the Check page marks the changed line of one torn off copy', async ({ page, context }, testInfo) => {
    const watcher = watch(context);
    await noShareSheet(page);
    await page.goto('/app/');
    await page.click('[data-control="pick-prefilled"]');
    await holdStamp(page, 1300);
    await expectScreen(page, 'copy');
    const copy = await tearOffTo(page, testInfo, 'copy.html');
    // The testers changed the name everywhere in the file, as a find and replace does.
    const changed = writeText(testInfo.outputPath('changed.html'), copy.text.split('Tobin Larch').join('Tobin Larsh'));
    await page.goto('/verify/');
    await page.setInputFiles('[data-control="verify-file"]', changed);
    await expect(page.locator('[data-role="verdict"]')).toHaveText('Changed after sealing');
    await expect(page.locator('[data-field="receiver"]')).toHaveClass(/changed/);
    await expect(page.locator('[data-field="receiver"] [data-role="diff"]')).toHaveText('This line was changed after sealing');
    await expect(page.locator('.line.changed')).toHaveCount(1);
    watcher.assertClean();
  });

  test('the stamp bar names the line and says when a number is needed', async ({ page }) => {
    await page.goto('/app/');
    await page.click('[data-control="pick-rental-return"]');
    await expectScreen(page, 'fill');
    const say = page.locator('[data-role="instruction"]');
    await expect(say).toHaveText('Fill in Giver name');
    await page.fill('[data-control="party-giver"]', 'Ada Test');
    await page.fill('[data-control="party-receiver"]', 'Bo Odd');
    await page.fill('[data-control="field-item"]', 'Bike');
    await page.selectOption('[data-control="field-condition"]', 'worn');
    await page.fill('[data-control="field-mileage"]', '-5 abc');
    await expect(say).toHaveText('Write a number in Mileage');
    // The odd mileage keeps the stamp locked: it is never sealed as a mileage.
    await expect(page.locator('[data-control="stamp"]')).toHaveAttribute('data-locked', 'true');
    // A line that may stay empty says so after its label; a line that must be filled does not.
    const after = (id: string) => page.locator(`[data-field="${id}"] > .label`).evaluate((el) => getComputedStyle(el, '::after').content);
    expect(await after('fuel')).toBe('" optional"');
    expect(await after('item')).toBe('none');
  });

  test('scrolled to the end, the stamp bar covers no part of the form', async ({ page }) => {
    await page.goto('/app/');
    await page.click('[data-control="pick-prefilled"]');
    await expectScreen(page, 'fill');
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const gap = await page.evaluate(() => {
      const bar = (document.querySelector('.stamp-area') as HTMLElement).getBoundingClientRect();
      const sheet = (document.querySelector('.fill [data-box="sheet"]') as HTMLElement).getBoundingClientRect();
      return bar.top - sheet.bottom;
    });
    expect(gap, 'space between the foot of the form and the stamp bar').toBeGreaterThanOrEqual(0);
  });

  test('scrolled to the end, the copy bar covers no part of the copy', async ({ page }) => {
    await noShareSheet(page);
    await page.goto('/app/');
    await page.click('[data-control="pick-prefilled"]');
    await holdStamp(page, 1300);
    await expectScreen(page, 'copy');
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const covered = await page.evaluate(() => {
      const bar = (document.querySelector('.copy-bar') as HTMLElement).getBoundingClientRect();
      return [...document.querySelectorAll('.copy .sheets, .copy-actions > button')]
        .filter((el) => el.getBoundingClientRect().bottom > bar.top + 1)
        .map((el) => el.getAttribute('data-control') ?? el.className);
    });
    expect(covered).toEqual([]);
  });

  test('a blank form shows two signature boxes with their captions, and both can be signed', async ({ page }) => {
    await page.goto('/app/');
    await page.click('[data-control="pick-blank"]');
    await page.fill('[data-control="party-giver"]', 'Mara Oduya');
    await page.fill('[data-control="party-receiver"]', 'Tobin Larch');
    for (const party of ['giver', 'receiver'] as const) {
      const box = page.locator(`[data-control="signature-${party}"]`);
      await expect(box).toBeVisible();
      const caption = await box.evaluate((el) => ({ drawn: getComputedStyle(el, '::before').content, text: el.getAttribute('data-caption') }));
      expect(caption.drawn, 'the caption is drawn').not.toBe('none');
      expect(caption.text).toBe(party === 'giver' ? 'Giver signs here' : 'Receiver signs here');
      await sign(page, `signature-${party}`);
    }
    await expect(page.locator('[data-control="stamp"]')).toHaveAttribute('data-locked', 'false');
  });

  test('a long name with no spaces stays inside the sealed copy', async ({ page }) => {
    await noShareSheet(page);
    await page.goto('/app/');
    await page.click('[data-control="pick-prefilled"]');
    await page.fill('[data-control="party-giver"]', `<b>Zed</b> ${'X'.repeat(120)}`);
    await holdStamp(page, 1300);
    await expectScreen(page, 'copy');
    await page.click('[data-control="swap-sheets"]');
    const fits = await page.evaluate(() => {
      const value = document.querySelector('.carbon-sheet [data-field="giver"] .value') as HTMLElement;
      const sheet = (document.querySelector('.carbon-sheet [data-box="sheet"]') as HTMLElement).getBoundingClientRect();
      const r = value.getBoundingClientRect();
      return { text: value.textContent, inside: r.right <= sheet.right + 1, scrolls: value.scrollWidth > value.clientWidth + 1 };
    });
    expect(fits.text).toContain('XXXXXXXX');
    expect(fits.inside && !fits.scrolls, JSON.stringify(fits)).toBe(true);
  });
});
