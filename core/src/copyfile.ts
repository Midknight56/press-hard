import { CHECK_LIB } from './generated/check-script.js';
import { changedLines, readLineMarks, writeLineMarks } from './lines.js';
import { sealWords } from './seal.js';
import type { Field, HandoverRecord, Photo, Signature } from './types.js';
import { validateRecord } from './validate.js';

const RECORD_OPEN = '<script id="record" type="application/json">';
const SCRIPT_CLOSE = '</script>';
const MARKS_OPEN = '<main data-lines="';

const TEXT_MATCHES = 'Seal matches this copy';
const TEXT_CHANGED = 'This copy was changed after sealing';
const TEXT_NOT_CHECKED = 'This copy has not been checked. Open it in a browser with scripts on.';

const escapeHtml = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/** JSON for the record element. Every < becomes \u003c, so no text can end the script element. */
const embeddedJson = (record: HandoverRecord): string => JSON.stringify(record).replace(/</g, '\\u003c');

// The part of the check script that reads the record element and writes the stamp text.
// The sha256Hex and canonicalText functions come from CHECK_LIB, built from the sources.
const checkScript = (): string =>
  [
    '(function () {',
    CHECK_LIB,
    "var stamp = document.getElementById('stamp');",
    'var ok = false;',
    'try {',
    "  var record = JSON.parse(document.getElementById('record').textContent);",
    '  var seal = sha256Hex(new TextEncoder().encode(canonicalText(record)));',
    "  ok = typeof record.seal === 'string' && record.seal === seal;",
    '} catch (e) {',
    '  ok = false;',
    '}',
    `stamp.textContent = ok ? ${JSON.stringify(TEXT_MATCHES)} : ${JSON.stringify(TEXT_CHANGED)};`,
    "stamp.className = ok ? 'ok' : 'bad';",
    '})();',
  ].join('\n');

const CSS = `
* { box-sizing: border-box; }
body { margin: 0; padding: 16px; font-family: system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; line-height: 1.4; }
body.paper-top { background: #ece8df; color: #1c1b19; }
body.paper-carbon { background: #dbe3f2; color: #14213d; }
main { max-width: 640px; margin: 0 auto; padding: 20px; border: 1px solid #8a857a; }
.paper-top main { background: #fffdf8; }
.paper-carbon main { background: #eef2fb; border-color: #5a6b94; }
h1 { margin: 0 0 4px; font-size: 1.4rem; }
h2 { margin: 20px 0 6px; font-size: 1.05rem; }
.meta { margin: 0 0 12px; color: #55524a; }
dl { margin: 0; }
dt { margin-top: 10px; font-weight: 600; }
dd { margin: 2px 0 0; overflow-wrap: anywhere; }
.empty { color: #77736a; }
img { display: block; max-width: 100%; height: auto; border: 1px solid #8a857a; }
figure { margin: 8px 0; }
figcaption { font-size: 0.9rem; color: #55524a; }
svg { display: block; width: 100%; max-width: 320px; height: auto; aspect-ratio: 1 / 1; border-bottom: 1px solid #8a857a; }
.seal { margin-top: 20px; padding: 12px; border: 2px solid currentColor; }
.words { margin: 0; font-size: 1.3rem; font-weight: 700; overflow-wrap: anywhere; }
.hash { margin: 6px 0 0; font-family: ui-monospace, Consolas, monospace; font-size: 0.85rem; overflow-wrap: anywhere; }
#stamp { margin: 10px 0 0; font-weight: 700; }
#stamp.ok { color: #14602e; }
#stamp.bad { color: #9b1c1c; }
`;

function renderPhoto(photo: Photo, alt: string): string {
  return (
    `<figure><img src="data:image/jpeg;base64,${photo.dataBase64}" alt="${escapeHtml(alt)}"` +
    ` width="${photo.width}" height="${photo.height}"><figcaption>${escapeHtml(alt)}</figcaption></figure>`
  );
}

function renderSignature(signature: Signature, name: string): string {
  const shapes = signature.strokes
    .map((stroke) => {
      if (stroke.length === 2) {
        return `<circle cx="${stroke[0]}" cy="${stroke[1]}" r="4" fill="currentColor"/>`;
      }
      const points: string[] = [];
      for (let i = 0; i + 1 < stroke.length; i += 2) points.push(`${stroke[i]},${stroke[i + 1]}`);
      return `<polyline points="${points.join(' ')}" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>`;
    })
    .join('');
  const who = signature.party === 'giver' ? 'Giver' : 'Receiver';
  const label = `${who}: ${name}`;
  return (
    `<figure><svg viewBox="0 0 1000 1000" role="img" aria-label="${escapeHtml('Signature of ' + label)}">${shapes}</svg>` +
    `<figcaption>${escapeHtml(label)}</figcaption></figure>`
  );
}

function renderField(field: Field, photos: Photo[], shown: Set<string>): string {
  const label = `<dt>${escapeHtml(field.label)}</dt>`;
  if (field.kind === 'photo') {
    const photo = photos.find((p) => p.digest === field.photoDigest);
    if (photo === undefined) return `${label}<dd class="empty">No photo</dd>`;
    if (shown.has(photo.digest)) return `${label}<dd>Same photo as shown above</dd>`;
    shown.add(photo.digest);
    return `${label}<dd>${renderPhoto(photo, field.label)}</dd>`;
  }
  if (field.value === null || field.value === '') return `${label}<dd class="empty">Not filled</dd>`;
  const unit = field.kind === 'number' && field.unit ? ` ${field.unit}` : '';
  return `${label}<dd>${escapeHtml(field.value + unit)}</dd>`;
}

/** Builds the text of one HTML file. Takes a sealed, valid record. Throws for anything else, which is a mistake of the caller. */
export function buildCopyFile(record: HandoverRecord, options: { title: string; paper: 'top' | 'carbon' }): string {
  const problems = validateRecord(record);
  if (problems.length > 0) throw new TypeError(`buildCopyFile: the record is not valid: ${problems.join('; ')}`);
  if (record.seal === undefined || record.sealedAt === null) {
    throw new TypeError('buildCopyFile: the record is not sealed');
  }

  const shown = new Set<string>();
  const fields = record.fields.map((field) => renderField(field, record.photos, shown)).join('\n');
  const otherPhotos = record.photos
    .filter((photo) => !shown.has(photo.digest))
    .map((photo, i) => renderPhoto(photo, `Photo ${i + 1}`))
    .join('\n');
  const signatures = record.signatures
    .map((signature) => renderSignature(signature, record.parties[signature.party]))
    .join('\n');

  return [
    '<!DOCTYPE html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${escapeHtml(options.title)}</title>`,
    `<style>${CSS}</style>`,
    '</head>',
    `<body class="paper-${options.paper}">`,
    `${MARKS_OPEN}${writeLineMarks(record)}">`,
    `<h1>${escapeHtml(record.form.title)}</h1>`,
    `<p class="meta">${options.paper === 'top' ? 'Top copy' : 'Carbon copy'}. Sealed at ${escapeHtml(record.sealedAt)}.</p>`,
    '<h2>People</h2>',
    `<dl><dt>Giver</dt><dd>${escapeHtml(record.parties.giver)}</dd><dt>Receiver</dt><dd>${escapeHtml(record.parties.receiver)}</dd></dl>`,
    '<h2>Form</h2>',
    `<dl>${fields}</dl>`,
    otherPhotos === '' ? '' : `<h2>Photos</h2>\n${otherPhotos}`,
    '<h2>Signatures</h2>',
    signatures,
    '<div class="seal">',
    '<h2>Seal</h2>',
    `<p class="words">${escapeHtml(sealWords(record.seal))}</p>`,
    `<p class="hash">${escapeHtml(record.seal)}</p>`,
    `<p id="stamp">${escapeHtml(TEXT_NOT_CHECKED)}</p>`,
    '</div>',
    '</main>',
    `${RECORD_OPEN}${embeddedJson(record)}${SCRIPT_CLOSE}`,
    `<script>${checkScript()}${SCRIPT_CLOSE}`,
    '</body>',
    '</html>',
    '',
  ]
    .filter((line, i, all) => line !== '' || i === all.length - 1)
    .join('\n');
}

export function parseCopyFile(
  text: string,
): { ok: true; record: HandoverRecord } | { ok: false; error: 'no_record' | 'bad_json' | 'bad_record'; problems?: string[] } {
  if (typeof text !== 'string') return { ok: false, error: 'no_record' };
  const open = text.indexOf(RECORD_OPEN);
  if (open < 0) return { ok: false, error: 'no_record' };
  const start = open + RECORD_OPEN.length;
  const end = text.indexOf(SCRIPT_CLOSE, start);
  if (end < 0) return { ok: false, error: 'no_record' };
  let value: unknown;
  try {
    value = JSON.parse(text.slice(start, end));
  } catch {
    return { ok: false, error: 'bad_json' };
  }
  const problems = validateRecord(value);
  if (problems.length > 0) return { ok: false, error: 'bad_record', problems };
  return { ok: true, record: value as HandoverRecord };
}

/**
 * The lines of a copy file that no longer match its line marks, in form order, then removed lines.
 * Takes the text of the file and the record that parseCopyFile read from it. Gives an empty list
 * when every line matches, and null when the file has no readable marks (a copy made before them).
 */
export function findChangedLines(text: string, record: HandoverRecord): string[] | null {
  if (typeof text !== 'string') return null;
  const open = text.indexOf(RECORD_OPEN);
  const marksAt = open < 0 ? -1 : text.lastIndexOf(MARKS_OPEN, open);
  if (marksAt < 0) return null;
  const from = marksAt + MARKS_OPEN.length;
  const marksEnd = text.indexOf('"', from);
  const marks = marksEnd < 0 ? null : readLineMarks(text.slice(from, marksEnd));
  return marks === null ? null : changedLines(record, marks);
}
