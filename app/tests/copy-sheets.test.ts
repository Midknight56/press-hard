import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { sealRecord, type HandoverRecord } from 'core';
import { describe, expect, it } from 'vitest';
import { createCopyScreen } from '../src/screens/copy.js';
import { sampleRecord } from '../src/templates/sample.js';

const sealed = (() => {
  const r = sealRecord(sampleRecord, '2026-11-16T09:30:00Z');
  if (!r.ok) throw new Error('sample did not seal');
  return r.record as HandoverRecord;
})();

const build = (reducedMotion: boolean) => createCopyScreen({ record: sealed, reducedMotion }).element;
const swap = (el: HTMLElement) => el.querySelector('[data-control="swap-sheets"]') as HTMLInputElement;
const css = (file: string) => readFileSync(join(import.meta.dirname, '..', 'src', file), 'utf8');

describe('copy screen, the swap control', () => {
  it('is one control named swap-sheets that starts as Show carbon copy', () => {
    const el = build(false);
    expect(el.querySelectorAll('[data-control="swap-sheets"]')).toHaveLength(1);
    expect(swap(el).value).toBe('Show carbon copy');
  });

  it('brings the other sheet to the front on each press, with no motion', () => {
    const el = build(false);
    const sheets = el.querySelector('.sheets') as HTMLElement;
    expect(sheets.getAttribute('data-front')).toBe('top');
    swap(el).click();
    expect(sheets.getAttribute('data-front')).toBe('carbon');
    expect(swap(el).value).toBe('Show top copy');
    swap(el).click();
    expect(sheets.getAttribute('data-front')).toBe('top');
    expect(swap(el).value).toBe('Show carbon copy');
    // No animation class is added by a press.
    expect(el.querySelector('.carbon-sheet')?.classList.contains('peel')).toBe(false);
  });

  it('is the same with reduced motion', () => {
    const el = build(true);
    swap(el).click();
    expect(el.querySelector('.sheets')?.getAttribute('data-front')).toBe('carbon');
    expect(swap(el).value).toBe('Show top copy');
  });

  it('is in the tab order with no tabindex trick', () => {
    expect(swap(build(false)).hasAttribute('tabindex')).toBe(false);
  });
});

describe('copy screen, the labels', () => {
  it('labels each sheet Top copy and Carbon copy, above the form', () => {
    const el = build(false);
    const top = el.querySelector('.top-sheet') as HTMLElement;
    const carbon = el.querySelector('.carbon-sheet') as HTMLElement;
    expect(top.querySelector('.sheet-label')?.textContent).toBe('Top copy');
    expect(carbon.querySelector('.sheet-label')?.textContent).toBe('Carbon copy');
    expect(top.firstElementChild?.classList.contains('sheet-label')).toBe(true);
    expect(carbon.firstElementChild?.classList.contains('sheet-label')).toBe(true);
  });

  it('keeps one form in each sheet, so the seal words are not doubled', () => {
    const el = build(false);
    expect(el.querySelectorAll('.top-sheet .form')).toHaveLength(1);
    expect(el.querySelectorAll('.carbon-sheet .form')).toHaveLength(1);
  });
});

describe('copy screen, the classes for peel and rest', () => {
  it('gives the top sheet peel and rest with full motion', () => {
    const el = build(false);
    const top = el.querySelector('.top-sheet') as HTMLElement;
    expect(top.classList.contains('peel')).toBe(true);
    expect(top.classList.contains('rest')).toBe(true);
    expect(el.querySelector('.carbon-sheet')?.classList.contains('rest')).toBe(true);
    expect(el.querySelector('.carbon-sheet')?.classList.contains('fade')).toBe(false);
  });

  it('gives no peel and a fade with reduced motion', () => {
    const el = build(true);
    expect(el.querySelector('.peel')).toBeNull();
    expect(el.querySelector('.top-sheet')?.classList.contains('rest')).toBe(true);
    expect(el.querySelector('.carbon-sheet')?.classList.contains('fade')).toBe(true);
    expect(el.getAttribute('data-motion')).toBe('reduced');
  });
});

describe('copy screen, the style sheets', () => {
  const theme = css('form/theme.css');
  const app = css('app.css');

  it('peels from the right edge to the rest in 700 ms with cubic-bezier(.2, .8, .2, 1), and the carbon ink fades up in 300 ms', () => {
    expect(theme).toMatch(/\.top-sheet\.peel\s*\{[^}]*animation:\s*peel 700ms cubic-bezier\(0?\.2, 0?\.8, 0?\.2, 1\)/);
    expect(theme).toMatch(/\.carbon-sheet\.ink\s+\.form\s*>\s*\*\s*\{[^}]*animation:\s*ink-up 300ms/);
    const frames = /@keyframes peel\s*\{([\s\S]*?)\n\}/.exec(theme);
    expect(frames, 'a peel keyframes rule').not.toBeNull();
    expect(frames?.[1] ?? '').toContain('--fold-t');
  });

  it('does not run the peel with reduced motion', () => {
    expect(theme).toMatch(/prefers-reduced-motion: reduce\)\s*\{[^}]*\.top-sheet\.peel\s*\{\s*animation: none/);
  });

  it('lays the carbon sheet under the top sheet at the same place, in one grid cell', () => {
    expect(theme).toMatch(/\.top-sheet,\s*\.carbon-sheet\s*\{[^}]*grid-area:\s*1\s*\/\s*1/);
    expect(theme).not.toMatch(/\.carbon-sheet\s*\{[^}]*top: 24px;[^}]*left: 24px/);
  });

  it('clips the top sheet with the polygons of the design: 190 px and 110 px on a phone, 430 px and 310 px at 1900 px', () => {
    expect(theme).toMatch(/--fold-t:\s*190px;[^}]*--fold-b:\s*110px/);
    expect(theme).toMatch(/min-width: 1900px\)\s*\{[\s\S]*--fold-t:\s*430px;[^}]*--fold-b:\s*310px/);
    expect(theme).toMatch(/clip-path:\s*polygon\(0 0, var\(--fold-t\) 0, var\(--fold-b\) 100%, 0 100%\)/);
  });

  it('draws the roll 46 px wide at 9.58 degrees, and 64 px wide at 9.16 degrees from 900 px', () => {
    expect(theme).toMatch(/\.roll\s*\{[^}]*width:\s*46px[^}]*rotate\(9\.58deg\)/);
    expect(theme).toMatch(/min-width: 900px\)\s*\{[\s\S]*\.roll\s*\{[^}]*width:\s*64px[^}]*rotate\(9\.16deg\)/);
  });
  it('shows the swap control on narrow screens only', () => {
    expect(app).toMatch(/\.sheet-switch\s*\{[^}]*display: flex/);
    expect(app).toMatch(/@media screen and \(min-width: 900px\)\s*\{[\s\S]*\.sheet-switch\s*\{\s*display: none/);
  });

  it('leaves print alone: no sheet label, no swap control, no carbon sheet in print', () => {
    expect(theme).toMatch(/@media print\s*\{[^}]*\.sheet-label[^}]*display: none/);
    expect(theme).toMatch(/@media print\s*\{[^}]*\.sheet-switch[^}]*display: none/);
  });
});
