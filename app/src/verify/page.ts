import { diffRecords, findChangedLines, type Difference } from 'core';
import { renderForm } from '../form/index.js';
import { checkCopy, lineName, placeDifferences, VERDICT_TEXT, type Checked } from './check.js';

function make<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className !== undefined) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

const show = (value: string | null) => (value === null ? 'nothing' : value);

/** The verify page. It reads every file as text and draws every value as text. */
export interface VerifyPageOptions {
  /** Called after a file load that gave a copy, with the template id of that copy. */
  onChecked?: (templateId: string) => void;
}

export function createVerifyPage(options: VerifyPageOptions = {}): {
  element: HTMLElement;
  loadFiles(files: File[]): Promise<void>;
  ready(): Promise<void>;
} {
  const element = make('main', 'screen verify');
  element.setAttribute('data-screen', 'verify');

  const title = make('h1', undefined, 'Check a copy');
  const instruction = make('p', undefined, 'Choose a copy file');
  instruction.setAttribute('data-role', 'instruction');

  const fileLabel = make('label', 'field-label', 'Copy file');
  const picker = make('span', 'file-picker');
  const button = make('span', 'file-button');
  const fileInput = make('input');
  fileInput.type = 'file';
  fileInput.multiple = true;
  fileInput.accept = '.html,text/html';
  fileInput.setAttribute('data-control', 'verify-file');
  // The browser's own box is not shown. The real input lies over this button and takes the click.
  const fileNames = make('span', 'file-names', 'No file chosen');
  fileNames.setAttribute('data-role', 'file-names');
  button.append('Choose a copy file', fileInput);
  picker.append(button, fileNames);
  fileLabel.append(picker);
  const fileHint = make('p', 'field-hint', 'Choose two copy files to compare them line by line');
  fileHint.id = 'verify-file-hint';
  fileInput.setAttribute('aria-describedby', fileHint.id);

  const typedLabel = make('label', 'field-label', 'Seal words, optional');
  const typedInput = make('input');
  typedInput.type = 'text';
  typedInput.autocomplete = 'off';
  typedInput.spellcheck = false;
  typedInput.setAttribute('data-control', 'verify-typed');
  typedLabel.append(typedInput);
  const typedHint = make('p', 'field-hint', 'The four words on the copy. They show it is the copy you were given.');
  typedHint.id = 'verify-typed-hint';
  typedInput.setAttribute('aria-describedby', typedHint.id);

  const result = make('div', 'verify-result');
  result.setAttribute('aria-live', 'polite');
  element.append(title, instruction, fileLabel, fileHint, typedLabel, typedHint, result);

  let texts: string[] = [];
  let pending: Promise<void> = Promise.resolve();

  /** Draws the result. Returns the template id of the first copy when it was a copy. */
  function render(): string | null {
    result.replaceChildren();
    if (texts.length === 0) {
      if (typedInput.value.trim() !== '') {
        const need = make('p', 'verify-need', 'Choose the copy file to check these words');
        need.setAttribute('data-role', 'need-file');
        result.append(need);
      }
      return null;
    }
    const checks: Checked[] = texts.slice(0, 2).map((text, i) => checkCopy(text, i === 0 ? typedInput.value : ''));
    const bad = checks.find((c) => !c.ok);
    if (bad !== undefined && !bad.ok) {
      const error = make('p', 'verify-error', bad.line);
      error.setAttribute('data-role', 'error');
      result.append(error);
      return null;
    }
    const [first, second] = checks;
    if (first === undefined || !first.ok) return null;

    // With two files each verdict names its copy, so that two answers never read as one.
    const verdictText = second === undefined ? VERDICT_TEXT[first.verdict] : `First copy: ${VERDICT_TEXT[first.verdict]}`;
    const verdict = make('p', `verdict verdict-${first.verdict}`, verdictText);
    verdict.setAttribute('data-role', 'verdict');
    verdict.setAttribute('data-verdict', first.verdict);
    result.append(verdict);

    let differences: Difference[] = [];
    if (second !== undefined && second.ok) {
      const other = make('p', 'verdict-second', `Second copy: ${VERDICT_TEXT[second.verdict]}`);
      other.setAttribute('data-role', 'verdict-b');
      other.setAttribute('data-verdict', second.verdict);
      result.append(other);
      differences = diffRecords(first.record, second.record);
    }

    const placed = placeDifferences(differences);
    const form = renderForm(first.record, { mode: 'top' });

    // One changed file: the line marks of the file show which lines no longer match.
    const marked: string[] = [];
    let unmarked: string[] = [];
    if (second === undefined && first.verdict === 'changed') {
      const lines = findChangedLines(texts[0] as string, first.record) ?? [];
      for (const name of lines) {
        const id = /^parties\.(giver|receiver)$/.exec(name)?.[1] ?? /^fields\.(.+)$/.exec(name)?.[1];
        const line = id === undefined ? null : form.querySelector(`[data-field="${id}"]`);
        if (line === null) {
          unmarked.push(lineName(name));
          continue;
        }
        line.classList.add('changed');
        const note = make('p', 'diff', 'This line was changed after sealing');
        note.setAttribute('data-role', 'diff');
        line.append(note);
        marked.push(name);
      }
      unmarked = [...new Set(unmarked)];
      if (lines.length === 0) {
        const none = make('p', 'verify-note', 'This file cannot show the changed line. Choose the other copy too to compare them.');
        none.setAttribute('data-role', 'no-line');
        result.append(none);
      }
    }
    for (const [id, list] of placed.lines) {
      const line = form.querySelector(`[data-field="${id}"]`);
      if (line === null) {
        placed.others.push(...list);
        continue;
      }
      line.classList.add('changed');
      for (const d of list) {
        const what = d.path.endsWith('.label') ? 'Label' : 'Value';
        const note = make('p', 'diff', `${what}: first copy ${show(d.a)}, second copy ${show(d.b)}`);
        note.setAttribute('data-role', 'diff');
        line.append(note);
      }
    }
    result.append(form);

    if (unmarked.length > 0) {
      const box = make('section', 'diff-list');
      box.setAttribute('data-box', 'panel');
      box.setAttribute('data-role', 'changed-parts');
      box.append(make('h2', undefined, marked.length > 0 ? 'Other changed parts' : 'Changed parts'));
      const list = make('ul');
      for (const name of unmarked) list.append(make('li', undefined, name));
      box.append(list);
      result.append(box);
    }

    if (second !== undefined && differences.length === 0) {
      const same = make('p', 'verify-same', 'These two copies are the same');
      same.setAttribute('data-role', 'same');
      result.append(same);
    }
    if (placed.others.length > 0) {
      const box = make('section', 'diff-list');
      box.setAttribute('data-box', 'panel');
      box.setAttribute('data-role', 'differences');
      box.append(make('h2', undefined, 'Other differences'));
      const list = make('ul');
      for (const d of placed.others) {
        list.append(make('li', undefined, `${d.path}: first copy ${show(d.a)}, second copy ${show(d.b)}`));
      }
      box.append(list);
      result.append(box);
    }
    return first.record.form.templateId;
  }

  function loadFiles(files: File[]): Promise<void> {
    fileNames.textContent = files.length === 0 ? 'No file chosen' : files.map((f) => f.name).join(', ');
    const run = Promise.all(files.slice(0, 2).map((f) => f.text()))
      .then((loaded) => {
        texts = loaded;
        const templateId = render();
        if (templateId !== null) options.onChecked?.(templateId);
      })
      .catch(() => {
        texts = [];
        result.replaceChildren();
        const error = make('p', 'verify-error', 'This file could not be read');
        error.setAttribute('data-role', 'error');
        result.append(error);
      });
    pending = run;
    return run;
  }

  fileInput.addEventListener('change', () => {
    void loadFiles(Array.from(fileInput.files ?? []));
  });
  typedInput.addEventListener('input', () => {
    render();
  });
  element.addEventListener('dragover', (event) => event.preventDefault());
  element.addEventListener('drop', (event) => {
    event.preventDefault();
    const dropped = Array.from((event as DragEvent).dataTransfer?.files ?? []);
    if (dropped.length > 0) void loadFiles(dropped);
  });

  return { element, loadFiles, ready: () => pending };
}
