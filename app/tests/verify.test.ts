import { buildCopyFile, sealRecord, sealWords, type HandoverRecord } from 'core';
import { beforeEach, describe, expect, it } from 'vitest';
import { checkCopy, parseTyped, placeDifferences } from '../src/verify/check.js';
import { createVerifyPage } from '../src/verify/page.js';
import { sampleRecord } from '../src/templates/sample.js';

function seal(record: HandoverRecord, time = '2026-11-16T09:30:00Z'): HandoverRecord {
  const result = sealRecord(record, time);
  if (!result.ok) throw new Error(result.problems.join('; '));
  return result.record;
}

const good = seal(sampleRecord);
const goodText = buildCopyFile(good, { title: 'Press Hard', paper: 'carbon' });
const words = sealWords(good.seal as string);

/** One character of the mileage value changed inside the record element, as a person editing the file would. */
function changeMileage(text: string, to: string): string {
  const start = text.indexOf('<script id="record"');
  const end = text.indexOf('</script>', start);
  const record = text.slice(start, end);
  const edited = record.replace(/("id":"mileage"[^}]*?"value":")[^"]*(")/, `$1${to}$2`);
  expect(edited).not.toBe(record);
  return text.slice(0, start) + edited + text.slice(end);
}

function withoutSeal(text: string): string {
  const edited = text.replace(/,"seal":"[0-9a-f]{64}"/, '');
  expect(edited).not.toBe(text);
  return edited;
}

describe('parseTyped', () => {
  it('reads nothing from an empty or blank text', () => {
    expect(parseTyped('')).toEqual({ kind: 'none' });
    expect(parseTyped('   ')).toEqual({ kind: 'none' });
  });

  it('reads 64 hex characters as a full seal, in any case and with spaces around', () => {
    const seal = good.seal as string;
    expect(parseTyped(`  ${seal.toUpperCase()} `)).toEqual({ kind: 'seal', seal });
  });

  it('reads other text as seal words and accepts dashes, spaces and commas', () => {
    expect(parseTyped('Elm Marble, atlas-bagel')).toEqual({ kind: 'words', words: 'elm-marble-atlas-bagel' });
  });
});

describe('checkCopy', () => {
  it('matches a good copy', () => {
    const checked = checkCopy(goodText);
    expect(checked.ok && checked.verdict).toBe('matches');
  });

  it('matches when the typed seal words are right, in any case and separator', () => {
    for (const typed of [words, words.toUpperCase(), words.replace(/-/g, ' '), words.replace(/-/g, ', ')]) {
      const checked = checkCopy(goodText, typed);
      expect(checked.ok && checked.verdict, typed).toBe('matches');
    }
  });

  it('says wrong_seal when the typed seal words belong to another copy', () => {
    const checked = checkCopy(goodText, 'elm-elm-elm-elm');
    expect(checked.ok && checked.verdict).toBe('wrong_seal');
  });

  it('matches when the typed full seal is right and says wrong_seal when it is another seal', () => {
    const right = checkCopy(goodText, good.seal as string);
    expect(right.ok && right.verdict).toBe('matches');
    const other = checkCopy(goodText, 'a'.repeat(64));
    expect(other.ok && other.verdict).toBe('wrong_seal');
  });

  it('shows a changed copy as changed, whatever is typed', () => {
    const changed = changeMileage(goodText, '12.5');
    for (const typed of [undefined, words, good.seal as string, 'elm-elm-elm-elm', 'b'.repeat(64)]) {
      const checked = checkCopy(changed, typed);
      expect(checked.ok && checked.verdict, String(typed)).toBe('changed');
    }
  });

  it('shows a copy with no seal as unsealed, whatever is typed', () => {
    const text = withoutSeal(goodText);
    for (const typed of [undefined, words, good.seal as string]) {
      const checked = checkCopy(text, typed);
      expect(checked.ok && checked.verdict, String(typed)).toBe('unsealed');
    }
  });

  it('gives one plain line for each parse error', () => {
    const notCopy = checkCopy('just some text');
    expect(notCopy).toMatchObject({ ok: false, error: 'no_record', line: 'This file is not a copy file' });
    const badJson = checkCopy('<script id="record" type="application/json">{nope</script>');
    expect(badJson).toMatchObject({ ok: false, error: 'bad_json', line: 'This copy file cannot be read' });
    const badRecord = checkCopy('<script id="record" type="application/json">{"format":1}</script>');
    expect(badRecord).toMatchObject({ ok: false, error: 'bad_record', line: 'This copy file is not a valid record' });
  });
});

describe('placeDifferences', () => {
  it('puts a value or label difference on its line and lists every other path under the form', () => {
    const placed = placeDifferences([
      { path: 'fields.mileage.value', a: '48210.5', b: '12.5' },
      { path: 'fields.item.label', a: 'Item', b: 'Thing' },
      { path: 'parties.giver', a: 'A', b: 'B' },
      { path: 'sealedAt', a: 'x', b: 'y' },
      { path: 'fields.mileage.unit', a: 'km', b: 'mi' },
      { path: 'signatures.giver', a: 'h1', b: 'h2' },
      { path: 'photos.order', a: '1,2', b: '2,1' },
    ]);
    expect([...placed.lines.keys()]).toEqual(['mileage', 'item']);
    expect(placed.lines.get('mileage')).toEqual([{ path: 'fields.mileage.value', a: '48210.5', b: '12.5' }]);
    expect(placed.others.map((d) => d.path)).toEqual([
      'parties.giver',
      'sealedAt',
      'fields.mileage.unit',
      'signatures.giver',
      'photos.order',
    ]);
  });
});

describe('verify page checked event', () => {
  it('tells the caller the template id once for each file load, and not for a bad file or a typed word', async () => {
    const seen: string[] = [];
    const page = createVerifyPage({ onChecked: (id) => seen.push(id) });
    document.body.replaceChildren(page.element);
    await page.loadFiles([new File(['hello'], 'n.txt')]);
    expect(seen).toEqual([]);
    await page.loadFiles([new File([goodText], 'a.html')]);
    expect(seen).toEqual(['rental-return']);
    const typed = page.element.querySelector('[data-control="verify-typed"]') as HTMLInputElement;
    typed.value = 'elm';
    typed.dispatchEvent(new Event('input', { bubbles: true }));
    expect(seen).toEqual(['rental-return']);
  });
});

describe('verify page', () => {
  let page: ReturnType<typeof createVerifyPage>;
  const file = (text: string, name = 'copy.html') => new File([text], name, { type: 'text/html' });
  const verdict = () => page.element.querySelector('[data-role="verdict"]') as HTMLElement;
  const typedBox = () => page.element.querySelector('[data-control="verify-typed"]') as HTMLInputElement;
  const type = async (text: string) => {
    typedBox().value = text;
    typedBox().dispatchEvent(new Event('input', { bubbles: true }));
    await page.ready();
  };

  beforeEach(() => {
    document.body.replaceChildren();
    page = createVerifyPage();
    document.body.append(page.element);
  });

  it('names its screen and its controls', () => {
    expect(page.element.getAttribute('data-screen')).toBe('verify');
    expect(page.element.querySelector('[data-control="verify-file"]')).not.toBeNull();
    expect(typedBox()).not.toBeNull();
  });

  it('shows Seal matches for a good file', async () => {
    await page.loadFiles([file(goodText)]);
    expect(verdict().textContent).toBe('Seal matches');
    expect(verdict().getAttribute('data-verdict')).toBe('matches');
  });

  it('shows Changed after sealing for a changed file', async () => {
    await page.loadFiles([file(changeMileage(goodText, '12.5'))]);
    expect(verdict().textContent).toBe('Changed after sealing');
  });

  it('shows This copy has no seal for an unsealed file', async () => {
    await page.loadFiles([file(withoutSeal(goodText))]);
    expect(verdict().textContent).toBe('This copy has no seal');
  });

  it('compares typed seal words with the stored seal', async () => {
    await page.loadFiles([file(goodText)]);
    await type('elm-elm-elm-elm');
    expect(verdict().textContent).toBe('These words belong to another copy');
    await type(words);
    expect(verdict().textContent).toBe('Seal matches');
  });

  it('passes a typed full seal on as the expected seal', async () => {
    await page.loadFiles([file(goodText)]);
    await type('c'.repeat(64));
    expect(verdict().textContent).toBe('These words belong to another copy');
    await type(good.seal as string);
    expect(verdict().textContent).toBe('Seal matches');
  });

  it('keeps Changed after sealing when words are typed for a changed file', async () => {
    await page.loadFiles([file(changeMileage(goodText, '12.5'))]);
    await type(words);
    expect(verdict().textContent).toBe('Changed after sealing');
  });

  it('says in one line that a text file is not a copy and keeps working', async () => {
    await page.loadFiles([file('hello', 'note.txt')]);
    const error = page.element.querySelector('[data-role="error"]') as HTMLElement;
    expect(error.textContent).toBe('This file is not a copy file');
    expect(page.element.querySelector('[data-role="verdict"]')).toBeNull();
    await page.loadFiles([file(goodText)]);
    expect(verdict().textContent).toBe('Seal matches');
    expect(page.element.querySelector('[data-role="error"]')).toBeNull();
  });

  it('shows the mileage difference of two files on the mileage line, with both values', async () => {
    await page.loadFiles([file(goodText, 'a.html'), file(changeMileage(goodText, '12.5'), 'b.html')]);
    const line = page.element.querySelector('[data-field="mileage"]') as HTMLElement;
    const diff = line.querySelector('[data-role="diff"]') as HTMLElement;
    expect(diff.textContent).toContain('312.5');
    expect(diff.textContent).toContain('12.5');
    expect(page.element.querySelectorAll('[data-role="diff"]')).toHaveLength(1);
    expect(page.element.querySelector('[data-role="differences"]')).toBeNull();
  });

  it('lists a difference that has no form line under the form, with its path', async () => {
    const later = seal(sampleRecord, '2026-11-17T10:00:00Z');
    const laterText = buildCopyFile(later, { title: 'Press Hard', paper: 'carbon' });
    await page.loadFiles([file(goodText, 'a.html'), file(laterText, 'b.html')]);
    const listed = page.element.querySelector('[data-role="differences"]') as HTMLElement;
    expect(listed.textContent).toContain('sealedAt');
    expect(listed.textContent).toContain('2026-11-16T09:30:00Z');
    expect(listed.textContent).toContain('2026-11-17T10:00:00Z');
  });

  it('says two equal copies are the same', async () => {
    await page.loadFiles([file(goodText, 'a.html'), file(goodText, 'b.html')]);
    expect((page.element.querySelector('[data-role="same"]') as HTMLElement).textContent).toBe(
      'These two copies are the same',
    );
  });

  it('shows markup in a value as text and never runs it', async () => {
    const hostile: HandoverRecord = seal({
      ...sampleRecord,
      fields: sampleRecord.fields.map((f) => (f.id === 'item' ? { ...f, value: '<img src=x onerror="window.pwned=1"><b>x</b>' } : f)),
    });
    await page.loadFiles([file(buildCopyFile(hostile, { title: 'Press Hard', paper: 'carbon' }))]);
    expect(page.element.querySelector('img[src="x"]')).toBeNull();
    expect(page.element.querySelector('b')).toBeNull();
    expect(page.element.textContent).toContain('<img src=x onerror="window.pwned=1"><b>x</b>');
    expect((window as unknown as { pwned?: number }).pwned).toBeUndefined();
  });
});
