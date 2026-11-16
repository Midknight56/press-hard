# Implementation Plan

- [ ] 1. Scaffold the app and the first failing tests
  - Create `app/` with `package.json`, `tsconfig.json`, Vite and the DOM test environment for Vitest. Add Playwright at the root for `e2e/`, headless only. Write each licence in the log.
  - Write `templates.test.ts`, `stamp.test.ts` and `store.test.ts` from the design. Run them and see them fail.
  - Verify: `npm run typecheck` passes and the three test files fail because the code does not exist yet.
  - _Requirements: 1.2, 3.1, 3.2_

- [ ] 2. Templates and the sample
  - Write the four templates and `sample.ts`, a filled rental return with made up names, two small original photos and two signatures.
  - Verify: `npm test -- templates` passes, and `validateRecord` from `core/` reports no problem for the sample.
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [ ] 3. Store
  - Implement `store.ts` with IndexedDB and the memory fallback.
  - Verify: `npm test -- store` passes, including the storage blocked case.
  - _Requirements: 2.1, 4.3, 4.4_

- [ ] 4. Paper form renderer
  - Write `form.test.ts` first: every field of every template is drawn with its label, the `carbon` mode sets the carbon ink class, and text with `<b>` in a value is shown as text. See it fail.
  - Implement `app/src/form/` with the three modes and `theme.css`.
  - Verify: `npm test -- form` passes.
  - _Requirements: 2.1, 3.4_

- [ ] 5. Photos and signatures
  - Write `signature.test.ts` first for the scaling and the stroke split. Implement `signature.ts` and `photo.ts` with the quality steps from the design.
  - Verify: `npm test -- signature` passes. The photo size test runs in task 9.
  - _Requirements: 2.2, 2.3, 2.4_

- [ ] 6. Pick and fill screens
  - Implement `pick.ts` and `fill.ts`: draft save within 1 second, the locked stamp with the first missing line marked, and `data-control` on every control.
  - Verify: unit tests for the lock rule pass, and a hand check in the browser fills the key handover form.
  - _Requirements: 1.1, 1.4, 2.1, 2.5_

- [ ] 7. Stamp, seal and carbon copy
  - Implement `stamp.ts`, `press.ts` and `copy.ts`: hold for 1.2 seconds, keyboard hold, the lift, the carbon copy, the seal words, and the reduced motion fade.
  - Implement `audio.ts` with a pen sound and a stamp sound made in code, and the saved sound switch.
  - Verify: `npm test -- stamp` passes with the fake timer.
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 8.3_

- [ ] 8. Tear off and library
  - Implement `share.ts` and `library.ts`: the file name rule, the size line, share or download, the list of sealed records, delete with a confirmation box.
  - Verify: unit tests for the file name and for the share fallback pass.
  - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [ ] 9. Verify page and path tests
  - Implement the verify page: one file, seal words, two files with differences on their lines, and the plain error lines.
  - Write `e2e/layout.spec.ts`, `e2e/good-path.spec.ts` and `e2e/bad-path.spec.ts`, with the photo size check inside the good path. Run them and fix every named control.
  - Replace the root `e2e` script with the Playwright run and add it to `verify` behind the variable `E2E=1`.
  - Verify: `E2E=1 npm run verify` passes.
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 8.1, 8.2, 9.1, 9.2, 9.3_

- [ ] 10. Try to change this copy
  - Write the property "a changed duplicate is caught" from the design as a unit test over the three fixtures first. See it fail.
  - Implement the duplicate editor and its verify view. Add one step to the good path test.
  - Verify: `E2E=1 npm run verify` passes.
  - _Requirements: 6.1, 6.2_

- [ ] 11. Print
  - Write `e2e/print.spec.ts` first. See it fail.
  - Implement the print styles with the seal words and the full seal in the page foot.
  - Verify: `E2E=1 npm run verify` passes.
  - _Requirements: 7.1_

- [ ] 12. Site, privacy page and beacon
  - Build `site/index.html` with the self playing loop made from the real app screens, and `site/privacy.html` generated from the same list `beacon.ts` uses.
  - Implement `beacon.ts`. With no `VITE_BEACON_URL` it must send nothing. Add a unit test for both cases.
  - Verify: `npm run build` gives `dist/` with `/`, `/app/`, `/verify/` and `/privacy/`.
  - _Requirements: 10.1, 10.2, 10.3, 10.4_

- [ ] 13. Offline and version guard
  - Add the service worker that caches the built files. Add a browser test that loads the app, goes offline, reloads and seals the sample.
  - Add a build step that fails when any `package.json` version is 1.0.0 or higher. Write its test first.
  - Verify: `E2E=1 npm run verify` and `npm run build` pass.
  - _Requirements: 8.4, 10.5_

- [ ] 14. Art, final look and log
  - Replace the placeholder paper and stamp art with the final files given for the app. Run the layout test and the contrast check again.
  - Add the log rows for this spec with the credits used.
  - Verify: `E2E=1 npm run verify` passes.
  - _Requirements: 8.1_
