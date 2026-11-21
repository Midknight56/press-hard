// What three first-time testers found on 2026-11-20, each as a test that failed before the fix.
// The list with the tester of each row is docs/acceptance/blind-test-fixes-2026-11-20.md.
import { buildCopyFile, sealRecord, type HandoverRecord } from 'core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Audio } from '../src/audio.js';
import { createNav } from '../src/nav.js';
import { createFillScreen, type FillScreen } from '../src/screens/fill.js';
import { openStore } from '../src/store.js';
import { getTemplate, type Template } from '../src/templates/index.js';
import { sampleRecord } from '../src/templates/sample.js';
import { createVerifyPage } from '../src/verify/page.js';

let screen: FillScreen | null = null;

async function fill(templateId: string): Promise<FillScreen> {
  const store = await openStore({ idb: null, onNotice: () => undefined });
  screen = createFillScreen({ template: getTemplate(templateId) as Template, store, draftId: 'b1', now: () => 1 });
  document.body.append(screen.element);
  return screen;
}
const q = <T extends Element>(selector: string) => (screen as FillScreen).element.querySelector(selector) as T;
function type(control: string, value: string): void {
  const input = q<HTMLInputElement>(`[data-control="${control}"]`);
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}
function choose(control: string, value: string): void {
  const select = q<HTMLSelectElement>(`[data-control="${control}"]`);
  select.value = value;
  select.dispatchEvent(new Event('change', { bubbles: true }));
}
const instruction = () => q<HTMLElement>('[data-role="instruction"]').textContent;

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  screen?.destroy();
  screen?.element.remove();
  screen = null;
  vi.useRealTimers();
});

describe('the instruction by the stamp names the line to fill', () => {
  it('says which line is empty, in form order', async () => {
    await fill('rental-return');
    expect(instruction()).toBe('Fill in Giver name');
    type('party-giver', 'Mara Oduya');
    expect(instruction()).toBe('Fill in Receiver name');
    type('party-receiver', 'Tobin Larch');
    type('field-item', 'Bike');
    expect(instruction()).toBe('Fill in Condition');
  });

  it('says a number is needed when a number line holds other text', async () => {
    await fill('rental-return');
    type('party-giver', 'A');
    type('party-receiver', 'B');
    type('field-item', 'Bike');
    choose('field-condition', 'worn');
    type('field-mileage', '-5 abc');
    expect(instruction()).toBe('Write a number in Mileage');
  });

  it('says a number is needed in the tool loan Deposit', async () => {
    await fill('tool-loan');
    type('party-giver', 'ab');
    type('party-receiver', 'ab');
    type('field-tool', 'ab');
    choose('field-condition', 'good');
    type('field-return-by', 'ab');
    type('field-deposit', 'ab');
    expect(instruction()).toBe('Write a number in Deposit');
  });

  it('says who signs next', async () => {
    await fill('blank');
    type('party-giver', 'Mara Oduya');
    type('party-receiver', 'Tobin Larch');
    expect(instruction()).toBe('Giver signs in the marked box');
  });
});

describe('a line that may stay empty says so', () => {
  it('marks Fuel and Damage notes optional, and not Item or Mileage', async () => {
    await fill('rental-return');
    // The word is drawn by CSS from data-optional, after the label; the browser test reads the drawn word.
    const optional = (id: string) => q<HTMLElement>(`[data-field="${id}"]`).getAttribute('data-optional');
    expect(optional('fuel')).toBe('true');
    expect(optional('damage')).toBe('true');
    expect(optional('item')).toBeNull();
    expect(optional('mileage')).toBeNull();
    expect(q<HTMLElement>('[data-field="fuel"] .label').textContent).toBe('Fuel');  });
});

describe('the Sound button says whether sound is on', () => {
  it('reads Sound on, then Sound off after a press', () => {
    let on = true;
    const audio = { enabled: () => on, setEnabled: (v: boolean) => void (on = v) } as unknown as Audio;
    const nav = createNav({ page: 'app', verifyHref: '../verify/', appHref: '../app/', audio });
    const sound = nav.element.querySelector('[data-control="nav-sound"]') as HTMLButtonElement;
    expect(sound.textContent).toBe('Sound on');
    sound.click();
    expect(sound.textContent).toBe('Sound off');
  });
});

describe('Check page', () => {
  const sealed = (() => {
    const result = sealRecord(structuredClone(sampleRecord), '2026-11-20T09:00:00Z');
    if (!result.ok) throw new Error(result.problems.join('; '));
    return result.record as HandoverRecord;
  })();
  const good = buildCopyFile(sealed, { title: 'Press Hard', paper: 'carbon' });
  const file = (text: string, name = 'copy.html') => new File([text], name, { type: 'text/html' });
  let page: ReturnType<typeof createVerifyPage>;
  const el = (selector: string) => page.element.querySelector(selector) as HTMLElement | null;

  beforeEach(() => {
    vi.useRealTimers();
    page = createVerifyPage();
    document.body.replaceChildren(page.element);
  });

  it('marks the changed line of one changed file, as the landing page promises', async () => {
    await page.loadFiles([file(good.split('Tobin Larch').join('Tobin Larsh'))]);
    expect(el('[data-role="verdict"]')?.textContent).toBe('Changed after sealing');
    const line = el('[data-field="receiver"]');
    expect(line?.classList.contains('changed')).toBe(true);
    expect(line?.querySelector('[data-role="diff"]')?.textContent).toBe('This line was changed after sealing');
    expect(page.element.querySelectorAll('.line.changed')).toHaveLength(1);
  });

  it('names the first copy in its verdict when two files are checked', async () => {
    await page.loadFiles([file(good, 'a.html'), file(good.split('Tobin Larch').join('Tobin Larsh'), 'b.html')]);
    expect(el('[data-role="verdict"]')?.textContent).toBe('First copy: Seal matches');
    expect(el('[data-role="verdict-b"]')?.textContent).toBe('Second copy: Changed after sealing');
  });

  it('answers seal words typed with no file', () => {
    const typed = el('[data-control="verify-typed"]') as HTMLInputElement;
    typed.value = 'silk-arrow-pepper-emb';
    typed.dispatchEvent(new Event('input', { bubbles: true }));
    expect(el('[data-role="need-file"]')?.textContent).toBe('Choose the copy file to check these words');
  });

  it('says what each box is for', () => {
    const text = page.element.textContent ?? '';
    expect(text).toContain('Choose two copy files to compare them line by line');
    expect(text).toContain('Seal words, optional');
    expect(text).toContain('The four words on the copy. They show it is the copy you were given.');
  });
});
