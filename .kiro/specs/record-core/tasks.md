# Implementation Plan

After each finished task, add one row to `docs/kiro-log.md` on the same day. Leave the Credits cell empty. The owner fills it.

This spec owns `core/`, `mcp/`, the root files and `docs/kiro-log.md`. It does not create or edit anything in `app/`, `e2e/` or `site/`, which belong to the `counter-app` spec.

- [x] 1. Scaffold the workspace
  - Create the root `package.json` with npm workspaces for `core` and `mcp` only, a base `tsconfig.json` with `strict` on, Vitest, fast-check and ESLint. The `counter-app` spec adds `app` to the workspaces when it creates that folder. Pin each version and write each licence in the log. Set `"version": "0.1.0"` and `"private": true` in each `package.json`.
  - Create `core/package.json` and `core/tsconfig.json` as in the design (ES module, `exports` to `dist/index.js`, scripts `build`, `prebuild`, `pretest`).
  - Add the root scripts `typecheck`, `lint`, `test`, `e2e`, `verify` and `build`. `e2e` and `build` print `not built yet` and exit 0 until the `counter-app` spec replaces them.
  - Add `LICENSE` (MIT), `README.md` with three lines and `.gitignore` for `node_modules`, `dist`, `core/src/generated` and `mcp/demo`. Do not ignore `.kiro`. `docs/kiro-log.md` already exists, so keep it.
  - Add an ESLint rule block for `core/src/` only that forbids `Date`, `Math.random`, `window`, `document`, `fetch` and `localStorage`.
  - Verify: `npm run verify` exits 0. Save one TypeScript file and end one turn, and write in the log whether `typecheck-on-save` and `verify-on-stop` fired, or that they did not fire or were not tried.
  - _Requirements: 3.1_

- [ ] 2. Types, index and fixtures
  - Create `core/src/types.ts` as in the design. Create `core/src/index.ts`, the only export file, with the type exports. Each later task adds the exports of what it builds.
  - Write three unsealed fixture records (`sealedAt` null, no `seal`) under `core/tests/fixtures/`: `rental-return.json` (8 fields, of which 2 are `photo` fields, 1 is a `number` field with id `mileage`, plus 2 photos and 2 signatures), `key-handover.json` (5 fields, no photo) and `sold-as-seen.json` (6 fields, of which 1 is a `photo` field, plus 1 photo). Give each fixture both signatures. Use made up names. Make each photo a 16 by 16 px JPEG original to this repository, with `digest` set to the real SHA-256 of its bytes.
  - Verify: `npm run typecheck` passes.
  - _Requirements: 1.1_

- [ ] 3. SHA-256
  - Write `core/tests/sha256.test.ts` first with the three known values, the block edge lengths and the comparison with Node's `crypto`. See it fail.
  - Implement `sha256.ts` with no dependency. Export it from `index.ts`.
  - Verify: `npm test -- sha256` passes.
  - _Requirements: 3.1, 3.2, 3.3_

- [ ] 4. Canonical text
  - Write `core/tests/canonical.test.ts` first. See it fail.
  - Implement `canonical.ts`. Export it from `index.ts`.
  - Verify: `npm test -- canonical` passes.
  - _Requirements: 2.1, 2.2, 2.3_

- [ ] 5. Record check
  - Write `core/tests/validate.test.ts` first: the three fixtures have no problem, and for each limit in requirement 1.3 one test at the limit and one test one over it, and one test for each refusal in requirements 1.4 and 1.5. See it fail.
  - Implement `validate.ts`. Export it from `index.ts`.
  - Verify: `npm test -- validate` passes.
  - _Requirements: 1.2, 1.3, 1.4, 1.5_

- [ ] 6. Seal and seal words
  - Write `core/tests/words.test.ts` and `core/tests/seal.test.ts` first, with the `unsealed`, `wrong_seal` and `changed` cases from the design. See them fail.
  - Write the list of 256 words in `words.ts`. Implement `sealWords`, `sealRecord` and `verifyRecord`. Export them from `index.ts`.
  - Verify: `npm test -- words seal` passes.
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 6.1, 6.2_

- [ ] 7. Copy file
  - Write `core/tests/copyfile.test.ts` first, with the `</script>` case, the `bad_record` case and the no network check from the design. See it fail.
  - Write `core/scripts/gen-check.ts` and wire it as `pretest` and `prebuild` of `core`. Implement `buildCopyFile` and `parseCopyFile`, so that the check logic exists once. Export them from `index.ts`.
  - Add a test that runs the inline check script of a built copy file inside Node with a small fake `document`, for a good file and for a file with one changed character, and reads the `stamp` text. Say in the log that the real browser check of the same thing is in task 9 of the `counter-app` spec and has not run yet.
  - Verify: `npm test -- copyfile` passes.
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [ ] 8. Compare
  - Write `core/tests/diff.test.ts` first. See it fail.
  - Implement `diffRecords` with the paths from the design. Export it from `index.ts`.
  - Verify: `npm test -- diff` passes.
  - _Requirements: 6.3, 6.4_

- [ ] 9. Properties
  - Write `core/tests/properties.test.ts` with the seven properties from the design, using fast-check record generators with at most 6 fields and photos of at most 64 bytes. The generators set each photo digest to the real SHA-256 of its bytes.
  - Fix every failure in the code, never in the property.
  - Verify: `npm test -- properties` passes. Write the run time in the log. 60 seconds is the target.
  - _Requirements: 2.1, 2.2, 3.3, 4.1, 4.3, 5.2, 5.5, 6.1, 6.4_

- [ ] 10. Property tests from the spec
  - In the Kiro IDE, open this spec and use the spec correctness feature to generate property tests from the acceptance criteria. If the feature is not available or is not run, write that in the log and stop this task.
  - Keep each generated property that checks something new in `core/tests/spec-properties.test.ts`. Remove none of the seven.
  - Write in the log which properties were added and any failure they found.
  - Verify: `npm test` passes.
  - _Requirements: 2.2, 4.1, 5.5, 6.1_

- [ ] 11. Tool handlers
  - Create `mcp/` with its `package.json` and `tsconfig.json` as in the design, and add the official Model Context Protocol TypeScript SDK to it only. Read its README for the server and stdio transport calls. Write the package name, version and licence in the log.
  - Write `mcp/tests/tools.test.ts` first for both tools, for each error code, and for the rule that no file is written (the temporary folder holds the same files and times after each call). See it fail.
  - Implement `tools.ts`.
  - Verify: `npm test -- tools` passes.
  - _Requirements: 7.2, 7.3, 7.4, 7.5_

- [ ] 12. Tool server
  - Implement `mcp/src/server.ts` and `mcp/tests/server.process.test.ts`, a process test that lists the two tools.
  - Set the `copycheck` server in `.kiro/settings/mcp.json` to `"disabled": false`.
  - Verify: `npm run build --workspace mcp` (not the root `build`, which stays a placeholder here), then `npm test -- server.process` passes.
  - _Requirements: 7.1_

- [ ] 13. Kiro checks a copy
  - Write `mcp/scripts/make-demo-copies.ts`. It builds two copy files from `rental-return.json` into `mcp/demo/`: one good, and one with the `mileage` field text changed after sealing, without a new seal.
  - In a Kiro session, call `verify_copy` on both and `diff_copies` on the pair. Paste the real tool calls and answers into the "Tool door transcripts" section of the log, with the date. If no session was run, write that.
  - Verify: the log shows `changed` for the second file, `matches` for the first, and one difference with the path `fields.mileage.value`.
  - _Requirements: 7.2, 7.3_

- [ ] 14. Export check
  - Check that `core/src/index.ts` exports every function and type in the design and nothing else.
  - Verify: `npm run verify` passes.
  - _Requirements: 1.1_
