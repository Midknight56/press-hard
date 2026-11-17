import { canonicalText, sealRecord, validateRecord, verifyRecord, type Field, type HandoverRecord } from 'core';
import fc from 'fast-check';
import { beforeEach, describe, expect, it } from 'vitest';
import { createTamperScreen } from '../src/screens/tamper.js';
import { checkDuplicate, duplicate, editLine } from '../src/tamper.js';
import { templates, recordFromTemplate } from '../src/templates/index.js';
import { sampleRecord } from '../src/templates/sample.js';

function sealed(record: HandoverRecord): HandoverRecord {
  const result = sealRecord(record, '2026-11-16T09:30:00Z');
  if (!result.ok) throw new Error(result.problems.join('; '));
  return result.record;
}

/** A sealed record built from a template: every line that is not a photo is filled. */
function filled(templateIndex: number): HandoverRecord {
  const template = templates[templateIndex]!;
  const record = recordFromTemplate(template);
  const fields: Field[] = record.fields.map((f) => ({
    ...f,
    value: f.kind === 'number' ? '12.5' : f.kind === 'choice' ? (f.options?.[0] ?? null) : `text of ${f.id}`,
  }));
  if (template.id === 'blank') {
    fields.push({ id: 'line-1', label: 'Line 1', kind: 'text', value: 'a line' });
    fields.push({ id: 'line-2', label: 'Line 2', kind: 'text', value: 'another line' });
  }
  return sealed({
    ...record,
    parties: { giver: 'Mara Oduya', receiver: 'Tobin Larch' },
    fields,
    signatures: sampleRecord.signatures,
  });
}

const records: [string, HandoverRecord][] = [
  ['the sample', sealed(sampleRecord)],
  ...templates.map((t, i): [string, HandoverRecord] => [t.id, filled(i)]),
];

function valueFor(field: Field): fc.Arbitrary<string> {
  if (field.kind === 'choice') return fc.constantFrom(...(field.options ?? ['x']));
  if (field.kind === 'number') {
    return fc.oneof(
      fc.integer({ min: -99999, max: 99999 }).map(String),
      fc.tuple(fc.integer({ min: 0, max: 9999 }), fc.integer({ min: 1, max: 9 })).map(([a, b]) => `${a}.${b}`),
    );
  }
  return fc.string({ maxLength: 60 });
}

describe('a changed duplicate is caught (property 4)', () => {
  it.each(records)('%s: one edited line gives changed and marks that line only', (_name, record) => {
    const before = canonicalText(record);
    const editable = record.fields.filter((f) => f.kind !== 'photo');
    expect(editable.length).toBeGreaterThan(0);
    for (const field of editable) {
      fc.assert(
        fc.property(valueFor(field), (value) => {
          fc.pre(value !== (field.value ?? ''));
          const edited = editLine(duplicate(record), field.id, value);
          expect(edited.ok, `${field.id} = ${JSON.stringify(value)}`).toBe(true);
          if (!edited.ok) return;
          const result = checkDuplicate(record, edited.record);
          expect(result.verdict).toBe('changed');
          expect(result.marked).toEqual([field.id]);
          expect(edited.record.seal).toBe(record.seal);
        }),
        { numRuns: 25 },
      );
    }
    expect(canonicalText(record)).toBe(before);
    expect(verifyRecord(record)).toBe('matches');
  });

  it('marks a party line when a name is edited', () => {
    const record = records[0]![1];
    const edited = editLine(duplicate(record), 'giver', 'Someone Else');
    expect(edited.ok).toBe(true);
    if (!edited.ok) return;
    expect(checkDuplicate(record, edited.record)).toMatchObject({ verdict: 'changed', marked: ['giver'] });
  });

  it('shows matches and no mark when the duplicate is not changed', () => {
    const record = records[0]![1];
    expect(checkDuplicate(record, duplicate(record))).toMatchObject({ verdict: 'matches', marked: [] });
  });
});

describe('editLine', () => {
  const record = records[0]![1];

  it('never changes the record it is given', () => {
    const before = structuredClone(record);
    editLine(record, 'item', 'Another trailer');
    expect(record).toEqual(before);
  });

  it('refuses a photo line, an unknown line, a bad number, and a text over 500 characters', () => {
    expect(editLine(record, 'photo-front', 'x')).toMatchObject({ ok: false });
    expect(editLine(record, 'nothing-here', 'x')).toMatchObject({ ok: false });
    expect(editLine(record, 'mileage', 'a lot')).toMatchObject({ ok: false });
    expect(editLine(record, 'item', 'x'.repeat(501))).toMatchObject({ ok: false });
  });

  it('keeps a record that validateRecord accepts', () => {
    const edited = editLine(record, 'item', 'Another trailer');
    expect(edited.ok && validateRecord(edited.record)).toEqual([]);
  });
});

describe('tamper screen', () => {
  const record = records[0]![1];
  let screen: ReturnType<typeof createTamperScreen>;
  const verdict = () => screen.element.querySelector('[data-role="verdict"]') as HTMLElement;
  const type = (control: string, value: string) => {
    const input = screen.element.querySelector(`[data-control="${control}"]`) as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  };

  beforeEach(() => {
    document.body.replaceChildren();
    screen = createTamperScreen({ record, onBack: () => undefined });
    document.body.append(screen.element);
  });

  it('names its screen and starts with Seal matches', () => {
    expect(screen.element.getAttribute('data-screen')).toBe('tamper');
    expect(verdict().textContent).toBe('Seal matches');
  });

  it('shows Changed after sealing and marks the edited line', () => {
    type('field-item', 'Cargo trailer, 3 m');
    expect(verdict().textContent).toBe('Changed after sealing');
    const line = screen.element.querySelector('[data-field="item"]') as HTMLElement;
    expect(line.classList.contains('changed')).toBe(true);
    expect(line.querySelector('[data-role="diff"]')?.textContent).toContain('Cargo trailer, 3 m');
    expect(screen.element.querySelectorAll('.line.changed')).toHaveLength(1);
  });

  it('goes back to Seal matches when the edit is undone', () => {
    type('field-item', 'Cargo trailer, 3 m');
    type('field-item', 'Cargo trailer, 2 m');
    expect(verdict().textContent).toBe('Seal matches');
    expect(screen.element.querySelectorAll('.line.changed')).toHaveLength(0);
  });

  it('says in one line when an edit is not allowed and keeps the last good duplicate', () => {
    type('field-item', 'Cargo trailer, 3 m');
    type('field-mileage', 'a lot');
    const refused = screen.element.querySelector('[data-role="refused"]') as HTMLElement;
    expect(refused.textContent).not.toBe('');
    expect(verdict().textContent).toBe('Changed after sealing');
  });

  it('leaves the original record untouched', () => {
    const before = structuredClone(record);
    type('field-item', 'Cargo trailer, 3 m');
    type('party-giver', 'Someone Else');
    expect(record).toEqual(before);
    expect(verifyRecord(record)).toBe('matches');
  });
});
