import { sealWords, type Field, type HandoverRecord, type Photo, type Signature } from 'core';
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

function lineShell(id: string, label: string): HTMLElement {
  const line = el('div', 'line');
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

function textInput(controlId: string, value: string, inputMode?: string): HTMLInputElement {
  const input = el('input');
  input.type = 'text';
  input.maxLength = MAX_TEXT;
  input.value = value;
  input.setAttribute('data-control', controlId);
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
  const line = lineShell(party, label);
  if (options.mode === 'edit') {
    const input = textInput(`party-${party}`, value);
    input.addEventListener('input', () => emit({ kind: 'party', party, value: input.value }));
    line.append(input);
  } else {
    line.append(el('span', 'value', value));
  }
  return line;
}

/** Draws one paper form from a record. Every value is set as text, never as markup. */
export function renderForm(record: HandoverRecord, options: RenderOptions): HTMLElement {
  const { mode, template } = options;
  const emit = (change: FormChange) => options.onChange?.(change);
  const root = el('section', `form form-${mode}${mode === 'carbon' ? ' ink-carbon' : ''}`);
  root.setAttribute('data-mode', mode);

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
    const row = lineShell(line.id, line.label);
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
  }
  return root;
}