import { canonicalText } from './canonical.js';
import { sha256Hex } from './sha256.js';
import type { Difference, Field, HandoverRecord, Photo, Signature } from './types.js';

const utf8Hash = (text: string): string => sha256Hex(new TextEncoder().encode(text));

/** Text for a value, or null when there is no value. */
const asText = (value: unknown): string | null => {
  if (value === undefined || value === null) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  return canonicalText(value as HandoverRecord);
};

/** Canonical text of a part of a record. These parts have no `seal` key, so the top level rule changes nothing. */
const partText = (part: unknown): string => canonicalText(part as HandoverRecord);

function sameOrder(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((item, i) => item === b[i]);
}

/** Pushes `path` when the two values differ. */
function compare(out: Difference[], path: string, a: string | null, b: string | null): void {
  if (a !== b) out.push({ path, a, b });
}

function diffFields(out: Difference[], a: Field[], b: Field[]): void {
  const inB = new Map(b.map((f) => [f.id, f]));
  const inA = new Map(a.map((f) => [f.id, f]));
  for (const fa of a) {
    const fb = inB.get(fa.id);
    if (fb === undefined) {
      out.push({ path: `fields.${fa.id}`, a: partText(fa), b: null });
      continue;
    }
    const base = `fields.${fa.id}`;
    compare(out, `${base}.value`, asText(fa.value), asText(fb.value));
    compare(out, `${base}.label`, asText(fa.label), asText(fb.label));
    compare(out, `${base}.kind`, asText(fa.kind), asText(fb.kind));
    compare(out, `${base}.unit`, asText(fa.unit), asText(fb.unit));
    compare(out, `${base}.options`, asText(fa.options), asText(fb.options));
    compare(out, `${base}.photoDigest`, asText(fa.photoDigest), asText(fb.photoDigest));
  }
  for (const fb of b) {
    if (!inA.has(fb.id)) out.push({ path: `fields.${fb.id}`, a: null, b: partText(fb) });
  }
  const idsA = a.map((f) => f.id);
  const idsB = b.map((f) => f.id);
  const sameSet = idsA.length === idsB.length && idsA.every((id) => inB.has(id));
  if (sameSet && !sameOrder(idsA, idsB)) out.push({ path: 'fields.order', a: idsA.join(','), b: idsB.join(',') });
}

function diffPhotos(out: Difference[], a: Photo[], b: Photo[]): void {
  const inB = new Map(b.map((p) => [p.digest, p]));
  const inA = new Map(a.map((p) => [p.digest, p]));
  for (const pa of a) {
    const pb = inB.get(pa.digest);
    if (pb === undefined) {
      out.push({ path: `photos.${pa.digest}`, a: pa.digest, b: null });
      continue;
    }
    const base = `photos.${pa.digest}`;
    compare(out, `${base}.mime`, asText(pa.mime), asText(pb.mime));
    compare(out, `${base}.width`, asText(pa.width), asText(pb.width));
    compare(out, `${base}.height`, asText(pa.height), asText(pb.height));
    // The image data is never shown, only the SHA-256 of its text.
    const dataA = typeof pa.dataBase64 === 'string' ? utf8Hash(pa.dataBase64) : null;
    const dataB = typeof pb.dataBase64 === 'string' ? utf8Hash(pb.dataBase64) : null;
    compare(out, `${base}.dataBase64`, dataA, dataB);
  }
  for (const pb of b) {
    if (!inA.has(pb.digest)) out.push({ path: `photos.${pb.digest}`, a: null, b: pb.digest });
  }
  const digestsA = a.map((p) => p.digest);
  const digestsB = b.map((p) => p.digest);
  const sameSet = digestsA.length === digestsB.length && digestsA.every((d) => inB.has(d));
  if (sameSet && !sameOrder(digestsA, digestsB)) {
    out.push({ path: 'photos.order', a: digestsA.join(','), b: digestsB.join(',') });
  }
}

function diffSignatures(out: Difference[], a: Signature[], b: Signature[]): void {
  const strokeHash = (s: Signature | undefined): string | null =>
    s === undefined ? null : utf8Hash(asText(s.strokes) ?? 'null');
  const inB = new Map(b.map((s) => [s.party, s]));
  const inA = new Map(a.map((s) => [s.party, s]));
  for (const sa of a) compare(out, `signatures.${sa.party}`, strokeHash(sa), strokeHash(inB.get(sa.party)));
  for (const sb of b) {
    if (!inA.has(sb.party)) out.push({ path: `signatures.${sb.party}`, a: null, b: strokeHash(sb) });
  }
  const partiesA = a.map((s) => s.party);
  const partiesB = b.map((s) => s.party);
  const sameSet = partiesA.length === partiesB.length && partiesA.every((p) => inB.has(p));
  if (sameSet && !sameOrder(partiesA, partiesB)) {
    out.push({ path: 'signatures.order', a: partiesA.join(','), b: partiesB.join(',') });
  }
}

/** Lists what differs between two records that passed validateRecord. The seal is not compared. */
export function diffRecords(a: HandoverRecord, b: HandoverRecord): Difference[] {
  const out: Difference[] = [];
  compare(out, 'format', asText(a.format), asText(b.format));
  compare(out, 'form.templateId', asText(a.form.templateId), asText(b.form.templateId));
  compare(out, 'form.title', asText(a.form.title), asText(b.form.title));
  compare(out, 'sealedAt', asText(a.sealedAt), asText(b.sealedAt));
  compare(out, 'parties.giver', asText(a.parties.giver), asText(b.parties.giver));
  compare(out, 'parties.receiver', asText(a.parties.receiver), asText(b.parties.receiver));
  diffFields(out, a.fields, b.fields);
  diffPhotos(out, a.photos, b.photos);
  diffSignatures(out, a.signatures, b.signatures);

  // A difference that no path above names (an extra key, or undefined against null) must not
  // give an empty list, because the list is empty exactly when the canonical texts are equal.
  if (out.length === 0) {
    const textA = canonicalText(a);
    const textB = canonicalText(b);
    if (textA !== textB) out.push({ path: 'record', a: utf8Hash(textA), b: utf8Hash(textB) });
  }
  return out;
}
