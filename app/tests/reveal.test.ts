import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sealRecord, type HandoverRecord } from 'core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FONT_LICENCES, checkFontLicences } from '../scripts/check-dist.js';
import { renderForm } from '../src/form/index.js';
import { createCopyScreen } from '../src/screens/copy.js';
import { sampleRecord } from '../src/templates/sample.js';

const sealed = (() => {
  const r = sealRecord(sampleRecord, '2026-11-16T09:30:00Z');
  if (!r.ok) throw new Error('sample did not seal');
  return r.record as HandoverRecord;
})();

const src = (file: string) => readFileSync(join(import.meta.dirname, '..', 'src', file), 'utf8');
const build = (reducedMotion: boolean, extra: Partial<Parameters<typeof createCopyScreen>[0]> = {}) =>
  createCopyScreen({ record: sealed, reducedMotion, ...extra }).element;

describe('copy screen, the pad of the reveal', () => {
  it('has a roll over the fold, hidden from readers and with no text', () => {
    const el = build(false);
    const rolls = el.querySelectorAll('.roll');
    expect(rolls).toHaveLength(1);
    const roll = rolls[0] as HTMLElement;
    expect(roll.getAttribute('aria-hidden')).toBe('true');
    expect(roll.textContent).toBe('');
    expect(roll.closest('.top-sheet')).not.toBeNull();
  });

  it('keeps the two sheets as the only children of the pad, carbon first', () => {
    const sheets = [...build(false).querySelectorAll('.sheets > *')].map((s) => s.className.split(' ')[0]);
    expect(sheets).toEqual(['carbon-sheet', 'top-sheet']);
  });

  it('puts the seal strip and the swap control in a pinned top bar, and Tear off the copy and Print in a bottom bar', () => {
    const el = build(false, { onTearOff: () => undefined, onPrint: () => undefined, onTamper: () => undefined, onLibrary: () => undefined, onNew: () => undefined });
    const topBar = el.querySelector('.seal-bar') as HTMLElement;
    expect(topBar.hasAttribute('data-sticky')).toBe(true);
    expect(topBar.querySelector('[data-role="seal-words"]')).not.toBeNull();
    expect(topBar.querySelector('[data-control="swap-sheets"]')).not.toBeNull();
    const bottomBar = el.querySelector('.copy-bar') as HTMLElement;
    expect(bottomBar.hasAttribute('data-sticky')).toBe(true);
    expect([...bottomBar.querySelectorAll('button')].map((b) => b.getAttribute('data-control'))).toEqual(['tear-off', 'print']);
    const all = [...el.querySelectorAll('button')].map((b) => b.getAttribute('data-control'));
    expect(all).toEqual(['tear-off', 'print', 'tamper', 'library', 'new-form']);
  });

  it('marks the screen torn after Tear off the copy on a wide screen only, and still calls the tear off once', () => {
    const calls = vi.fn<() => void>();
    const wide = vi.spyOn(window, 'matchMedia').mockImplementation(((q: string) => ({ matches: q.includes('min-width: 900px') })) as never);
    const el = build(false, { onTearOff: calls });
    (el.querySelector('[data-control="tear-off"]') as HTMLElement).click();
    expect(calls).toHaveBeenCalledTimes(1);
    expect(el.classList.contains('torn')).toBe(true);
    wide.mockImplementation((() => ({ matches: false })) as never);
    const narrow = build(false, { onTearOff: calls });
    (narrow.querySelector('[data-control="tear-off"]') as HTMLElement).click();
    expect(calls).toHaveBeenCalledTimes(2);
    expect(narrow.classList.contains('torn')).toBe(false);
    wide.mockRestore();
  });

  it('gives the carbon sheet the ink fade with full motion and the plain fade with reduced motion', () => {
    expect(build(false).querySelector('.carbon-sheet')?.classList.contains('ink')).toBe(true);
    expect(build(true).querySelector('.carbon-sheet')?.classList.contains('ink')).toBe(false);
  });

  it('puts the stamp mark of the banner in the strip from 900 px wide, with no text, and none on a phone', () => {
    const media = vi.spyOn(window, 'matchMedia').mockImplementation(((q: string) => ({ matches: q.includes('min-width: 900px') })) as never);
    const mark = build(false).querySelector('.seal-stamp') as HTMLElement;
    expect(mark.getAttribute('aria-hidden')).toBe('true');
    expect(mark.querySelector('.impression')).not.toBeNull();
    expect(mark.textContent).toBe('');
    media.mockImplementation((() => ({ matches: false })) as never);
    expect(build(false).querySelector('.seal-stamp .impression')).toBeNull();
    media.mockRestore();
  });});

describe('the carbon ink', () => {
  const look = src('look.css');

  it('draws the signatures of the carbon sheet in the carbon ink, with a rule as strong as the one for the top sheet', () => {
    expect(look).toMatch(/\.form\.ink-carbon \.signatures > svg\.signature\s*\{[^}]*color:\s*var\(--ph-carbon-ink\)/);
    expect(look).toMatch(/\.form\.ink-carbon \.signature-slot > svg\.signature\s*\{[^}]*color:\s*var\(--ph-carbon-ink\)/);
  });

  it('has the carbon ink #23399B', () => {
    expect(look).toMatch(/--ph-carbon-ink:\s*#23399b/);
  });
});

describe('the motion that task 20 left out', () => {
  const look = src('look.css');

  it('lifts the stamp in 180 ms with an overshoot of 4 px, and cross fades it with reduced motion', () => {
    expect(look).toMatch(/\.seal-stamp\s*\{[^}]*animation:\s*stamp-lift 180ms/);
    const frames = /@keyframes stamp-lift\s*\{([\s\S]*?)\n\}/.exec(look);
    expect(frames?.[1]).toContain('translateY(-4px)');
    expect(look).toMatch(/prefers-reduced-motion: reduce\)[\s\S]*\.seal-stamp[\s\S]*crossfade 150ms/);
  });

  it('inks in a typed character over 60 ms, as an animation of a text shadow, so that nothing moves and the colour stays', () => {
    const form = src('form/index.ts');
    expect(form).toMatch(/INK_IN_MS\s*=\s*60/);
    expect(form).toMatch(/\.animate\(\s*\[\s*\{\s*textShadow:/);
    expect(form).not.toMatch(/\.animate\([^)]*(width|height|margin|padding|transform)/);
  });

  it('runs the ink in for each typed character of a text line', () => {
    const calls: unknown[][] = [];
    const root = renderForm(sampleRecord, { mode: 'edit' });
    const input = root.querySelector('[data-control="party-giver"]') as HTMLInputElement;
    input.animate = ((...args: unknown[]) => {
      calls.push(args);
      return {} as Animation;
    }) as never;
    input.value = 'Mara O';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.value = 'Mara Od';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    expect(calls).toHaveLength(2);
    expect((calls[0]?.[1] as { duration: number }).duration).toBe(60);
  });
});

describe('the font licences in the built folder', () => {
  const made: string[] = [];
  afterEach(() => {
    for (const dir of made.splice(0)) rmSync(dir, { recursive: true, force: true });
  });
  const dist = (files: string[]): string => {
    const dir = mkdtempSync(join(tmpdir(), 'dist-fonts-'));
    made.push(dir);
    mkdirSync(join(dir, 'assets'), { recursive: true });
    for (const f of files) writeFileSync(join(dir, 'assets', f), 'x');
    return dir;
  };

  it('are the four OFL texts', () => {
    expect([...FONT_LICENCES]).toEqual(['OFL-saira.txt', 'OFL-sairacondensed.txt', 'OFL-gochihand.txt', 'OFL-rubikmonoone.txt']);
  });

  it('pass when the four texts are in assets/ beside a font file', () => {
    expect(checkFontLicences(dist([...FONT_LICENCES, 'Saira-abc.woff2']))).toEqual([]);
  });

  it('name each text that is missing', () => {
    const problems = checkFontLicences(dist(['Saira-abc.woff2', 'OFL-saira.txt']));
    expect(problems).toHaveLength(3);
    expect(problems.join(' ')).toContain('OFL-gochihand.txt');
    expect(problems.join(' ')).toContain('OFL-rubikmonoone.txt');
    expect(problems.join(' ')).toContain('OFL-sairacondensed.txt');
  });

  it('fail when there is no font file to travel with, or no assets folder at all', () => {
    expect(checkFontLicences(dist([...FONT_LICENCES])).join(' ')).toContain('font');
    expect(checkFontLicences(join(tmpdir(), 'no-such-dist-folder-fonts')).length).toBeGreaterThan(0);
  });
});
