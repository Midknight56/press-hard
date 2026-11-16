# Design Document

## Overview

`core/` is a TypeScript package with no dependencies and no access to the DOM, storage, network or clock. `mcp/` is a thin server over `core/` that reads copy files from disk. The form app imports `core/` and never repeats its logic.

## Architecture

```mermaid
flowchart LR
  record[Record] --> canon[canonicalText]
  canon --> sha[sha256Hex]
  sha --> seal[seal and seal words]
  record --> file[buildCopyFile: one HTML file]
  file --> parse[parseCopyFile]
  parse --> verify[verifyRecord]
  parse --> diff[diffRecords]
  verify --> tools[MCP tools verify_copy, diff_copies]
  diff --> tools
```

Files:

```
core/src/types.ts       the record types
core/src/validate.ts    validateRecord
core/src/canonical.ts   canonicalText
core/src/sha256.ts      sha256Hex
core/src/words.ts       the 256 words, sealWords
core/src/seal.ts        sealRecord, verifyRecord
core/src/copyfile.ts    buildCopyFile, parseCopyFile
core/src/diff.ts        diffRecords
core/src/index.ts       the only export file
core/tests/fixtures/    fixture records as JSON
mcp/src/server.ts       MCP wiring
mcp/src/tools.ts        the two handlers as plain functions
```

## Components and Interfaces

```ts
export type FieldKind = 'text' | 'choice' | 'number' | 'photo';
export interface Field {
  id: string;                 // lower case letters, digits and '-', unique in the record
  label: string;
  kind: FieldKind;
  value: string | null;       // text, the chosen option, a number as text with at most 3 decimal places, or null
  unit?: string;              // for kind 'number'
  options?: string[];         // for kind 'choice'
  photoDigest?: string;       // for kind 'photo': the sha256 of the photo bytes
}
export interface Photo { digest: string; mime: 'image/jpeg'; width: number; height: number; dataBase64: string }
export interface Signature { party: 'giver' | 'receiver'; strokes: number[][] } // each stroke is x0,y0,x1,y1,... with integers 0 to 1000
export interface HandoverRecord {
  format: 1;
  form: { templateId: string; title: string };
  sealedAt: string | null;    // ISO 8601 text, set when sealed
  parties: { giver: string; receiver: string };
  fields: Field[];
  photos: Photo[];
  signatures: Signature[];
  seal?: string;
}

export function validateRecord(value: unknown): string[];
export function canonicalText(record: HandoverRecord): string;        // leaves out the seal key
export function sha256Hex(bytes: Uint8Array): string;
export function sealWords(seal: string): string;
export function sealRecord(record: HandoverRecord, sealedAt: string):
  { ok: true; record: HandoverRecord } | { ok: false; problems: string[] };
export type VerifyResult = 'matches' | 'changed' | 'unsealed' | 'wrong_seal';
export function verifyRecord(record: HandoverRecord, expectedSeal?: string): VerifyResult;
export function buildCopyFile(record: HandoverRecord, options: { title: string; paper: 'top' | 'carbon' }): string;
export function parseCopyFile(text: string):
  { ok: true; record: HandoverRecord } | { ok: false; error: 'no_record' | 'bad_json' | 'bad_record'; problems?: string[] };
export interface Difference { path: string; a: string | null; b: string | null }
export function diffRecords(a: HandoverRecord, b: HandoverRecord): Difference[];
```

Tool server:

| Tool | Input | Output |
| --- | --- | --- |
| `verify_copy` | `{ path: string, expectedSeal?: string }` | `{ result, seal, sealWords, title, giver, receiver, photos, sealedAt }` |
| `diff_copies` | `{ pathA: string, pathB: string }` | `{ equal: boolean, differences: Difference[] }` |

Error codes: `not_found`, `not_a_file`, `too_large`, `no_record`, `bad_json`, `bad_record`.

## Data Models

- Canonical text: keys sorted by code unit order, no spaces, strings with `JSON.stringify`, numbers with `String(n)`, `null` as `null`. The top level `seal` key is skipped.
- A photo's `digest` is `sha256Hex` of the decoded image bytes. `validateRecord` checks it.
- Seal words: byte i of the seal (i from 0 to 3) picks word number `byte` from the list.
- Copy file layout: a `main` element with the form as plain HTML and inline CSS, one `img` for each photo with a `data:` URL, one inline SVG for each signature, then `<script id="record" type="application/json">`, then the inline check script. The check script is generated at build time from `sha256.ts` and `canonical.ts`, so the logic exists once in source.
- `diffRecords` paths: `parties.giver`, `parties.receiver`, `form.title`, `sealedAt`, `fields.<id>.value`, `fields.<id>.label`, `fields.<id>` (present on one side only), `photos.<digest>` (present on one side only), `signatures.giver`, `signatures.receiver`.

## Error Handling

- Every function that takes outside input returns a typed result. None of them throws for bad input.
- `sha256Hex` and `canonicalText` throw only when called with a value of the wrong type from our own code.
- The tool server catches any thrown error, returns an error result, and writes the stack to standard error.

## Testing Strategy

Tests are written first and seen to fail.

- `sha256.test.ts`: the two known values from requirement 3.2, the value for one million `a` characters from the public SHA-256 test vectors (`cdc76e5c9914fb9281a1c7e284d73e67f1809a48a497200e046d39ccc7112cd0`), and equality with Node's `crypto` on 300 random inputs.
- `canonical.test.ts`: key order, nested arrays, the skipped seal key.
- `seal.test.ts`: fixture `rental-return.json` seals and verifies as `matches`. Changing one character of one field gives `changed`. Sealing twice is refused.
- `words.test.ts`: 256 different words of 3 to 6 letters, and the same seal always gives the same words.
- `copyfile.test.ts`: build then parse gives a record with the same canonical text. A record whose text value is `</script><b>x` builds a file that still parses to the same record. The file text holds no `http://`, `https://` or `//` URL outside the record's own text values.
- One browser test opens a built copy file from disk in headless Chromium and reads the stamp text, for a good file and for a file with one changed character.
- `diff.test.ts`: one changed field, one removed photo, one changed signature point, and equal records.
- Tool tests call `tools.ts` directly with temporary files, then one process test lists the two tools.

## Correctness Properties

1. **Key order does not matter.** For any record, shuffling the key order of every object gives the same seal. (Requirements 2.1, 2.2)
2. **Any change breaks the seal.** For any sealed record and any single change to a field value, a label, a party name, a photo byte or a signature point, `verifyRecord` returns `changed`. (4.1, 6.1)
3. **Copy file round trip.** For any valid sealed record, `parseCopyFile(buildCopyFile(r))` returns a record with the same canonical text and `verifyRecord` returns `matches`. (5.1, 5.5)
4. **Own SHA-256 equals the platform's.** For any byte array of 0 to 5000 bytes, `sha256Hex` equals Node's `crypto` result. (3.3)
5. **Script safety.** For any text value, including one that holds `</script>`, the built copy file has exactly one element with id `record` and parses back to the same value. (5.2)
6. **Diff is exact.** `diffRecords(a, b)` is empty exactly when the canonical texts are equal, and for a single field change it has exactly one entry with that field's path. (6.3, 6.4)
7. **Words follow the seal.** Two seals with the same first four bytes give the same words, and seals that differ in one of those bytes give different words. (4.3)

## Decisions and Alternatives

- One HTML file over a zip or a JSON file. Chosen because it opens anywhere with no app. The verify page on the site also accepts it.
- An own SHA-256 inside the copy file. Chosen because a page opened from disk cannot rely on the browser's crypto API in every browser.
- Four words over a QR code. Chosen because two people can compare words by voice, and it needs no camera and no library.
- Stroke points over signature images. Chosen so that the seal does not depend on how a browser encodes an image.

## Out of Scope

- Identity checks, accounts, time stamping by a third party, and encryption of the copy file.
- Any server.
- Editing a record after sealing. A correction is a new record.
