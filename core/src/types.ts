export type FieldKind = 'text' | 'choice' | 'number' | 'photo';

export interface Field {
  /** Lower case letters, digits and '-', unique in the record. */
  id: string;
  label: string;
  kind: FieldKind;
  /** Text, the chosen option, a number as text with at most 3 decimal places, or null (always null for kind 'photo'). */
  value: string | null;
  /** For kind 'number'. */
  unit?: string;
  /** For kind 'choice'. */
  options?: string[];
  /** For kind 'photo': the sha256 of the photo bytes. */
  photoDigest?: string;
}

export interface Photo {
  digest: string;
  mime: 'image/jpeg';
  width: number;
  height: number;
  dataBase64: string;
}

/** Each stroke is x0,y0,x1,y1,... with integers 0 to 1000. A point is one x,y pair. */
export interface Signature {
  party: 'giver' | 'receiver';
  strokes: number[][];
}

export interface HandoverRecord {
  format: 1;
  form: { templateId: string; title: string };
  /** ISO 8601 text, set when sealed. */
  sealedAt: string | null;
  parties: { giver: string; receiver: string };
  fields: Field[];
  photos: Photo[];
  /** At most one for each party. */
  signatures: Signature[];
  /** 64 lower case hex characters. */
  seal?: string;
}

export type VerifyResult = 'matches' | 'changed' | 'unsealed' | 'wrong_seal';

export interface Difference {
  path: string;
  a: string | null;
  b: string | null;
}
