import { sha256Hex } from './sha256.js';

export const MAX_FIELDS = 40;
export const MAX_PHOTOS = 6;
export const MAX_PHOTO_BASE64 = 1_500_000;
export const MAX_TEXT = 500;
export const MAX_POINTS = 4000;

const ID_PATTERN = /^[a-z0-9-]+$/;
const HEX64 = /^[0-9a-f]{64}$/;
const BASE64 = /^[A-Za-z0-9+/]*={0,2}$/;
const NUMBER_TEXT = /^-?(0|[1-9][0-9]*)(\.[0-9]{1,3})?$/;
const ISO_TIME = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(\.\d+)?(Z|[+-](\d{2}):(\d{2}))$/;
const KINDS = ['text', 'choice', 'number', 'photo'];

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** True for ISO 8601 date and time text with a time zone, such as 2026-11-16T10:30:00Z. */
export function isIsoTime(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const m = ISO_TIME.exec(value);
  if (m === null) return false;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > (days[month - 1] as number)) return false;
  if (Number(m[4]) > 23 || Number(m[5]) > 59 || Number(m[6]) > 59) return false;
  if (m[9] !== undefined && (Number(m[9]) > 23 || Number(m[10]) > 59)) return false;
  return true;
}

function checkText(problems: string[], path: string, value: unknown): void {
  if (typeof value !== 'string') {
    problems.push(`${path}: must be text`);
  } else if (value.length > MAX_TEXT) {
    problems.push(`${path}: text is longer than ${MAX_TEXT} characters`);
  }
}

function checkField(
  problems: string[],
  path: string,
  field: unknown,
  ids: Set<string>,
  photoDigests: Set<string>,
): void {
  if (!isObject(field)) {
    problems.push(`${path}: must be an object`);
    return;
  }
  const { id, kind, value, unit, options, photoDigest } = field;
  if (typeof id !== 'string' || !ID_PATTERN.test(id)) {
    problems.push(`${path}.id: must be lower case letters, digits and '-'`);
  } else if (ids.has(id)) {
    problems.push(`${path}.id: "${id}" is used twice`);
  } else {
    ids.add(id);
  }
  checkText(problems, `${path}.label`, field.label);
  if (typeof kind !== 'string' || !KINDS.includes(kind)) {
    problems.push(`${path}.kind: must be one of ${KINDS.join(', ')}`);
    return;
  }
  if (unit !== undefined) checkText(problems, `${path}.unit`, unit);
  let optionList: string[] | null = null;
  if (options !== undefined) {
    if (!Array.isArray(options)) {
      problems.push(`${path}.options: must be a list`);
    } else {
      optionList = [];
      options.forEach((option: unknown, i: number) => {
        checkText(problems, `${path}.options[${i}]`, option);
        if (typeof option === 'string') (optionList as string[]).push(option);
      });
    }
  }
  if (kind === 'photo') {
    if (value !== null) problems.push(`${path}.value: must be null for a photo field`);
    if (typeof photoDigest !== 'string' || !photoDigests.has(photoDigest)) {
      problems.push(`${path}.photoDigest: matches no photo in the record`);
    }
    return;
  }
  if (value === null) return;
  if (typeof value !== 'string') {
    problems.push(`${path}.value: must be text or null`);
    return;
  }
  if (value.length > MAX_TEXT) problems.push(`${path}.value: text is longer than ${MAX_TEXT} characters`);
  if (kind === 'choice' && (optionList === null || !optionList.includes(value))) {
    problems.push(`${path}.value: is not one of the options`);
  }
  if (kind === 'number' && !NUMBER_TEXT.test(value)) {
    problems.push(`${path}.value: must be a number with at most 3 decimal places`);
  }
}

function decodeBase64(text: string): Uint8Array | null {
  if (text.length % 4 !== 0 || !BASE64.test(text)) return null;
  try {
    const binary = atob(text);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

function checkPhoto(problems: string[], path: string, photo: unknown, digests: Set<string>): void {
  if (!isObject(photo)) {
    problems.push(`${path}: must be an object`);
    return;
  }
  if (photo.mime !== 'image/jpeg') problems.push(`${path}.mime: must be image/jpeg`);
  for (const key of ['width', 'height']) {
    const n = photo[key];
    if (typeof n !== 'number' || !Number.isInteger(n) || n < 1) {
      problems.push(`${path}.${key}: must be a whole number of 1 or more`);
    }
  }
  const digest = photo.digest;
  let digestOk = true;
  if (typeof digest !== 'string' || !HEX64.test(digest)) {
    problems.push(`${path}.digest: must be 64 lower case hex characters`);
    digestOk = false;
  } else if (digests.has(digest)) {
    problems.push(`${path}.digest: is used twice`);
  } else {
    digests.add(digest);
  }
  const data = photo.dataBase64;
  if (typeof data !== 'string') {
    problems.push(`${path}.dataBase64: must be text`);
  } else if (data.length > MAX_PHOTO_BASE64) {
    problems.push(`${path}.dataBase64: is longer than ${MAX_PHOTO_BASE64} characters`);
  } else {
    const bytes = decodeBase64(data);
    if (bytes === null) {
      problems.push(`${path}.dataBase64: is not base64`);
    } else if (digestOk && sha256Hex(bytes) !== digest) {
      problems.push(`${path}.digest: is not the SHA-256 of the photo bytes`);
    }
  }
}

function checkSignature(problems: string[], path: string, signature: unknown, parties: Set<string>): void {
  if (!isObject(signature)) {
    problems.push(`${path}: must be an object`);
    return;
  }
  const party = signature.party;
  if (party !== 'giver' && party !== 'receiver') {
    problems.push(`${path}.party: must be giver or receiver`);
  } else if (parties.has(party)) {
    problems.push(`${path}.party: ${party} has more than one signature`);
  } else {
    parties.add(party);
  }
  const strokes = signature.strokes;
  if (!Array.isArray(strokes)) {
    problems.push(`${path}.strokes: must be a list`);
    return;
  }
  let points = 0;
  strokes.forEach((stroke: unknown, s: number) => {
    const strokePath = `${path}.strokes[${s}]`;
    if (!Array.isArray(stroke)) {
      problems.push(`${strokePath}: must be a list of numbers`);
      return;
    }
    if (stroke.length % 2 !== 0) problems.push(`${strokePath}: has an odd count of numbers`);
    points += Math.floor(stroke.length / 2);
    // A bad number is reported once for each stroke at most 5 times, to keep the list short.
    let reported = 0;
    stroke.forEach((n: unknown, i: number) => {
      if (typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= 1000) return;
      if (reported++ < 5) problems.push(`${strokePath}[${i}]: must be a whole number from 0 to 1000`);
    });
  });
  if (points > MAX_POINTS) {
    problems.push(`${path}.strokes: has ${points} points, more than ${MAX_POINTS}`);
  }
}

/** Returns a list of problems that name the path of each bad value. An empty list means a good record. */
export function validateRecord(value: unknown): string[] {
  const problems: string[] = [];
  if (!isObject(value)) return ['record: must be an object'];

  if (value.format !== 1) problems.push('format: must be 1');

  const form = value.form;
  if (!isObject(form)) {
    problems.push('form: must be an object');
  } else {
    checkText(problems, 'form.templateId', form.templateId);
    checkText(problems, 'form.title', form.title);
  }

  if (value.sealedAt !== null && !isIsoTime(value.sealedAt)) {
    problems.push('sealedAt: must be null or ISO 8601 text');
  }

  const parties = value.parties;
  if (!isObject(parties)) {
    problems.push('parties: must be an object');
  } else {
    checkText(problems, 'parties.giver', parties.giver);
    checkText(problems, 'parties.receiver', parties.receiver);
  }

  // Photos first, so that photo fields can be matched against their digests.
  const photoDigests = new Set<string>();
  const photos = value.photos;
  if (!Array.isArray(photos)) {
    problems.push('photos: must be a list');
  } else {
    if (photos.length > MAX_PHOTOS) problems.push(`photos: has ${photos.length} photos, more than ${MAX_PHOTOS}`);
    photos.forEach((photo: unknown, i: number) => checkPhoto(problems, `photos[${i}]`, photo, photoDigests));
  }

  const fields = value.fields;
  if (!Array.isArray(fields)) {
    problems.push('fields: must be a list');
  } else {
    if (fields.length > MAX_FIELDS) problems.push(`fields: has ${fields.length} fields, more than ${MAX_FIELDS}`);
    const ids = new Set<string>();
    fields.forEach((field: unknown, i: number) => checkField(problems, `fields[${i}]`, field, ids, photoDigests));
  }

  const signatures = value.signatures;
  if (!Array.isArray(signatures)) {
    problems.push('signatures: must be a list');
  } else {
    const seen = new Set<string>();
    signatures.forEach((signature: unknown, i: number) =>
      checkSignature(problems, `signatures[${i}]`, signature, seen),
    );
  }

  if (value.seal !== undefined && (typeof value.seal !== 'string' || !HEX64.test(value.seal))) {
    problems.push('seal: must be 64 lower case hex characters');
  }

  return problems;
}
