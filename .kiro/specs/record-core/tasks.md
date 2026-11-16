# Implementation Plan

- [ ] 1. Scaffold the workspace
  - Create the root `package.json` with npm workspaces for `core`, `mcp` and `app`, a base `tsconfig.json` with `strict` on, Vitest, fast-check and ESLint. Pin each version and write each licence in the log.
  - Add the root scripts `typecheck`, `lint`, `test`, `e2e`, `verify` and `build`. `e2e` and `build` print `not built yet` and exit 0 until the `counter-app` spec replaces them.
  - Add `LICENSE` (MIT), `README.md` with three lines, `.gitignore` for `node_modules` and `dist`, and `docs/kiro-log.md` from the log template. Do not ignore `.kiro`.
  - Add an ESLint rule block that forbids `Date`, `Math.random`, `window`, `document`, `fetch` and `localStorage` in `core/`.
  - Verify: `npm run verify` exits 0. Save one TypeScript file and end one turn, and write in the log whether `typecheck-on-save` and `verify-on-stop` fired.
  - _Requirements: 3.1_

- [ ] 2. Types and fixtures
  - Create `core/src/types.ts` as in the design.
  - Write three fixture records under `core/tests/fixtures/`: `rental-return.json` (8 fields, 2 small photos, 2 signatures), `key-handover.json` (5 fields, no photo) and `sold-as-seen.json` (6 fields, 1 photo). Use made up names and a 16 by 16 px JPEG for each photo.
  - Verify: `npm run typecheck` passes.
  - _Requirements: 1.1_

- [ ] 3. SHA-256
  - Write `sha256.test.ts` first with the three known values and the comparison with Node's `crypto`. See it fail.
  - Implement `sha256.ts` with no dependency.
  - Verify: `npm test -- sha256` passes.
  - _Requirements: 3.1, 3.2, 3.3_

- [ ] 4. Canonical text
  - Write `canonical.test.ts` first. See it fail.
  - Implement `canonical.ts`.
  - Verify: `npm test -- canonical` passes.
  - _Requirements: 2.1, 2.2, 2.3_

- [ ] 5. Record check
  - Write `validate.test.ts` first: the three fixtures have no problem, and one test for each limit and each refusal in requirements 1.3 and 1.4. See it fail.
  - Implement `validate.ts`.
  - Verify: `npm test -- validate` passes.
  - _Requirements: 1.2, 1.3, 1.4_

- [ ] 6. Seal and seal words
  - Write `words.test.ts` and `seal.test.ts` first. See them fail.
  - Write the list of 256 words in `words.ts`. Implement `sealWords`, `sealRecord` and `verifyRecord`.
  - Verify: `npm test -- words seal` passes.
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 6.1, 6.2_

- [ ] 7. Copy file
  - Write `copyfile.test.ts` first, with the `</script>` case and the no network check. See it fail.
  - Implement `buildCopyFile` and `parseCopyFile`. Generate the inline check script from `sha256.ts` and `canonical.ts` with a small build step, so that the logic exists once.
  - Add a test that runs the inline check script of a built copy file inside Node with a small fake `document`, for a good file and for a file with one changed character, and reads the stamp text. The real browser check of the same thing is in the `counter-app` path tests.
  - Verify: `npm test -- copyfile` passes.
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [ ] 8. Compare
  - Write `diff.test.ts` first. See it fail.
  - Implement `diffRecords` with the paths from the design.
  - Verify: `npm test -- diff` passes.
  - _Requirements: 6.3, 6.4_

- [ ] 9. Properties
  - Write `properties.test.ts` with the seven properties from the design, using fast-check record generators with at most 6 fields and photos of at most 64 bytes.
  - Fix every failure in the code, never in the property.
  - Verify: `npm test -- properties` passes in under 60 seconds.
  - _Requirements: 2.2, 3.3, 4.3, 5.2, 5.5, 6.1, 6.4_

- [ ] 10. Property tests from the spec
  - In the Kiro IDE, open this spec and use the spec correctness feature to generate property tests from the acceptance criteria.
  - Keep each generated property that checks something new in `core/src/spec-properties.test.ts`. Remove none of the seven.
  - Write in the log which properties were added and any failure they found.
  - Verify: `npm test` passes.
  - _Requirements: 2.2, 4.1, 5.5, 6.1_

- [ ] 11. Tool handlers
  - Create `mcp/` and add the official Model Context Protocol TypeScript SDK to it only. Read its README for the server and stdio transport calls. Write the package name, version and licence in the log.
  - Write `mcp/src/tools.test.ts` first for both tools and for each error code, with temporary files. See it fail.
  - Implement `tools.ts`.
  - Verify: `npm test -- tools` passes.
  - _Requirements: 7.2, 7.3, 7.4, 7.5_

- [ ] 12. Tool server
  - Implement `mcp/src/server.ts` and a process test that lists the two tools.
  - Set the `copycheck` server in `.kiro/settings/mcp.json` to `"disabled": false`.
  - Verify: `npm run build` for `mcp`, then `npm test -- server.process` passes.
  - _Requirements: 7.1_

- [ ] 13. Kiro checks a copy
  - Build two copy files from `rental-return.json` with a small script: one good, one with the mileage field changed after sealing.
  - In a Kiro session, call `verify_copy` on both and `diff_copies` on the pair. Copy the tool calls and answers into the log.
  - Verify: the log shows `matches` for the first file, `changed` for the second, and one difference with the path of the changed field.
  - _Requirements: 7.2, 7.3_

- [ ] 14. Export file and log
  - Create `core/src/index.ts` as the only export file. Add the log rows for this spec with the credits used.
  - Verify: `npm run verify` passes.
  - _Requirements: 1.1_
