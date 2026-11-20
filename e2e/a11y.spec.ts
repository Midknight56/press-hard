import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import {
  editRecordValue,
  expectScreen,
  holdStamp,
  noShareSheet,
  removeSeal,
  tearOffTo,
  writeText,
} from './support.js';
import { walkScreens } from './screens.js';

/** The rule sets of the scan. No rule and no element is excluded. */
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'];

const SIZES = [
  { width: 390, height: 844, name: 'phone' },
  { width: 1280, height: 720, name: 'desktop' },
];

const OUT = 'test-results';

interface Found {
  id: string;
  impact: string;
  size: string;
  screen: string;
  nodes: number;
  first: string;
}

interface SizeResult {
  size: string;
  scanned: string[];
  found: Found[];
}

interface Row {
  rule: string;
  impact: string;
  count: number;
  screens: string[];
}

/** Every violation of every impact in the files written so far, one row for each rule and impact. */
function summarise(): { scanned: Record<string, number>; table: Row[] } {
  const scanned: Record<string, number> = {};
  const rows = new Map<string, Row>();
  const files = existsSync(OUT) ? readdirSync(OUT).filter((f) => /^a11y-\d+x\d+\.json$/.test(f)) : [];
  for (const file of files.sort()) {
    const result = JSON.parse(readFileSync(join(OUT, file), 'utf8')) as SizeResult;
    scanned[result.size] = result.scanned.length;
    for (const f of result.found) {
      const key = `${f.id}|${f.impact}`;
      const row = rows.get(key) ?? { rule: f.id, impact: f.impact, count: 0, screens: [] };
      row.count += f.nodes;
      const where = `${f.size}: ${f.screen}`;
      if (!row.screens.includes(where)) row.screens.push(where);
      rows.set(key, row);
    }
  }
  const table = [...rows.values()].sort((a, b) => a.rule.localeCompare(b.rule) || a.impact.localeCompare(b.impact));
  return { scanned, table };
}

function save(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8' });
}

/** Runs axe on the page as it is, and keeps what it found. */
async function scan(page: Page, size: string, screen: string, result: SizeResult, raw: unknown[]): Promise<void> {
  // The text is measured with the bundled fonts, not the fallback fonts of the first frames.
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  const axe = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  result.scanned.push(screen);
  raw.push({ size, screen, url: page.url(), violations: axe.violations });
  for (const v of axe.violations) {
    result.found.push({
      id: v.id,
      impact: v.impact ?? 'none',
      size,
      screen,
      nodes: v.nodes.length,
      first: v.nodes[0] === undefined ? '' : v.nodes[0].target.join(' '),
    });
  }
}

/** The verify page with the files the existing tests use: not a copy file, and a copy with no seal. */
async function scanVerifyStates(page: Page, testInfo: TestInfo, size: string, result: SizeResult, raw: unknown[]): Promise<void> {
  await page.goto('/app/');
  await expectScreen(page, 'pick');
  await page.click('[data-control="pick-prefilled"]');
  await expectScreen(page, 'fill');
  await holdStamp(page, 1300);
  await expectScreen(page, 'copy');
  const copy = await tearOffTo(page, testInfo, 'a11y-copy.html');
  const changed = writeText(testInfo.outputPath('a11y-changed.html'), editRecordValue(copy.text, 'worn', 'good'));
  const unsealed = writeText(testInfo.outputPath('a11y-unsealed.html'), removeSeal(copy.text));
  const notACopy = writeText(testInfo.outputPath('a11y-note.txt'), 'This is only a text file.\n');

  await page.goto('/verify/');
  await expectScreen(page, 'verify');
  await page.setInputFiles('[data-control="verify-file"]', changed);
  await expect(page.locator('[data-role="verdict"]')).toHaveText('Changed after sealing');
  await scan(page, size, 'verify, changed copy', result, raw);
  await page.setInputFiles('[data-control="verify-file"]', notACopy);
  await expect(page.locator('[data-role="error"]')).toHaveText('This file is not a copy file');
  await scan(page, size, 'verify, not a copy file', result, raw);
  await page.setInputFiles('[data-control="verify-file"]', unsealed);
  await expect(page.locator('[data-role="verdict"]')).toHaveText('This copy has no seal');
  await scan(page, size, 'verify, no seal', result, raw);
}

for (const viewport of SIZES) {
  const size = `${viewport.width}x${viewport.height}`;
  test.describe(size, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    test('axe finds no serious or critical violation on any screen', async ({ page }, testInfo) => {
      test.setTimeout(180_000);
      const result: SizeResult = { size, scanned: [], found: [] };
      const raw: unknown[] = [];
      await noShareSheet(page);
      await walkScreens(page, testInfo, (screen) => scan(page, size, screen, result, raw));
      await scanVerifyStates(page, testInfo, size, result, raw);

      // The table is written before the check, so a failing run still leaves it.
      save(join(OUT, `a11y-${size}.json`), result);
      save(join(OUT, 'a11y-summary.json'), summarise());
      const rawPath = process.env.A11Y_RAW;
      if (rawPath !== undefined && rawPath !== '') {
        const all = existsSync(rawPath) ? (JSON.parse(readFileSync(rawPath, 'utf8')) as Record<string, unknown>) : {};
        all[size] = raw;
        save(rawPath, all);
      }

      expect(result.scanned.length, 'screens scanned').toBeGreaterThanOrEqual(17);
      const serious = result.found.filter((f) => f.impact === 'serious' || f.impact === 'critical');
      expect(
        serious.map((f) => `${f.id} (${f.impact}) at ${f.size}, screen "${f.screen}", first selector ${f.first}`),
        'serious or critical violations',
      ).toEqual([]);
    });
  });
}
