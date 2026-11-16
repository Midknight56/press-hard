import { sealRecord, sealWords, type HandoverRecord } from 'core';
import { describe, expect, it, vi } from 'vitest';
import { createCopyScreen } from '../src/screens/copy.js';
import { sampleRecord } from '../src/templates/sample.js';

const sealed = (() => {
  const r = sealRecord(sampleRecord, '2026-11-16T09:30:00Z');
  if (!r.ok) throw new Error('sample did not seal');
  return r.record as HandoverRecord;
})();
const words = sealWords(sealed.seal as string);

describe('copy screen', () => {
  it('is marked as the copy screen and shows the top sheet over the carbon copy', () => {
    const { element } = createCopyScreen({ record: sealed, reducedMotion: false });
    expect(element.getAttribute('data-screen')).toBe('copy');
    const top = element.querySelector('.top-sheet') as HTMLElement;
    const carbon = element.querySelector('.carbon-sheet') as HTMLElement;
    expect(top.querySelector('.form')?.classList.contains('ink-carbon')).toBe(false);
    expect(carbon.querySelector('.form')?.classList.contains('ink-carbon')).toBe(true);
    const sheets = [...element.querySelectorAll('.sheets > *')].map((s) => s.className.split(' ')[0]);
    expect(sheets).toEqual(['carbon-sheet', 'top-sheet']);
  });

  it('shows the same content and the four seal words on both sheets', () => {
    const { element } = createCopyScreen({ record: sealed, reducedMotion: false });
    for (const sheet of ['.top-sheet', '.carbon-sheet']) {
      const s = element.querySelector(sheet) as HTMLElement;
      expect(s.querySelector('.seal-words')?.textContent).toBe(words);
      expect(s.querySelector('[data-field="giver"] .value')?.textContent).toBe('Mara Oduya');
      expect(s.querySelector('[data-field="mileage"] .value')?.textContent).toBe('312.5 km');
    }
    expect(words.split('-')).toHaveLength(4);
  });

  it('lifts the top sheet with full motion', () => {
    const { element } = createCopyScreen({ record: sealed, reducedMotion: false });
    expect(element.getAttribute('data-motion')).toBe('full');
    expect(element.querySelector('.top-sheet')?.classList.contains('lift')).toBe(true);
    expect(element.querySelector('.fade')).toBeNull();
  });

  it('uses a plain fade and no lift when the system asks for reduced motion', () => {
    const { element } = createCopyScreen({ record: sealed, reducedMotion: true });
    expect(element.getAttribute('data-motion')).toBe('reduced');
    expect(element.querySelector('.lift')).toBeNull();
    expect(element.querySelector('.carbon-sheet')?.classList.contains('fade')).toBe(true);
  });

  it('offers only the actions it is given, each with a data-control', () => {
    const onTearOff = vi.fn<() => void>();
    const onNew = vi.fn<() => void>();
    const { element } = createCopyScreen({ record: sealed, reducedMotion: false, onTearOff, onNew });
    const controls = [...element.querySelectorAll('button')].map((b) => b.getAttribute('data-control'));
    expect(controls).toEqual(['tear-off', 'new-form']);
    (element.querySelector('[data-control="tear-off"]') as HTMLElement).click();
    (element.querySelector('[data-control="new-form"]') as HTMLElement).click();
    expect(onTearOff).toHaveBeenCalledTimes(1);
    expect(onNew).toHaveBeenCalledTimes(1);
  });

  it('refuses a record with no seal', () => {
    expect(() => createCopyScreen({ record: sampleRecord, reducedMotion: false })).toThrow(/seal/);
  });
});