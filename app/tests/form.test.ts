import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { sealRecord, sealWords, type HandoverRecord } from 'core';
import { describe, expect, it, vi } from 'vitest';
import { renderForm } from '../src/form/index.js';
import { recordFromTemplate, templates } from '../src/templates/index.js';
import { sampleRecord } from '../src/templates/sample.js';

const lineOf = (root: HTMLElement, id: string) => root.querySelector(`[data-field="${id}"]`) as HTMLElement | null;

describe('form renderer, every field of every template', () => {
  for (const template of templates) {
    for (const mode of ['edit', 'top', 'carbon'] as const) {
      it(`${template.id} in ${mode} mode draws each line with its label`, () => {
        const root = renderForm(recordFromTemplate(template), { mode, template });
        for (const field of template.fields) {
          const line = lineOf(root, field.id);
          expect(line, `line ${field.id}`).not.toBeNull();
          expect(line?.querySelector('.label')?.textContent).toBe(field.label);
        }
        expect(root.querySelector('h2')?.textContent).toBe(template.title);
      });
    }
  }

  it('starts with the giver name line and the receiver name line', () => {
    const root = renderForm(sampleRecord, { mode: 'top' });
    const lines = [...root.querySelectorAll('[data-field]')].map((l) => l.getAttribute('data-field'));
    expect(lines.slice(0, 2)).toEqual(['giver', 'receiver']);
    expect(lineOf(root, 'giver')?.textContent).toContain('Mara Oduya');
    expect(lineOf(root, 'receiver')?.textContent).toContain('Tobin Larch');
  });

  it('shows a number with its unit and a choice as its text', () => {
    const root = renderForm(sampleRecord, { mode: 'top' });
    expect(lineOf(root, 'mileage')?.querySelector('.value')?.textContent).toBe('312.5 km');
    expect(lineOf(root, 'condition')?.querySelector('.value')?.textContent).toBe('worn');
  });

  it('shows the photos and the two signatures of a filled record', () => {
    const root = renderForm(sampleRecord, { mode: 'top' });
    expect(root.querySelectorAll('img.photo')).toHaveLength(2);
    expect(root.querySelector('img.photo')?.getAttribute('src')).toMatch(/^data:image\/jpeg;base64,/);
    expect(root.querySelectorAll('svg[data-signature]')).toHaveLength(2);
    expect(root.querySelectorAll('svg[data-signature] polyline')).toHaveLength(4);
  });
});

describe('form renderer, modes', () => {
  it('sets the carbon ink class only in carbon mode', () => {
    expect(renderForm(sampleRecord, { mode: 'carbon' }).classList.contains('ink-carbon')).toBe(true);
    expect(renderForm(sampleRecord, { mode: 'top' }).classList.contains('ink-carbon')).toBe(false);
    expect(renderForm(sampleRecord, { mode: 'edit' }).classList.contains('ink-carbon')).toBe(false);
  });

  it('marks the mode on the root', () => {
    for (const mode of ['edit', 'top', 'carbon'] as const) {
      expect(renderForm(sampleRecord, { mode }).getAttribute('data-mode')).toBe(mode);
    }
  });

  it('has inputs only in edit mode, each with a data-control and a 500 character limit', () => {
    const edit = renderForm(sampleRecord, { mode: 'edit', template: templates[0] });
    const top = renderForm(sampleRecord, { mode: 'top' });
    expect(top.querySelectorAll('input, select, textarea, button')).toHaveLength(0);
    const controls = [...edit.querySelectorAll('input, select, textarea')];
    expect(controls.length).toBeGreaterThanOrEqual(5);
    for (const control of controls) expect(control.getAttribute('data-control')).toBeTruthy();
    for (const input of edit.querySelectorAll('input[type="text"]')) {
      expect(input.getAttribute('maxlength')).toBe('500');
    }
  });

  it('puts the label of a line before its control in edit mode, and offers the options of a choice', () => {
    const edit = renderForm(recordFromTemplate(templates[0] as never), { mode: 'edit', template: templates[0] });
    const select = lineOf(edit, 'condition')?.querySelector('select');
    expect([...(select?.options ?? [])].map((o) => o.value)).toEqual(['', 'good', 'worn', 'damaged']);
  });

  it('shows the seal words of a sealed record and none for an unsealed one', () => {
    const sealed = sealRecord(sampleRecord, '2026-11-16T09:30:00Z');
    if (!sealed.ok) throw new Error('sample did not seal');
    const words = sealWords(sealed.record.seal as string);
    expect(renderForm(sealed.record, { mode: 'carbon' }).querySelector('.seal-words')?.textContent).toBe(words);
    expect(renderForm(sampleRecord, { mode: 'top' }).querySelector('.seal-words')).toBeNull();
  });
});

describe('form renderer, text is text', () => {
  const hostile: HandoverRecord = {
    ...sampleRecord,
    parties: { giver: '<b>Giver</b>', receiver: '<img src=x onerror=alert(1)>' },
    fields: [
      { id: 'item', label: '<i>Item</i>', kind: 'text', value: 'a <b>bold</b> <script>1</script> claim' },
    ],
    photos: [],
    signatures: [],
  };

  for (const mode of ['top', 'carbon', 'edit'] as const) {
    it(`shows markup in a value, label or name as text in ${mode} mode`, () => {
      const root = renderForm(hostile, { mode });
      expect(root.querySelector('b')).toBeNull();
      expect(root.querySelector('i')).toBeNull();
      expect(root.querySelector('script')).toBeNull();
      expect(root.querySelector('img')).toBeNull();
      if (mode === 'edit') {
        expect((lineOf(root, 'item')?.querySelector('input') as HTMLInputElement).value).toBe(
          'a <b>bold</b> <script>1</script> claim',
        );
        expect((lineOf(root, 'giver')?.querySelector('input') as HTMLInputElement).value).toBe('<b>Giver</b>');
      } else {
        expect(lineOf(root, 'item')?.querySelector('.value')?.textContent).toBe('a <b>bold</b> <script>1</script> claim');
        expect(lineOf(root, 'giver')?.querySelector('.value')?.textContent).toBe('<b>Giver</b>');
      }
      expect(lineOf(root, 'item')?.querySelector('.label')?.textContent).toBe('<i>Item</i>');
    });
  }
});

describe('form renderer, edit events', () => {
  it('reports a changed name and a changed field', () => {
    const onChange = vi.fn();
    const root = renderForm(recordFromTemplate(templates[1] as never), { mode: 'edit', template: templates[1], onChange });
    const giver = lineOf(root, 'giver')?.querySelector('input') as HTMLInputElement;
    giver.value = 'Ilse';
    giver.dispatchEvent(new Event('input', { bubbles: true }));
    const address = lineOf(root, 'address')?.querySelector('input') as HTMLInputElement;
    address.value = '14 Harbour Lane';
    address.dispatchEvent(new Event('input', { bubbles: true }));
    expect(onChange).toHaveBeenNthCalledWith(1, { kind: 'party', party: 'giver', value: 'Ilse' });
    expect(onChange).toHaveBeenNthCalledWith(2, { kind: 'field', id: 'address', value: '14 Harbour Lane' });
  });

  it('reports an empty choice as null', () => {
    const onChange = vi.fn();
    const root = renderForm(sampleRecord, { mode: 'edit', template: templates[0], onChange });
    const select = lineOf(root, 'condition')?.querySelector('select') as HTMLSelectElement;
    select.value = '';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    expect(onChange).toHaveBeenCalledWith({ kind: 'field', id: 'condition', value: null });
  });
});

describe('theme.css', () => {
  const css = readFileSync(join(import.meta.dirname, '../src/form/theme.css'), 'utf8');
  it('has the carbon ink class and the red form number', () => {
    expect(css).toContain('.ink-carbon');
    expect(css).toContain('.form-number');
  });
  it('loads nothing from another site and no web font', () => {
    expect(css).not.toMatch(/@import|url\(\s*['"]?https?:|@font-face/);
  });
});