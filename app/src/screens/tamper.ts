import type { HandoverRecord } from 'core';
import { renderForm, type FormChange } from '../form/index.js';
import { checkDuplicate, duplicate, editLine } from '../tamper.js';
import type { Template } from '../templates/types.js';
import { VERDICT_TEXT } from '../verify/check.js';

export interface TamperOptions {
  record: HandoverRecord;
  onBack(): void;
}

const show = (value: string | null) => (value === null ? 'nothing' : value);

function make<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className !== undefined) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/**
 * Try to change this copy. The user edits one line of a duplicate in memory. The duplicate keeps
 * the original seal, so the check says `Changed after sealing` and the edited line is marked.
 * The stored record is never touched: this screen has no store.
 */
export function createTamperScreen(options: TamperOptions): { element: HTMLElement } {
  const original = options.record;
  let current = duplicate(original);

  const element = make('main', 'screen tamper');
  element.setAttribute('data-screen', 'tamper');
  const title = make('h1', undefined, 'Try to change this copy');
  const instruction = make('p', undefined, 'Edit any line below');
  instruction.setAttribute('data-role', 'instruction');
  const back = make('button', undefined, 'Back');
  back.type = 'button';
  back.setAttribute('data-control', 'back');
  back.addEventListener('click', options.onBack);

  const verdict = make('p');
  verdict.setAttribute('data-role', 'verdict');
  verdict.setAttribute('aria-live', 'polite');
  const refused = make('p', 'refused');
  refused.setAttribute('data-role', 'refused');
  refused.setAttribute('aria-live', 'polite');

  // Photo lines stay as they are: only text, choice and number lines and the two names can be edited.
  const template: Template = {
    id: original.form.templateId,
    title: original.form.title,
    fields: original.fields
      .filter((f) => f.kind !== 'photo')
      .map((f) => ({
        id: f.id,
        label: f.label,
        kind: f.kind,
        required: false,
        ...(f.options !== undefined ? { options: [...f.options] } : {}),
        ...(f.unit !== undefined ? { unit: f.unit } : {}),
      })),
  };

  const holder = make('div', 'form-holder');

  function update(): void {
    const result = checkDuplicate(original, current);
    verdict.textContent = VERDICT_TEXT[result.verdict];
    verdict.className = `verdict verdict-${result.verdict}`;
    verdict.setAttribute('data-verdict', result.verdict);
    for (const line of holder.querySelectorAll('.line.changed')) line.classList.remove('changed');
    for (const note of holder.querySelectorAll('[data-role="diff"]')) note.remove();
    for (const id of result.marked) {
      const line = holder.querySelector(`[data-field="${id}"]`);
      if (line === null) continue;
      line.classList.add('changed');
      for (const d of result.differences.filter((x) => x.path === `fields.${id}.value` || x.path === `parties.${id}`)) {
        const note = make('p', 'diff', `Original: ${show(d.a)}. Now: ${show(d.b)}`);
        note.setAttribute('data-role', 'diff');
        line.append(note);
      }
    }
  }

  function onChange(change: FormChange): void {
    if (change.kind === 'photo-request') return;
    const line = change.kind === 'party' ? change.party : change.id;
    const edited = editLine(current, line, change.value ?? '');
    if (edited.ok) {
      current = edited.record;
      refused.textContent = '';
    } else {
      refused.textContent = edited.line;
    }
    update();
  }

  const form = renderForm(current, { mode: 'edit', template, onChange });
  form.querySelector('.signatures')?.remove();
  holder.append(form);
  element.append(back, title, instruction, verdict, refused, holder);
  update();
  return { element };
}
