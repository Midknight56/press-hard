import type { Field, HandoverRecord, Photo } from 'core';
import { renderForm, type FormChange } from '../form/index.js';
import { browserCodec, MAX_BASE64, MAX_SIDE, photoFromResult, photoSizeKb, resizePhoto, type PhotoCodec } from '../photo.js';
import { createSignatureBox, type SignatureBox } from '../signature.js';
import type { Store } from '../store.js';
import type { Template, TemplateField } from '../templates/types.js';

export const MAX_LINES = 12;
export const MAX_PHOTOS = 6;
export const MAX_TEXT = 500;
const DRAFT_DELAY_MS = 500;
const NUMBER_TEXT = /^-?(0|[1-9][0-9]*)(\.[0-9]{1,3})?$/;
const PARTIES = ['giver', 'receiver'] as const;
type Party = (typeof PARTIES)[number];

export interface FillOptions {
  template: Template;
  store: Store;
  draftId: string;
  now?: () => number;
  initialRecord?: HandoverRecord;
  codec?: PhotoCodec;
}

export interface FillScreen {
  element: HTMLElement;
  stampButton: HTMLButtonElement;
  getRecord(): HandoverRecord;
  isLocked(): boolean;
  addPhoto(fieldId: string, file: Blob): Promise<void>;
  addLine(kind: 'text' | 'photo'): void;
  destroy(): void;
}

const hasStrokes = (strokes: number[][] | undefined) => (strokes ?? []).some((s) => s.length >= 2);

/**
 * The first line that stops the stamp, in form order: giver name, receiver name, each line of the
 * template, then the two signatures. Returns `giver`, `receiver`, a field id, `signature-giver`,
 * `signature-receiver`, or null when nothing is missing.
 */
export function firstMissing(record: HandoverRecord, template: Template): string | null {
  if (record.parties.giver.trim() === '') return 'giver';
  if (record.parties.receiver.trim() === '') return 'receiver';
  for (const line of template.fields) {
    const field = record.fields.find((f) => f.id === line.id);
    if (line.kind === 'photo') {
      if (line.required && field?.photoDigest === undefined) return line.id;
      continue;
    }
    const value = field?.value ?? null;
    const empty = value === null || value.trim() === '';
    if (empty) {
      if (line.required) return line.id;
      continue;
    }
    if (line.kind === 'number' && !NUMBER_TEXT.test(value)) return line.id;
  }
  for (const party of PARTIES) {
    if (!hasStrokes(record.signatures.find((s) => s.party === party)?.strokes)) return `signature-${party}`;
  }
  return null;
}

function make<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className !== undefined) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function controlButton(control: string, text: string): HTMLButtonElement {
  const b = make('button', undefined, text);
  b.type = 'button';
  b.setAttribute('data-control', control);
  return b;
}

export function createFillScreen(options: FillOptions): FillScreen {
  const { template, store, draftId } = options;
  const now = options.now ?? (() => Date.now());
  const codec = options.codec ?? browserCodec;

  const lines: TemplateField[] = template.fields.map((f) => ({ ...f }));
  const values = new Map<string, string | null>();
  const photoOf = new Map<string, Photo>();
  const sigs = new Map<Party, number[][]>();
  let giver = '';
  let receiver = '';

  const initial = options.initialRecord;
  if (initial !== undefined) {
    giver = initial.parties.giver;
    receiver = initial.parties.receiver;
    for (const field of initial.fields) {
      if (!lines.some((l) => l.id === field.id)) {
        lines.push({
          id: field.id,
          label: field.label,
          kind: field.kind,
          required: false,
          ...(field.options !== undefined ? { options: [...field.options] } : {}),
          ...(field.unit !== undefined ? { unit: field.unit } : {}),
        });
      }
      if (field.kind === 'photo') {
        const photo = initial.photos.find((p) => p.digest === field.photoDigest);
        if (photo !== undefined) photoOf.set(field.id, photo);
      } else {
        values.set(field.id, field.value);
      }
    }
    for (const s of initial.signatures) sigs.set(s.party, s.strokes.map((x) => [...x]));
  }

  const element = make('main', 'screen fill');
  element.setAttribute('data-screen', 'fill');
  element.append(make('h1', 'sr-only', 'Fill in the form'));
  const formHolder = make('div', 'form-holder');
  const note = make('p', 'note');
  note.setAttribute('data-role', 'note');
  note.setAttribute('aria-live', 'polite');
  const tools = make('div', 'line-tools');
  const stampArea = make('div', 'stamp-area');
  const instruction = make('p', undefined, '');
  instruction.setAttribute('data-role', 'instruction');
  const stampButton = controlButton('stamp', '');
  stampButton.classList.add('stamp');
  // The stamp picture is an element beside the label, so that the layout test can measure that they do not overlap.
  const stampArt = make('span', 'stamp-art');
  stampArt.setAttribute('data-art', 'stamp');
  stampArt.setAttribute('aria-hidden', 'true');
  stampButton.append(stampArt, make('span', 'stamp-label', 'Hold to seal'));
  stampButton.setAttribute('data-first-view', 'whole');
  // The bar follows the person at the bottom of the view.
  stampArea.setAttribute('data-sticky', 'true');
  stampArea.append(instruction, stampButton);
  const fileInput = make('input');
  fileInput.type = 'file';
  fileInput.accept = 'image/*';
  fileInput.hidden = true;

  const addText = controlButton('add-line-text', 'Add a line');
  const addPhotoLine = controlButton('add-line-photo', 'Add a photo line');
  if (template.id === 'blank') tools.append(addText, addPhotoLine);

  element.append(formHolder, tools, note, stampArea, fileInput);

  // The hold progress is mirrored on the screen, so that the ring around the stamp target and the dimming of the desk
  // (look.css) follow the same number as the pad. stamp.ts is not changed.
  const mirrorProgress = () => {
    const progress = stampButton.getAttribute('data-progress') ?? '0';
    element.style.setProperty('--progress', progress);
    const wasHolding = element.classList.contains('holding');
    element.classList.toggle('holding', Number(progress) > 0);
    // When the pad is in a bar fixed to the bottom, the view moves to the foot of the form, where the stamp comes down.
    if (!wasHolding && Number(progress) > 0 && getComputedStyle(stampArea).position === 'fixed') {
      const target = element.querySelector('.seal-row');
      if (target !== null && typeof target.scrollIntoView === 'function') target.scrollIntoView({ block: 'center' });
    }
  };
  const progressWatcher = new MutationObserver(mirrorProgress);
  progressWatcher.observe(stampButton, { attributes: true, attributeFilter: ['data-progress'] });

  let boxes: SignatureBox[] = [];
  let pendingPhotoField: string | null = null;
  let draftTimer: ReturnType<typeof setTimeout> | null = null;
  let destroyed = false;

  const say = (message: string) => {
    note.textContent = message;
  };

  function getRecord(): HandoverRecord {
    const fields: Field[] = [];
    const photos: Photo[] = [];
    for (const line of lines) {
      if (line.kind === 'photo') {
        const photo = photoOf.get(line.id);
        if (photo === undefined) continue;
        fields.push({ id: line.id, label: line.label, kind: 'photo', value: null, photoDigest: photo.digest });
        photos.push({ ...photo });
        continue;
      }
      const raw = values.get(line.id) ?? null;
      fields.push({
        id: line.id,
        label: line.label,
        kind: line.kind,
        value: raw === null || raw === '' ? null : raw,
        ...(line.unit !== undefined ? { unit: line.unit } : {}),
        ...(line.options !== undefined ? { options: [...line.options] } : {}),
      });
    }
    const signatures = PARTIES.flatMap((party) => {
      const strokes = sigs.get(party);
      return hasStrokes(strokes) ? [{ party, strokes: (strokes as number[][]).map((s) => [...s]) }] : [];
    });
    return {
      format: 1,
      form: { templateId: template.id, title: template.title },
      sealedAt: null,
      parties: { giver, receiver },
      fields,
      photos,
      signatures,
    };
  }

  const currentTemplate = (): Template => ({ ...template, fields: lines });

  function flushDraft(): void {
    if (draftTimer !== null) {
      clearTimeout(draftTimer);
      draftTimer = null;
    }
    store
      .saveDraft({ id: draftId, templateId: template.id, record: getRecord(), updatedAt: now() })
      .catch(() => undefined);
  }
  function scheduleDraft(): void {
    if (destroyed) return;
    if (draftTimer !== null) clearTimeout(draftTimer);
    draftTimer = setTimeout(flushDraft, DRAFT_DELAY_MS);
  }

  let locked = true;
  /** The instruction for the line that stops the stamp. It names the line, as the testers asked. */
  function missingText(missingId: string): string {
    if (missingId === 'signature-giver') return 'Giver signs in the marked box';
    if (missingId === 'signature-receiver') return 'Receiver signs in the marked box';
    if (missingId === 'giver') return 'Fill in Giver name';
    if (missingId === 'receiver') return 'Fill in Receiver name';
    const line = lines.find((l) => l.id === missingId);
    const label = line?.label ?? 'the marked line';
    const value = values.get(missingId) ?? null;
    if (line?.kind === 'number' && value !== null && value.trim() !== '') return `Write a number in ${label}`;
    if (line?.kind === 'photo') return `Add a photo in ${label}`;
    return `Fill in ${label}`;
  }
  function refresh(): void {
    for (const marked of element.querySelectorAll('[data-missing]')) {
      marked.removeAttribute('data-missing');
      marked.classList.remove('missing');
    }
    const missingId = firstMissing(getRecord(), currentTemplate());
    locked = missingId !== null;
    if (missingId !== null) {
      const target = missingId.startsWith('signature-')
        ? element.querySelector(`[data-signature-slot="${missingId.slice('signature-'.length)}"]`)
        : element.querySelector(`[data-field="${missingId}"]`);
      target?.setAttribute('data-missing', 'true');
      target?.classList.add('missing');
    }
    stampButton.setAttribute('aria-disabled', String(locked));
    stampButton.setAttribute('data-locked', String(locked));
    instruction.textContent = !locked ? 'Press and hold the stamp' : missingText(missingId as string);
    const full = lines.length >= MAX_LINES;
    addText.setAttribute('aria-disabled', String(full));
    addPhotoLine.setAttribute('aria-disabled', String(full));
  }

  /** Cuts text to 500 characters, writes it back to its input, and says so when it is at the limit. */
  function clip(value: string, controlSelector: string): string {
    if (value.length < MAX_TEXT) return value;
    const cut = value.slice(0, MAX_TEXT);
    const input = element.querySelector(controlSelector) as HTMLInputElement | null;
    if (input !== null && input.value !== cut) input.value = cut;
    say('Text stops at 500 characters.');
    return cut;
  }

  function onFormChange(change: FormChange): void {
    if (change.kind === 'photo-request') {
      pendingPhotoField = change.id;
      fileInput.click();
      return;
    }
    say('');
    if (change.kind === 'party') {
      const value = clip(change.value, `[data-control="party-${change.party}"]`);
      if (change.party === 'giver') giver = value;
      else receiver = value;
    } else {
      const value = change.value === null ? null : clip(change.value, `[data-control="field-${change.id}"]`);
      values.set(change.id, value);
    }
    refresh();
    scheduleDraft();
  }

  function render(): void {
    for (const box of boxes) box.destroy();
    boxes = [];
    const sheet = renderForm(getRecord(), { mode: 'edit', template: currentTemplate(), onChange: onFormChange });
    // The seal row at the foot of the sheet: the place where the stamp comes down. Decoration only, no text.
    const sealRow = make('div', 'seal-row');
    sealRow.setAttribute('aria-hidden', 'true');
    sealRow.append(make('div', 'seal-target'));
    sheet.append(sealRow);
    formHolder.replaceChildren(sheet);
    for (const line of lines) {
      const photo = photoOf.get(line.id);
      if (photo === undefined) continue;
      const size = make('span', 'photo-size', `${photoSizeKb(photo.dataBase64)} KB`);
      formHolder.querySelector(`[data-field="${line.id}"]`)?.append(size);
    }
    for (const party of PARTIES) {
      const slot = formHolder.querySelector(`[data-signature-slot="${party}"]`) as HTMLElement | null;
      if (slot === null) continue;
      const box = createSignatureBox(slot, {
        initial: sigs.get(party),
        onLimit: () => say('The signature box is full.'),
        onChange: () => {
          const strokes = box.strokes();
          if (hasStrokes(strokes)) sigs.set(party, strokes);
          else sigs.delete(party);
          refresh();
          scheduleDraft();
        },
      });
      boxes.push(box);
    }
    refresh();
  }

  function addLine(kind: 'text' | 'photo'): void {
    if (template.id !== 'blank') return;
    if (lines.length >= MAX_LINES) {
      say('Twelve lines is the most.');
      return;
    }
    const n = lines.length + 1;
    lines.push(
      kind === 'text'
        ? { id: `line-${n}`, label: `Line ${n}`, kind: 'text', required: false }
        : { id: `line-${n}`, label: `Photo ${n}`, kind: 'photo', required: false },
    );
    say('');
    render();
    scheduleDraft();
  }

  async function addPhoto(fieldId: string, file: Blob): Promise<void> {
    const line = lines.find((l) => l.id === fieldId && l.kind === 'photo');
    if (line === undefined) return;
    if (!photoOf.has(fieldId) && photoOf.size >= MAX_PHOTOS) {
      say('Six photos is the most.');
      return;
    }
    const result = await resizePhoto(file, MAX_SIDE, MAX_BASE64, codec);
    if (!result.ok) {
      say(result.error === 'too_big' ? 'This photo is too big.' : 'This photo could not be read');
      return;
    }
    const photo = photoFromResult(result);
    for (const [id, other] of photoOf) {
      if (id !== fieldId && other.digest === photo.digest) {
        say('This photo is on the form already.');
        return;
      }
    }
    photoOf.set(fieldId, photo);
    say('');
    render();
    scheduleDraft();
  }

  addText.addEventListener('click', () => addLine('text'));
  addPhotoLine.addEventListener('click', () => addLine('photo'));
  stampButton.addEventListener('click', () => {
    if (!locked) return;
    const target = element.querySelector('[data-missing="true"]');
    (target?.querySelector('input, select, button') as HTMLElement | null | undefined)?.focus();
  });
  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    const field = pendingPhotoField;
    fileInput.value = '';
    if (file !== undefined && field !== null) void addPhoto(field, file);
  });

  render();

  return {
    element,
    stampButton,
    getRecord,
    isLocked: () => locked,
    addPhoto,
    addLine,
    destroy() {
      if (destroyed) return;
      if (draftTimer !== null) flushDraft();
      destroyed = true;
      progressWatcher.disconnect();
      for (const box of boxes) box.destroy();
      boxes = [];
    },
  };
}