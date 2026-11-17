import { sealWords, type Field, type HandoverRecord, type Photo, type Signature } from 'core';
import { prefersReducedMotion } from '../motion.js';
import type { Template, TemplateField } from '../templates/types.js';

export type FormMode = 'edit' | 'top' | 'carbon';

export type FormChange =
  | { kind: 'party'; party: 'giver' | 'receiver'; value: string }
  | { kind: 'field'; id: string; value: string | null }
  | { kind: 'photo-request'; id: string };

export interface RenderOptions {
  mode: FormMode;
  /** When given, the lines come from the template, so that empty photo lines are drawn too. */
  template?: Template;
  onChange?: (change: FormChange) => void;
}

/** What one line needs to be drawn. */
interface Line {
  id: string;
  label: string;
  kind: TemplateField['kind'];
  options?: string[];
  unit?: string;
}

const MAX_TEXT = 500;
const BASE64 = /^[A-Za-z0-9+/]*={0,2}$/;
const SVG_NS = 'http://www.w3.org/2000/svg';

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className !== undefined) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function lineShell(id: string, label: string, kind: string): HTMLElement {
  const line = el('div', `line line-${kind}`);
  line.setAttribute('data-field', id);
  line.append(el('span', 'label', label));
  return line;
}

function photoImage(photo: Photo): HTMLImageElement | null {
  if (!BASE64.test(photo.dataBase64)) return null;
  const img = el('img', 'photo');
  img.setAttribute('src', `data:image/jpeg;base64,${photo.dataBase64}`);
  img.setAttribute('alt', '');
  img.setAttribute('width', String(photo.width));
  img.setAttribute('height', String(photo.height));
  return img;
}

function signatureSvg(signature: Signature): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 1000 1000');
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('class', 'signature');
  svg.setAttribute('data-signature', signature.party);
  for (const stroke of signature.strokes) {
    const points: string[] = [];
    for (let i = 0; i + 1 < stroke.length; i += 2) points.push(`${stroke[i]},${stroke[i + 1]}`);
    const polyline = document.createElementNS(SVG_NS, 'polyline');
    polyline.setAttribute('points', points.join(' '));
    svg.append(polyline);
  }
  return svg;
}

function shownValue(line: Line, value: string | null): string {
  if (value === null || value === '') return '';
  return line.kind === 'number' && line.unit ? `${value} ${line.unit}` : value;
}

/**
 * A typed character inks in over 60 ms (a 150 ms cross fade with reduced motion): the ink bleeds a little and settles.
 * Only a text shadow moves, so the colour of the text, and its contrast, are never lowered, and nothing shifts.
 */
const INK_IN_MS = 60;
function inkIn(input: HTMLInputElement): void {
  if (typeof input.animate !== 'function') return;
  input.animate([{ textShadow: '0 0 2px currentColor' }, { textShadow: '0 0 0 transparent' }], {
    duration: prefersReducedMotion() ? 150 : INK_IN_MS,
    easing: 'ease-out',
  });
}
function textInput(controlId: string, value: string, inputMode?: string): HTMLInputElement {
  const input = el('input');
  input.type = 'text';
  input.maxLength = MAX_TEXT;
  input.value = value;
  input.setAttribute('data-control', controlId);
  input.addEventListener('input', () => inkIn(input));
  if (inputMode !== undefined) input.setAttribute('inputmode', inputMode);
  return input;
}

function editControl(line: Line, field: Field | undefined, emit: (c: FormChange) => void): HTMLElement {
  const current = field?.value ?? null;
  if (line.kind === 'choice') {
    const select = el('select');
    select.setAttribute('data-control', `field-${line.id}`);
    for (const option of ['', ...(line.options ?? [])]) {
      const item = el('option', undefined, option);
      item.value = option;
      select.append(item);
    }
    select.value = current ?? '';
    select.addEventListener('change', () =>
      emit({ kind: 'field', id: line.id, value: select.value === '' ? null : select.value }),
    );
    return select;
  }
  const input = textInput(`field-${line.id}`, current ?? '', line.kind === 'number' ? 'decimal' : undefined);
  input.addEventListener('input', () => emit({ kind: 'field', id: line.id, value: input.value }));
  const wrap = el('span', 'control-wrap');
  wrap.append(input);
  if (line.kind === 'number' && line.unit) wrap.append(el('span', 'unit', line.unit));
  return wrap;
}

function partyLine(
  party: 'giver' | 'receiver',
  label: string,
  value: string,
  options: RenderOptions,
  emit: (c: FormChange) => void,
): HTMLElement {
  const line = lineShell(party, label, 'party');
  if (options.mode === 'edit') {
    const input = textInput(`party-${party}`, value);
    input.addEventListener('input', () => emit({ kind: 'party', party, value: input.value }));
    line.append(input);
  } else {
    line.append(el('span', 'value', value));
  }
  return line;
}

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

/** A date text such as 2026-11-17T09:30:00Z, written as 17 NOV 2026. An empty string when the text is not a date. */
export function stampDate(sealedAt: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(sealedAt ?? '');
  const month = m === null ? undefined : MONTHS[Number(m[2]) - 1];
  return m === null || month === undefined ? '' : `${Number(m[3])} ${month} ${m[1]}`;
}

/** The round stamp mark on a sealed sheet: three empty parts, so that no word is a text node. look.css writes the words. */
export function stampImpression(sealedAt: string | null | undefined): HTMLElement {
  const mark = el('div', 'impression');
  mark.setAttribute('aria-hidden', 'true');
  const top = el('i', 'imp-top');
  const word = el('i', 'imp-word');
  const date = el('i', 'imp-date');
  date.setAttribute('data-date', stampDate(sealedAt));
  mark.append(top, word, date);
  return mark;
}

/** Draws one paper form from a record. Every value is set as text, never as markup. */
export function renderForm(record: HandoverRecord, options: RenderOptions): HTMLElement {
  const { mode, template } = options;
  const emit = (change: FormChange) => options.onChange?.(change);
  const root = el('section', `form form-${mode}${mode === 'carbon' ? ' ink-carbon' : ''}`);
  root.setAttribute('data-mode', mode);
  root.setAttribute('data-box', 'sheet');
  root.setAttribute('data-template', record.form.templateId);

  const head = el('header', 'form-head');
  head.append(el('h2', undefined, record.form.title));
  head.append(el('span', 'form-number', record.seal !== undefined ? record.seal.slice(0, 6) : ''));
  root.append(head);

  root.append(partyLine('giver', 'Giver name', record.parties.giver, options, emit));
  root.append(partyLine('receiver', 'Receiver name', record.parties.receiver, options, emit));

  const lines: Line[] =
    template !== undefined
      ? template.fields.map((f) => ({ id: f.id, label: f.label, kind: f.kind, options: f.options, unit: f.unit }))
      : record.fields.map((f) => ({ id: f.id, label: f.label, kind: f.kind, options: f.options, unit: f.unit }));

  for (const line of lines) {
    const field = record.fields.find((f) => f.id === line.id);
    const row = lineShell(line.id, line.label, line.kind);
    if (line.kind === 'photo') {
      const photo = record.photos.find((p) => p.digest === field?.photoDigest);
      const img = photo !== undefined ? photoImage(photo) : null;
      if (img !== null) row.append(img);
      if (mode === 'edit') {
        const add = el('button', 'add-photo', photo !== undefined ? 'Replace photo' : 'Add photo');
        add.type = 'button';
        add.setAttribute('data-control', `add-photo-${line.id}`);
        add.addEventListener('click', () => emit({ kind: 'photo-request', id: line.id }));
        row.append(add);
      }
    } else if (mode === 'edit') {
      row.append(editControl(line, field, emit));
    } else {
      row.append(el('span', 'value', shownValue(line, field?.value ?? null)));
    }
    root.append(row);
  }

  const signatures = el('div', 'signatures');
  for (const party of ['giver', 'receiver'] as const) {
    const signature = record.signatures.find((s) => s.party === party);
    if (mode === 'edit') {
      const slot = el('div', 'signature-slot');
      slot.setAttribute('data-signature-slot', party);
      slot.setAttribute('data-control', `signature-${party}`);
      slot.setAttribute('data-caption', party === 'giver' ? 'Giver signs here' : 'Receiver signs here');
      slot.setAttribute('role', 'group');
      slot.tabIndex = 0;
      slot.setAttribute('aria-label', party === 'giver' ? 'Giver signature' : 'Receiver signature');
      signatures.append(slot);
    } else if (signature !== undefined) {
      signatures.append(signatureSvg(signature));
    }
  }
  root.append(signatures);

  if (record.seal !== undefined) {
    root.append(el('footer', 'seal-words', sealWords(record.seal)));
    // The stamp impression is decoration. Its words are drawn by CSS, so this markup holds no text.
    if (mode !== 'edit') root.append(stampImpression(record.sealedAt));
  }
  return root;
}