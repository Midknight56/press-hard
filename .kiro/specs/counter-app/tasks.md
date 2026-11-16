# Implementation Plan

After each finished task, add one row to `docs/kiro-log.md` on the same day. Leave the Credits cell empty. The owner fills it.

This spec owns `app/`, `e2e/` and `site/`. It reads `core/` only through its exports and edits no file there. It also makes these changes in the root files that the `record-core` spec owns, and no others: add `app` to the workspaces list and add Playwright to the root dev dependencies (task 1), replace the root `e2e` script and add `verify:e2e` (task 9), and replace the root `build` script (task 12). It adds rows to `docs/kiro-log.md`. No test here reads a file under `core/tests/` or `mcp/`.

Write every file as UTF-8 with no byte order mark and with LF line endings. On Windows, do not write files with PowerShell `Set-Content` or `Out-File`.

- [ ] 1. Scaffold the app and the first failing tests
  - Create `app/` with `package.json` (`"version": "0.1.0"`, `"private": true`), `tsconfig.json` and `app/app.config.ts` holding the product title, add `app` to the root workspaces list, Vite and the DOM test environment for Vitest. Add Playwright at the root for `e2e/`, headless only. Write each licence in the log.
  - Write `templates.test.ts`, `stamp.test.ts` and `store.test.ts` from the design. Run them and see them fail.
  - Verify: the three test files run and fail because the code does not exist yet. `npm run typecheck` is not required here, because the tests import code that does not exist.
  - _Requirements: 1.2, 3.1, 3.2_

- [ ] 2. Templates and the sample
  - Write the four templates and `sample.ts`, a filled rental return with made up names, two small original photos and two signatures. Each form starts with the giver name and receiver name lines.
  - Verify: `npm test -- templates` passes, and `validateRecord` from `core/` reports no problem for the sample.
  - _Requirements: 1.1, 1.2, 1.4, 1.5_

- [ ] 3. Store
  - Implement `store.ts` with IndexedDB and the memory fallback, and the one time notice when storage is blocked.
  - Verify: `npm test -- store` passes, including the storage blocked case.
  - _Requirements: 2.1, 2.7, 4.3, 4.4_

- [ ] 4. Paper form renderer
  - Write `form.test.ts` first: every field of every template is drawn with its label, the `carbon` mode sets the carbon ink class, and text with `<b>` in a value is shown as text. See it fail.
  - Implement `app/src/form/` with the three modes and `theme.css`.
  - Verify: `npm test -- form` passes.
  - _Requirements: 2.1, 3.4_

- [ ] 5. Photos and signatures
  - Write `signature.test.ts` first for the scaling, the stroke split and the 4000 point limit, with the numbers from the design. See it fail. Implement `signature.ts` and `photo.ts` with the quality steps and the digest rule from the design.
  - Verify: `npm test -- signature` passes. The photo size test runs in task 9.
  - _Requirements: 2.2, 2.3, 2.4, 2.6_

- [ ] 6. Pick and fill screens
  - Write the unit tests first for the lock rule, the draft save within 1 second (fake timer), the blank form limit of 12 lines and the 500 character limit. See them fail.
  - Implement `pick.ts` and `fill.ts`: draft save within 1 second, the blank form lines, the locked stamp with the first missing line marked, the name lines, and `data-control` and `data-screen` on every control and screen.
  - Verify: the unit tests pass, and a hand check in the browser fills the key handover form.
  - _Requirements: 1.1, 1.3, 1.4, 1.5, 2.1, 2.5, 2.6_

- [ ] 7. Stamp, seal and carbon copy
  - Implement `stamp.ts`, `press.ts` and `copy.ts`: hold for 1.2 seconds, keyboard hold, the lift, the carbon copy, the seal words, the reduced motion fade, and the one line shown when `sealRecord` returns problems.
  - Implement `audio.ts` with a pen sound and a stamp sound made in code, and the saved sound switch.
  - Verify: `npm test -- stamp` passes with the fake timer.
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 8.3_

- [ ] 8. Tear off and library
  - Write the unit tests first for the file name rule and the share fallback. See them fail.
  - Implement `share.ts` and `library.ts`: the file name rule, the size line, share or download, the list of sealed records, delete with a confirmation box.
  - Verify: the unit tests pass.
  - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [ ] 9. Verify page and path tests
  - Write the unit tests first for the typed seal words and the typed full seal on the verify page. See them fail.
  - Implement the verify page: one file, seal words, two files with differences on their lines or listed under the form, and the plain lines for each error and for an unsealed copy.
  - Write `e2e/layout.spec.ts` (with `app/src/layout.ts`), `e2e/contrast.spec.ts`, `e2e/good-path.spec.ts` and `e2e/bad-path.spec.ts`, with the photo size check inside the good path. Each path test records every request and fails on any request to another origin, and fails on any page error or console error. In the good path and the bad path, also open the downloaded copy file from disk in the browser and read the text of the element with id `stamp`: `Seal matches this copy` for the good file, `This copy was changed after sealing` for a file with one character of a field changed in the file text (this is the real browser check of requirement 5.4 of `record-core`). The bad path also loads a copy with its seal removed. Run them and fix every named control.
  - Replace the root `e2e` script with the Playwright run. Add the root script `verify:e2e` that runs `npm run verify` and then `npm run e2e`. This works the same in PowerShell and in other shells.
  - Verify: `npm run verify:e2e` passes. Write in the log the name of the tool and the result of the request check.
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 8.1, 8.2, 8.4, 8.5, 9.1, 9.2, 9.3_

- [ ] 10. Try to change this copy
  - Write the property "a changed duplicate is caught" from the design as a unit test over the sample and a sealed record built from each of the four templates first. See it fail.
  - Implement `tamper.ts`, the duplicate editor and its verify view. Add its screen to the layout test, one step to the good path test (change one line and see the broken seal) and one step to the bad path test (the stored original still shows `Seal matches`).
  - Verify: `npm run verify:e2e` passes.
  - _Requirements: 6.1, 6.2_

- [ ] 11. Print
  - Write `e2e/print.spec.ts` first, for A4 and for Letter. See it fail.
  - Implement `print.css`, the Print button on a sealed record, and the seal words and the full seal in the page foot. Add one step to the good path test (the Print button opens the print layout) and one step to the bad path test (a record with 6 photos prints with no photo split).
  - Verify: `npm run verify:e2e` passes.
  - _Requirements: 4.4, 7.1_

- [ ] 12. Site, privacy page and beacon
  - Build `site/index.html` with the self playing loop made from the real app screens, and `site/privacy.html` generated from the same list `beacon.ts` uses. Both read the product name from `app/app.config.ts` at build time.
  - Implement `beacon.ts`. With no `VITE_BEACON_URL` it must send nothing. Add a unit test for both cases and for the `other` template id.
  - State on the privacy page only what a recorded check covers. Until the request check of task 9 has run and is in the log, write the claim as a target.
  - Replace the root `build` script with the real build. It must still build `core` and `mcp`.
  - Verify: `npm run build` gives `dist/` with `/`, `/app/`, `/verify/` and `/privacy/`.
  - _Requirements: 10.1, 10.2, 10.3, 10.4_

- [ ] 13. Offline and version guard
  - Add `app/src/sw.ts`, the service worker that caches the built files. Add a browser test that loads the app, goes offline, reloads and seals the sample. Add one step to the good path test and one to the bad path test (a reload while offline shows the pick screen, and a blocked service worker leaves the app working).
  - Add a build step that fails when any `package.json` version is 1.0.0 or higher. Write its test first.
  - Verify: `npm run verify:e2e` and `npm run build` pass.
  - _Requirements: 10.5_

- [ ] 14. Art, final look and log
  - Replace the placeholder paper and stamp art in `app/src/assets/` with the final files given for the app. Write in the log who made each file. A file not made for this repository is not added. Run the layout test and the contrast test again.
  - Verify: `npm run verify:e2e` passes.
  - _Requirements: 8.1, 8.5_
