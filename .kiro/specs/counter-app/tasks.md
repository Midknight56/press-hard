# Implementation Plan

After each finished task, add one row to `docs/kiro-log.md` on the same day. Leave the Credits cell empty. The owner fills it.

This spec owns `app/`, `e2e/` and `site/`. It reads `core/` only through its exports and edits no file there. It also makes these changes in the root files that the `record-core` spec owns, and no others: add `app` to the workspaces list and add Playwright to the root dev dependencies (task 1), replace the root `e2e` script and add `verify:e2e` (task 9), and replace the root `build` script (task 12). It adds rows to `docs/kiro-log.md`. No test here reads a file under `core/tests/` or `mcp/`.

Write every file as UTF-8 with no byte order mark and with LF line endings. On Windows, do not write files with PowerShell `Set-Content` or `Out-File`.

- [x] 1. Scaffold the app and the first failing tests
  - Create `app/` with `package.json` (`"version": "0.1.0"`, `"private": true`), `tsconfig.json` and `app/app.config.ts` holding the product title, add `app` to the root workspaces list, Vite and the DOM test environment for Vitest. Add Playwright at the root for `e2e/`, headless only. Write each licence in the log.
  - Write `templates.test.ts`, `stamp.test.ts` and `store.test.ts` from the design. Run them and see them fail.
  - Verify: the three test files run and fail because the code does not exist yet. `npm run typecheck` is not required here, because the tests import code that does not exist.
  - _Requirements: 1.2, 3.1, 3.2_

- [x] 2. Templates and the sample
  - Write the four templates and `sample.ts`, a filled rental return with made up names, two small original photos and two signatures. Each form starts with the giver name and receiver name lines.
  - Verify: `npm test -- templates` passes, and `validateRecord` from `core/` reports no problem for the sample.
  - _Requirements: 1.1, 1.2, 1.4, 1.5_

- [x] 3. Store
  - Implement `store.ts` with IndexedDB and the memory fallback, and the one time notice when storage is blocked.
  - Verify: `npm test -- store` passes, including the storage blocked case.
  - _Requirements: 2.1, 2.7, 4.3, 4.4_

- [x] 4. Paper form renderer
  - Write `form.test.ts` first: every field of every template is drawn with its label, the `carbon` mode sets the carbon ink class, and text with `<b>` in a value is shown as text. See it fail.
  - Implement `app/src/form/` with the three modes and `theme.css`.
  - Verify: `npm test -- form` passes.
  - _Requirements: 2.1, 3.4_

- [x] 5. Photos and signatures
  - Write `signature.test.ts` first for the scaling, the stroke split and the 4000 point limit, with the numbers from the design. See it fail. Implement `signature.ts` and `photo.ts` with the quality steps and the digest rule from the design.
  - Verify: `npm test -- signature` passes. The photo size test runs in task 9.
  - _Requirements: 2.2, 2.3, 2.4, 2.6_

- [x] 6. Pick and fill screens
  - Write the unit tests first for the lock rule, the draft save within 1 second (fake timer), the blank form limit of 12 lines and the 500 character limit. See them fail.
  - Implement `pick.ts` and `fill.ts`: draft save within 1 second, the blank form lines, the locked stamp with the first missing line marked, the name lines, and `data-control` and `data-screen` on every control and screen.
  - Verify: the unit tests pass, and a hand check in the browser fills the key handover form.
  - _Requirements: 1.1, 1.3, 1.4, 1.5, 2.1, 2.5, 2.6_

- [x] 7. Stamp, seal and carbon copy
  - Implement `stamp.ts`, `press.ts` and `copy.ts`: hold for 1.2 seconds, keyboard hold, the lift, the carbon copy, the seal words, the reduced motion fade, and the one line shown when `sealRecord` returns problems.
  - Implement `audio.ts` with a pen sound and a stamp sound made in code, and the saved sound switch.
  - Verify: `npm test -- stamp` passes with the fake timer.
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 8.3_

- [x] 8. Tear off and library
  - Write the unit tests first for the file name rule and the share fallback. See them fail.
  - Implement `share.ts` and `library.ts`: the file name rule, the size line, share or download, the list of sealed records, delete with a confirmation box.
  - Verify: the unit tests pass.
  - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [x] 9. Verify page and path tests
  - Write the unit tests first for the typed seal words and the typed full seal on the verify page. See them fail.
  - Implement the verify page: one file, seal words, two files with differences on their lines or listed under the form, and the plain lines for each error and for an unsealed copy.
  - Write `e2e/layout.spec.ts` (with `app/src/layout.ts`), `e2e/contrast.spec.ts`, `e2e/good-path.spec.ts` and `e2e/bad-path.spec.ts`, with the photo size check inside the good path. Each path test records every request and fails on any request to another origin, and fails on any page error or console error. In the good path and the bad path, also open the downloaded copy file from disk in the browser and read the text of the element with id `stamp`: `Seal matches this copy` for the good file, `This copy was changed after sealing` for a file with one character of a field changed in the file text (this is the real browser check of requirement 5.4 of `record-core`). The bad path also loads a copy with its seal removed. Run them and fix every named control.
  - Replace the root `e2e` script with the Playwright run. Add the root script `verify:e2e` that runs `npm run verify` and then `npm run e2e`. This works the same in PowerShell and in other shells.
  - Verify: `npm run verify:e2e` passes. Write in the log the name of the tool and the result of the request check.
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 8.1, 8.2, 8.4, 8.5, 9.1, 9.2, 9.3_

- [x] 10. Try to change this copy
  - Write the property "a changed duplicate is caught" from the design as a unit test over the sample and a sealed record built from each of the four templates first. See it fail.
  - Implement `tamper.ts`, the duplicate editor and its verify view. Add its screen to the layout test, one step to the good path test (change one line and see the broken seal) and one step to the bad path test (the stored original still shows `Seal matches`).
  - Verify: `npm run verify:e2e` passes.
  - _Requirements: 6.1, 6.2_

- [x] 11. Print
  - Write `e2e/print.spec.ts` first, for A4 and for Letter. See it fail.
  - Implement `print.css`, the Print button on a sealed record, and the seal words and the full seal in the page foot. Add one step to the good path test (the Print button opens the print layout) and one step to the bad path test (a record with 6 photos prints with no photo split).
  - Verify: `npm run verify:e2e` passes.
  - _Requirements: 4.4, 7.1_

- [x] 12. Site, privacy page and beacon
  - Build `site/index.html` with the self playing loop made from the real app screens, and `site/privacy.html` generated from the same list `beacon.ts` uses. Both read the product name from `app/app.config.ts` at build time.
  - Implement `beacon.ts`. With no `VITE_BEACON_URL` it must send nothing. Add a unit test for both cases and for the `other` template id.
  - State on the privacy page only what a recorded check covers. Until the request check of task 9 has run and is in the log, write the claim as a target.
  - Replace the root `build` script with the real build. It must still build `core` and `mcp`.
  - Verify: `npm run build` gives `dist/` with `/`, `/app/`, `/verify/` and `/privacy/`.
  - _Requirements: 10.1, 10.2, 10.3, 10.4_

- [x] 13. Offline and version guard
  - Add `app/src/sw.ts`, the service worker that caches the built files. Add a browser test that loads the app, goes offline, reloads and seals the sample. Add one step to the good path test and one to the bad path test (a reload while offline shows the pick screen, and a blocked service worker leaves the app working).
  - Add a build step that fails when any `package.json` version is 1.0.0 or higher. Write its test first.
  - Verify: `npm run verify:e2e` and `npm run build` pass.
  - _Requirements: 10.5_

- [x] 14. Art, final look and log
  - Replace the placeholder paper and stamp art in `app/src/assets/` with the final files given for the app. Write in the log who made each file. A file not made for this repository is not added. Run the layout test and the contrast test again.
  - Verify: `npm run verify:e2e` passes.
  - _Requirements: 8.1, 8.5_

- [x] 15. Layout polish from screenshots
  - [x] 15.1 Pick screen: the four form choices and the sample are the first thing in view at 360x640 and 1920x1080, above the preview.
  - [x] 15.2 Top nav: one row at 360 wide, shorter labels, each control at least 44 px and inside the edge rules.
  - [x] 15.3 Copy screen: every sheet, card and panel (`data-box`) keeps 16 px from each screen edge. The carbon copy, the stamp picture and the seal words are in the first view.
  - [x] 15.4 Fill screen: the stamp picture is an element beside the label "Hold to seal", never under it.
  - [x] 15.5 Fill screen: the hold to seal bar is sticky at the bottom, so it is in view at every size.
  - [x] 15.6 Centring: every main column and the sheets in it are centred within 2 px. Measured: the columns were already centred, the bar and the pick contents were not.
  - [x] 15.7 Privacy page: plain words for a member of the public, every fact kept, no dashes between words. A site test bans "Target:", "kiro-log", "spec" and "task 9".
  - [x] 15.8 Port: the preview and test server moved from 4173 to 4473 (nothing used 4174), `strictPort` stays true.
  - Test first: `app/src/layout.ts` and `e2e/layout.spec.ts` now also measure sheets, cards and panels, pictures inside controls, centring and the first view rules. Unit tests in `app/tests/layout-screens.test.ts`.
  - Verify: `npm run verify:e2e` passes.
  - _Requirements: 1.1, 8.1_

- [x] 16. Submission README
  - [x] 16.1 The root `README.md` is the full submission README, written by hand on 2026-11-17. Its text is not changed by Kiro.
  - [x] 16.2 In `core/tests/scaffold.test.ts`, replace the three line README test with a README check: first line, the two headings, the five criteria in order, no em dash, no en dash, no hyphen joining two words, and none of the four banned words. The MIT LICENSE check is kept as its own test.
  - [x] 16.3 Test first: run the check on the current README and see it pass. Run it on a copy with two criteria swapped and see it fail.
  - [x] 16.4 Verify: `npm run verify` passes.

- [x] 17. Words on screen
  - [x] 17.1 Test first: `e2e/words.spec.ts` walks every screen of the app, the verify page, the landing page and the privacy page, and fails when the visible text, a title or an aria-label holds "sample", "simulated" or "synthetic" in any case. It failed on the old code (pick screen button and fill screen badge).
  - [x] 17.2 The fill screen badge says "Prefilled". Its class and data-role are `prefilled-badge`.
  - [x] 17.3 The pick screen button says "Try it prefilled: rental return". Its data-control is `pick-prefilled` and its class is `prefilled`.
  - [x] 17.4 Tests, e2e helpers, the layout lists and the walk step use the new names. Nothing looks for `pick-sample` or `sample-badge`. Internal names such as `sampleRecord` stay.
  - [x] 17.5 Verify: `npm run verify:e2e` passes.

- [x] 18. A build that works from any web path
  - [x] 18.1 Test first: `e2e/subpath.spec.ts` serves the existing `dist` with a Node http server on port 4474 under `/press-hard/`, follows the links, seals the prefilled rental return, and fails on a 404, a request outside the sub path, or a page or console error. The root of the same server answers 404. It failed on the old build.
  - [x] 18.2 `base` is `./` in `app/vite.config.ts`. Pages moved to another folder depth get their asset paths counted again.
  - [x] 18.3 The service worker precache list is relative to the worker, and its offline page fallback is found from the worker's folder.
  - [x] 18.4 `verify:e2e` runs `npm run build` before `npm run e2e`, so the sub path test never reads an old `dist`.
  - [x] 18.5 `docs/DEPLOY.md` gives the build command, the output folder, the no server code fact, the root or sub path fact and one local serve command.
  - [x] 18.6 Verify: `npm run verify:e2e` and `npm run build` pass.

- [x] 19. Show the carbon copy
  - [x] 19.1 Test first: unit tests in `app/tests/copy-sheets.test.ts` and `app/tests/verify-picker.test.ts`, and e2e tests in `e2e/layout.spec.ts` (360x640 strip and swap, the peel at 1.8 s, reduced motion, 1920x1080 side by side). They failed on the old code.
  - [x] 19.2 The peel: with motion allowed, the top sheet peels up and to the left over 1.1 s, holds 1.4 s, settles over 0.8 s (one `peel` animation of 3.3 s). On screens under 900 px it moves by -120% so the whole carbon copy is in view; from 900 px it moves by -62%.
  - [x] 19.3 Narrow rest place: the carbon sheet sits 24 px right and 24 px down from the top sheet. Both sheets stay 16 px inside the edges at 360 px wide.
  - [x] 19.4 Wide rest place (900 px and up): side by side, 24 px gap, centred, labelled "Top copy" and "Carbon copy" above each sheet.
  - [x] 19.5 Control `swap-sheets` on narrow screens, "Show carbon copy" or "Show top copy", no motion. It is an `input type="button"`, so the existing copy screen test that counts `button` elements still holds.
  - [x] 19.6 Reduced motion: no peel, the carbon copy fades in at its rest place. Print is unchanged.
  - [x] 19.7 Verify page: the real file input is kept (`verify-file`), shown as a button "Choose a copy file" with the chosen file names beside it.
  - [x] 19.8 The walk waits for the peel to end before it measures the copy screen.
  - [x] 19.9 Verify: `npm run verify:e2e` passes.

- [x] 20. The night desk look
  - [x] 20.1 Test first, shown failing on the current code: `app/tests/fonts.test.ts` (the font files, their licence texts, `@font-face` with swap, no other origin), `app/tests/look.test.ts` (the decorative markup is hidden from readers and holds no text), and `e2e/look.spec.ts` (fonts served from the app's origin and loaded on the fill screen, also offline; the stamp words and the instruction line are pseudo element content and not in the page text; the three column layout at 1920x1080; the fixed bottom bar at 360x640).
  - [x] 20.2 Fonts: the four families are copied from the owner's design folder to `app/src/fonts/` with their four OFL texts. `app/src/fonts.css` declares them with `font-display: swap`. Vite writes them into `dist/assets/`, so the service worker precache list holds them.
  - [x] 20.3 Tokens and look: `app/src/look.css` holds the night desk look for the screen only (print keeps the old rules in `theme.css`, `app.css` and `print.css`). It covers the desk, the rail and top bar, the sheet and its form cells, the ink pad button, the paper tag buttons, the signature boxes, the stamp moment, the copy screen, the library, help, tamper, the verify page and the site pages.
  - [x] 20.4 Markup that the look needs, with no change to any text, control or `data-*` attribute: the tagline, the steps and the current page mark in the nav, the line kind classes, the seal row with the stamp target in the fill screen, and the decorative stamp impression on the sealed sheets.
  - [x] 20.5 Decorative words (stamp words, date, the instruction line, the steps) are drawn with CSS `content` on empty `aria-hidden` elements. `e2e/words.spec.ts` is not changed.
  - [x] 20.6 Layout: three columns from 1900 px wide on the fill screen, the phone layout with a fixed bottom bar below that. All 7 sizes of the layout test, with no sideways scroll.
  - [x] 20.7 Motion from the design: the dim and ring during the hold, the stamp drop, the stamp thump, the 2 px shake, the seal words in four steps, the tear off slide. Reduced motion turns them into 150 ms cross fades. The hold is still 1200 ms and `stamp.ts` is not changed. Not done: the 60 ms ink in of typed characters, the release lift with overshoot, and the 700 ms peel (the existing 3.3 s peel is kept because its test pins it).
  - [x] 20.8 Verify: `npm run verify:e2e` passes. Add one row to `docs/kiro-log.md`.
