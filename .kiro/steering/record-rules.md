---
inclusion: fileMatch
fileMatchPattern: ["core/**", "mcp/**"]
---
# Record rules

These rules apply to `core/` and `mcp/`.

## Pure core
- `core/` has no dependency outside the TypeScript standard library and uses no DOM, no storage, no network, no `Date` and no `Math.random`.
- The time of sealing is passed in as text by the caller. The core never reads a clock.
- Every function in `core/` returns a typed result for bad input. It throws only for a programming mistake.

## Canonical text
- The seal is computed over the canonical text of the record: object keys sorted by code unit order, no spaces, numbers written with `String(n)`, strings with `JSON.stringify`, arrays in their order.
- The `seal` field itself is never part of the text that is sealed.
- A number in a record is a finite integer, or a finite decimal with at most 3 places stored as a string. `NaN` and `Infinity` are refused.

## Seal
- The seal is the SHA-256 of the UTF-8 bytes of the canonical text, as 64 lower case hex characters.
- The seal words are the words at the first 4 bytes of the seal in `core/src/words.ts`, joined with `-`.
- The word list has exactly 256 different lower case English words of 3 to 6 letters. A test checks the count and that no word repeats.

## Copy file
- A copy file is one HTML document that holds the record as JSON in a `script` element with id `record` and type `application/json`.
- The check script inside a copy file is built from `core/src/sha256.ts` and `core/src/canonical.ts`. It is never written by hand a second time.
- `<` inside the embedded JSON is written as the six characters backslash, `u`, `0`, `0`, `3`, `c` (the JSON escape `\u003c`), so that no text in a record can end the script element.

## Tests come first
- Write the failing test before the code. Run it and see it fail.
- Every bug becomes a fixture record under `core/tests/fixtures/` and a test.
