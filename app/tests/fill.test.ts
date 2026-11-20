import { sealRecord, validateRecord } from 'core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFillScreen, firstMissing, type FillScreen } from '../src/screens/fill.js';
import type { PhotoCodec } from '../src/photo.js';
import { openStore, type Store } from '../src/store.js';
import { getTemplate, recordFromTemplate } from '../src/templates/index.js';
import type { Template } from '../src/templates/index.js';

let store: Store;
let screen: FillScreen;

function counterCodec(): PhotoCodec {
  let n = 0;
  return {
    measure: async () => ({ width: 10, height: 10 }),
    render: async () => btoa(`photo number ${n++}`),
  };
}

async function make(templateId: string, codec: PhotoCodec = counterCodec()): Promise<FillScreen> {
  store = await openStore({ idb: null, onNotice: () => undefined });
  screen = createFillScreen({
    template: getTemplate(templateId) as Template,
    store,
    draftId: 'd1',
    now: () => 1234,
    codec,
  });
  document.body.append(screen.element);
  return screen;
}
const root = () => screen.element;
function type(selector: string, value: string): void {
  const input = root().querySelector(selector) as HTMLInputElement;
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}
function choose(selector: string, value: string): void {
  const select = root().querySelector(selector) as HTMLSelectElement;
  select.value = value;
  select.dispatchEvent(new Event('change', { bubbles: true }));
}
function sign(party: 'giver' | 'receiver'): void {
  const slot = root().querySelector(`[data-signature-slot="${party}"]`) as HTMLElement;
  slot.dispatchEvent(new MouseEvent('pointerdown', { clientX: 1, clientY: 1 }));
  slot.dispatchEvent(new MouseEvent('pointermove', { clientX: 5, clientY: 5 }));
  slot.dispatchEvent(new MouseEvent('pointerup', { clientX: 5, clientY: 5 }));
}
const missing = () => [...root().querySelectorAll('[data-missing="true"]')].map((e) => e.getAttribute('data-field') ?? e.getAttribute('data-signature-slot'));
const stamp = () => root().querySelector('[data-control="stamp"]') as HTMLButtonElement;
const note = () => root().querySelector('[data-role="note"]')?.textContent ?? '';
const click = (control: string) => (root().querySelector(`[data-control="${control}"]`) as HTMLElement).click();

function fillKeyHandover(): void {
  type('[data-control="party-giver"]', 'Ilse Brandt');
  type('[data-control="party-receiver"]', 'Joaquin Pell');
  type('[data-control="field-address"]', '14 Harbour Lane');
  type('[data-control="field-keys"]', '3');
  choose('[data-control="field-fob"]', 'yes');
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  screen?.destroy();
  screen?.element.remove();
  vi.useRealTimers();
});

describe('firstMissing', () => {
  const template = getTemplate('key-handover') as Template;
  const base = recordFromTemplate(template);
  const names = { ...base, parties: { giver: 'A', receiver: 'B' } };
  it('names the first empty line, in form order', () => {
    expect(firstMissing(base, template)).toBe('giver');
    expect(firstMissing({ ...base, parties: { giver: 'A', receiver: '' } }, template)).toBe('receiver');
    expect(firstMissing({ ...base, parties: { giver: '   ', receiver: 'B' } }, template)).toBe('giver');
    expect(firstMissing(names, template)).toBe('address');
  });
  it('then asks for the two signatures', () => {
    const filled = {
      ...names,
      fields: names.fields.map((f) => ({ ...f, value: f.kind === 'choice' ? 'yes' : '3' })),
    };
    expect(firstMissing(filled, template)).toBe('signature-giver');
    const one = { ...filled, signatures: [{ party: 'giver' as const, strokes: [[1, 2]] }] };
    expect(firstMissing(one, template)).toBe('signature-receiver');
    const both = { ...one, signatures: [...one.signatures, { party: 'receiver' as const, strokes: [[1, 2]] }] };
    expect(firstMissing(both, template)).toBeNull();
  });
  it('treats an empty stroke list as no signature', () => {
    const filled = {
      ...names,
      fields: names.fields.map((f) => ({ ...f, value: f.kind === 'choice' ? 'yes' : '3' })),
      signatures: [{ party: 'giver' as const, strokes: [] }],
    };
    expect(firstMissing(filled, template)).toBe('signature-giver');
  });
});

describe('fill screen, lock rule', () => {
  it('is marked as the fill screen and every control has data-control', async () => {
    await make('key-handover');
    expect(root().getAttribute('data-screen')).toBe('fill');
    for (const c of root().querySelectorAll('input:not([type="file"]), select, textarea, button')) {
      expect(c.getAttribute('data-control'), c.outerHTML.slice(0, 80)).toBeTruthy();
    }
  });

  it('keeps the stamp locked and marks the first missing line', async () => {
    await make('key-handover');
    expect(stamp().getAttribute('aria-disabled')).toBe('true');
    expect(screen.isLocked()).toBe(true);
    expect(missing()).toEqual(['giver']);
    type('[data-control="party-giver"]', 'Ilse Brandt');
    expect(missing()).toEqual(['receiver']);
    type('[data-control="party-receiver"]', 'Joaquin Pell');
    expect(missing()).toEqual(['address']);
  });

  it('moves the mark to the signatures and unlocks when all is done', async () => {
    await make('key-handover');
    fillKeyHandover();
    expect(missing()).toEqual(['giver']);
    sign('giver');
    expect(missing()).toEqual(['receiver']);
    sign('receiver');
    expect(missing()).toEqual([]);
    expect(stamp().getAttribute('aria-disabled')).toBe('false');
    expect(screen.isLocked()).toBe(false);
  });

  it('locks again when a required line is emptied', async () => {
    await make('key-handover');
    fillKeyHandover();
    sign('giver');
    sign('receiver');
    type('[data-control="field-address"]', '');
    expect(screen.isLocked()).toBe(true);
    expect(missing()).toEqual(['address']);
  });

  it('does not lock for an empty optional line', async () => {
    await make('key-handover');
    fillKeyHandover();
    sign('giver');
    sign('receiver');
    expect(root().querySelector('[data-field="notes"]')).not.toBeNull();
    expect(screen.isLocked()).toBe(false);
  });

  it('marks a number that is not a number', async () => {
    await make('key-handover');
    fillKeyHandover();
    sign('giver');
    sign('receiver');
    type('[data-control="field-keys"]', 'three');
    expect(missing()).toEqual(['keys']);
    type('[data-control="field-keys"]', '3.1415');
    expect(missing()).toEqual(['keys']);
    type('[data-control="field-keys"]', '3.141');
    expect(missing()).toEqual([]);
  });

  it('shows an instruction of at most 6 words, one for each state', async () => {
    await make('key-handover');
    const words = () => (root().querySelector('[data-role="instruction"]')?.textContent ?? '').trim().split(/\s+/).length;
    const locked = root().querySelector('[data-role="instruction"]')?.textContent;
    expect(words()).toBeLessThanOrEqual(6);
    fillKeyHandover();
    sign('giver');
    sign('receiver');
    expect(words()).toBeLessThanOrEqual(6);
    expect(root().querySelector('[data-role="instruction"]')?.textContent).not.toBe(locked);
  });

  it('a tap on the locked stamp changes nothing and does not throw', async () => {
    await make('key-handover');
    expect(() => stamp().click()).not.toThrow();
    expect(screen.isLocked()).toBe(true);
  });

  it('builds a record that validateRecord and sealRecord accept', async () => {
    await make('key-handover');
    fillKeyHandover();
    sign('giver');
    sign('receiver');
    const record = screen.getRecord();
    expect(validateRecord(record)).toEqual([]);
    expect(record.fields.map((f) => f.id)).toEqual(['address', 'keys', 'fob', 'meter', 'notes']);
    expect(record.fields.find((f) => f.id === 'meter')?.value).toBeNull();
    expect(record.signatures.map((s) => s.party).sort()).toEqual(['giver', 'receiver']);
    expect(sealRecord(record, '2026-11-16T09:30:00Z').ok).toBe(true);
  });

  it('returns a copy of the record', async () => {
    await make('key-handover');
    type('[data-control="party-giver"]', 'Ilse');
    screen.getRecord().parties.giver = 'Changed';
    expect(screen.getRecord().parties.giver).toBe('Ilse');
  });
});

describe('fill screen, draft', () => {
  it('saves nothing before a change', async () => {
    await make('key-handover');
    await vi.advanceTimersByTimeAsync(5000);
    expect(await store.listDrafts()).toEqual([]);
  });

  it('saves a draft within 1 second of a change', async () => {
    await make('key-handover');
    type('[data-control="party-giver"]', 'Ilse');
    await vi.advanceTimersByTimeAsync(1000);
    const drafts = await store.listDrafts();
    expect(drafts).toHaveLength(1);
    expect(drafts[0]).toMatchObject({ id: 'd1', templateId: 'key-handover', updatedAt: 1234 });
    expect(drafts[0]?.record.parties.giver).toBe('Ilse');
  });

  it('saves the latest state after several quick changes', async () => {
    await make('key-handover');
    type('[data-control="party-giver"]', 'I');
    await vi.advanceTimersByTimeAsync(100);
    type('[data-control="party-giver"]', 'Il');
    await vi.advanceTimersByTimeAsync(100);
    type('[data-control="party-giver"]', 'Ilse');
    await vi.advanceTimersByTimeAsync(1000);
    const drafts = await store.listDrafts();
    expect(drafts).toHaveLength(1);
    expect(drafts[0]?.record.parties.giver).toBe('Ilse');
  });

  it('saves a pending change when the screen is destroyed', async () => {
    await make('key-handover');
    type('[data-control="party-giver"]', 'Ilse');
    screen.destroy();
    await vi.advanceTimersByTimeAsync(0);
    expect((await store.listDrafts())[0]?.record.parties.giver).toBe('Ilse');
  });

  it('starts from a given record', async () => {
    store = await openStore({ idb: null, onNotice: () => undefined });
    const template = getTemplate('key-handover') as Template;
    const initial = { ...recordFromTemplate(template), parties: { giver: 'Back Again', receiver: '' } };
    screen = createFillScreen({ template, store, draftId: 'd2', initialRecord: initial });
    document.body.append(screen.element);
    expect((root().querySelector('[data-control="party-giver"]') as HTMLInputElement).value).toBe('Back Again');
  });
});

describe('fill screen, limits', () => {
  it('stops text at 500 characters and says so in one line', async () => {
    await make('key-handover');
    type('[data-control="field-address"]', 'x'.repeat(499));
    expect(note()).toBe('');
    type('[data-control="field-address"]', 'x'.repeat(600));
    expect((root().querySelector('[data-control="field-address"]') as HTMLInputElement).value).toHaveLength(500);
    expect(screen.getRecord().fields.find((f) => f.id === 'address')?.value).toHaveLength(500);
    expect(note()).toBe('Text stops at 500 characters.');
  });

  it('stops a name at 500 characters too', async () => {
    await make('key-handover');
    type('[data-control="party-giver"]', 'y'.repeat(501));
    expect(screen.getRecord().parties.giver).toHaveLength(500);
    expect(note()).toBe('Text stops at 500 characters.');
  });

  it('lets the blank form grow to 12 lines and refuses the 13th', async () => {
    await make('blank');
    for (let i = 0; i < 12; i++) click(i % 2 === 0 ? 'add-line-text' : 'add-line-photo');
    expect(root().querySelectorAll('[data-field^="line-"]')).toHaveLength(12);
    expect(note()).toBe('');
    click('add-line-text');
    click('add-line-photo');
    expect(root().querySelectorAll('[data-field^="line-"]')).toHaveLength(12);
    expect(note()).toBe('Twelve lines is the most.');
    expect(root().querySelector('[data-control="add-line-text"]')?.getAttribute('aria-disabled')).toBe('true');
  });

  it('keeps the values of the blank form lines when a line is added', async () => {
    await make('blank');
    click('add-line-text');
    type('[data-field="line-1"] input', 'first');
    click('add-line-text');
    expect((root().querySelector('[data-field="line-1"] input') as HTMLInputElement).value).toBe('first');
    expect(screen.getRecord().fields.map((f) => f.id)).toEqual(['line-1', 'line-2']);
  });

  it('does not lock the blank form for lines that are empty', async () => {
    await make('blank');
    click('add-line-text');
    type('[data-control="party-giver"]', 'A');
    type('[data-control="party-receiver"]', 'B');
    sign('giver');
    sign('receiver');
    expect(screen.isLocked()).toBe(false);
  });
});

describe('fill screen, photos', () => {
  async function blankWithPhotoLines(count: number): Promise<void> {
    await make('blank');
    for (let i = 0; i < count; i++) click('add-line-photo');
  }
  const blob = () => new Blob(['x']);

  it('adds a photo to its line, with its size', async () => {
    await blankWithPhotoLines(1);
    await screen.addPhoto('line-1', blob());
    expect(root().querySelector('[data-field="line-1"] img.photo')).not.toBeNull();
    expect(root().querySelector('[data-field="line-1"] .photo-size')?.textContent).toMatch(/^\d+ KB$/);
    expect(screen.getRecord().photos).toHaveLength(1);
    expect(validateRecord(screen.getRecord())).toEqual([]);
    expect(note()).toBe('');
  });

  it('refuses a seventh photo and says why', async () => {
    await blankWithPhotoLines(7);
    for (let i = 1; i <= 6; i++) await screen.addPhoto(`line-${i}`, blob());
    expect(screen.getRecord().photos).toHaveLength(6);
    await screen.addPhoto('line-7', blob());
    expect(screen.getRecord().photos).toHaveLength(6);
    expect(note()).toBe('Six photos is the most.');
    expect(root().querySelector('[data-field="line-7"] img.photo')).toBeNull();
  });

  it('lets a photo replace the photo on the same line when there are 6', async () => {
    await blankWithPhotoLines(6);
    for (let i = 1; i <= 6; i++) await screen.addPhoto(`line-${i}`, blob());
    await screen.addPhoto('line-3', blob());
    expect(screen.getRecord().photos).toHaveLength(6);
    expect(note()).toBe('');
    expect(validateRecord(screen.getRecord())).toEqual([]);
  });

  it('refuses a photo that is on the form already', async () => {
    const same: PhotoCodec = { measure: async () => ({ width: 5, height: 5 }), render: async () => btoa('same bytes') };
    await make('blank', same);
    click('add-line-photo');
    click('add-line-photo');
    await screen.addPhoto('line-1', blob());
    await screen.addPhoto('line-2', blob());
    expect(screen.getRecord().photos).toHaveLength(1);
    expect(note()).toBe('This photo is on the form already.');
  });

  it('says so when a photo is too big or cannot be read, and adds nothing', async () => {
    const big: PhotoCodec = { measure: async () => ({ width: 5, height: 5 }), render: async () => 'A'.repeat(1_500_001) };
    await make('blank', big);
    click('add-line-photo');
    await screen.addPhoto('line-1', blob());
    expect(note()).toBe('This photo is too big.');
    screen.destroy();
    screen.element.remove();
    const none: PhotoCodec = { measure: async () => null, render: async () => '' };
    await make('blank', none);
    click('add-line-photo');
    await screen.addPhoto('line-1', blob());
    expect(note()).toBe('This photo could not be read');
    expect(screen.getRecord().photos).toEqual([]);
  });

  it('keeps names and signatures when a photo is added', async () => {
    await make('rental-return');
    type('[data-control="party-giver"]', 'Mara');
    sign('giver');
    await screen.addPhoto('photo-front', blob());
    expect((root().querySelector('[data-control="party-giver"]') as HTMLInputElement).value).toBe('Mara');
    expect(screen.getRecord().signatures.map((s) => s.party)).toEqual(['giver']);
    expect(root().querySelectorAll('[data-signature-slot="giver"] polyline')).toHaveLength(1);
  });
});

describe('firstMissing, tool loan', () => {
  const template = getTemplate('tool-loan') as Template;
  const base = recordFromTemplate(template);
  const names = { ...base, parties: { giver: 'A', receiver: 'B' } };
  const set = (record: typeof names, values: Record<string, string>) => ({
    ...record,
    fields: record.fields.map((f) => (f.id in values ? { ...f, value: values[f.id] as string } : f)),
  });
  const sign = (record: typeof names) => ({
    ...record,
    signatures: [
      { party: 'giver' as const, strokes: [[1, 2]] },
      { party: 'receiver' as const, strokes: [[1, 2]] },
    ],
  });

  it('marks Tool, then Condition, then Return by, in form order', () => {
    expect(firstMissing(names, template)).toBe('tool');
    expect(firstMissing(set(names, { tool: 'Drill' }), template)).toBe('condition');
    expect(firstMissing(set(names, { tool: 'Drill', condition: 'good' }), template)).toBe('return-by');
    expect(firstMissing(set(names, { tool: 'Drill', condition: 'good', 'return-by': '   ' }), template)).toBe('return-by');
  });

  it('allows the stamp with Marking or serial, Deposit, Notes and the photo empty', () => {
    const filled = sign(set(names, { tool: 'Drill', condition: 'worn', 'return-by': 'Friday' }));
    expect(firstMissing(filled, template)).toBeNull();
  });
});
