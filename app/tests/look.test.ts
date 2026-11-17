import { sealRecord, type HandoverRecord } from 'core';
import { describe, expect, it } from 'vitest';
import { renderForm } from '../src/form/index.js';
import { createNav } from '../src/nav.js';
import { createFillScreen } from '../src/screens/fill.js';
import { openStore } from '../src/store.js';
import { getTemplate, recordFromTemplate } from '../src/templates/index.js';
import type { Template } from '../src/templates/index.js';
import { sampleRecord } from '../src/templates/sample.js';

const sealed = (() => {
  const r = sealRecord(structuredClone(sampleRecord), '2026-11-17T09:30:00Z');
  if (!r.ok) throw new Error('sample did not seal');
  return r.record as HandoverRecord;
})();

/** Words the design adds for decoration. They are drawn with CSS content, so no text node may hold them. */
const DECORATIVE = /HANDED OVER|SEALED|PEN ONLY|YOU ARE MAKING|Fill in together|Both sign|Seal with the stamp|Peel back, keep the copy|\d{1,2} NOV \d{4}/;

describe('the stamp impression on a sealed sheet', () => {
  for (const mode of ['top', 'carbon'] as const) {
    it(`is on the ${mode} sheet, hidden from readers, and holds no text`, () => {
      const root = renderForm(sealed, { mode });
      const mark = root.querySelector('.impression') as HTMLElement;
      expect(mark).not.toBeNull();
      expect(mark.getAttribute('aria-hidden')).toBe('true');
      expect(mark.textContent).toBe('');
      expect(mark.querySelector('[data-date]')?.getAttribute('data-date')).toBe('17 NOV 2026');
      expect(root.textContent).not.toMatch(DECORATIVE);
    });
  }

  it('is not on a form that is not sealed', () => {
    expect(renderForm(recordFromTemplate(getTemplate('rental-return') as Template), { mode: 'edit' }).querySelector('.impression')).toBeNull();
    expect(renderForm(sampleRecord, { mode: 'top' }).querySelector('.impression')).toBeNull();
  });
});

describe('form lines', () => {
  it('carry a class for their kind and the form carries its template', () => {
    const template = getTemplate('rental-return') as Template;
    const root = renderForm(recordFromTemplate(template), { mode: 'edit', template });
    expect(root.getAttribute('data-template')).toBe('rental-return');
    const kind = (id: string) => root.querySelector(`[data-field="${id}"]`)?.className;
    expect(kind('giver')).toContain('line-party');
    expect(kind('item')).toContain('line-text');
    expect(kind('condition')).toContain('line-choice');
    expect(kind('mileage')).toContain('line-number');
    expect(kind('photo-front')).toContain('line-photo');
    // The old class and the data attributes stay.
    expect(root.querySelector('[data-field="item"]')?.classList.contains('line')).toBe(true);
  });
});

describe('the nav', () => {
  const make = () => createNav({ page: 'app', verifyHref: '../verify/', appHref: '../app/' });

  it('has the tagline as real text', () => {
    const { element } = make();
    expect(element.querySelector('.tagline')?.textContent).toBe('The carbon copy, back from the dead.');
  });

  it('has the four steps as hidden, empty markup', () => {
    const { element } = make();
    const steps = element.querySelector('.steps') as HTMLElement;
    expect(steps.getAttribute('aria-hidden')).toBe('true');
    expect(steps.textContent).toBe('');
    expect([...steps.querySelectorAll('li')].map((li) => li.getAttribute('data-step'))).toEqual([
      'Fill in together',
      'Both sign',
      'Seal with the stamp',
      'Peel back, keep the copy',
    ]);
  });

  it('marks the current page on one button', () => {
    const nav = make();
    nav.setCurrent('nav-library');
    const marked = [...nav.element.querySelectorAll('[aria-current="page"]')].map((e) => e.getAttribute('data-control'));
    expect(marked).toEqual(['nav-library']);
    nav.setCurrent(null);
    expect(nav.element.querySelector('[aria-current]')).toBeNull();
  });
});

describe('the fill screen', () => {
  async function make() {
    const store = await openStore({ idb: null, onNotice: () => undefined });
    const screen = createFillScreen({ template: getTemplate('rental-return') as Template, store, draftId: 'look' });
    document.body.append(screen.element);
    return screen;
  }

  it('has a seal row with the stamp target, hidden from readers and without text', async () => {
    const screen = await make();
    const row = screen.element.querySelector('[data-box="sheet"] > .seal-row') as HTMLElement;
    expect(row).not.toBeNull();
    expect(row.getAttribute('aria-hidden')).toBe('true');
    expect(row.querySelector('.seal-target')).not.toBeNull();
    expect(row.textContent).toBe('');
    expect(screen.element.textContent).not.toMatch(DECORATIVE);
    screen.destroy();
  });

  it('keeps the seal row when the form is drawn again', async () => {
    const screen = await make();
    screen.addLine('text');
    expect(screen.element.querySelectorAll('.seal-row').length).toBe(1);
    screen.destroy();
  });

  it('mirrors the hold progress on the screen, so that the ring and the dim can follow it', async () => {
    const screen = await make();
    expect(screen.element.classList.contains('holding')).toBe(false);
    screen.stampButton.setAttribute('data-progress', '0.4');
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.element.classList.contains('holding')).toBe(true);
    expect(screen.element.style.getPropertyValue('--progress')).toBe('0.4');
    screen.stampButton.setAttribute('data-progress', '0');
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.element.classList.contains('holding')).toBe(false);
    screen.destroy();
  });
});
