# Implementation Plan

After each finished task, add one row to `docs/kiro-log.md` on the same day. Leave the Credits cell empty. The owner fills it.

This spec edits files in `app/`, `e2e/`, `README.md` and `docs/kiro-log.md` only. It edits nothing in `core/` or `mcp/`.

Write every file as UTF-8 with no byte order mark and with LF line endings. On Windows, do not write files with PowerShell `Set-Content` or `Out-File`.

- [x] 1. The template
  - Update `app/tests/templates.test.ts` first: the five forms in order, the title `Tool loan`, the seven fields of `design.md`, the `Condition` options, the `CA$` unit, and the required lines. Run it and see it fail.
  - Add `app/src/templates/tool-loan.ts` and list it in `app/src/templates/index.ts`.
  - Verify: `npm test --workspace app -- templates` passes, and `validateRecord` accepts a record built from the template with its required lines filled.
  - _Requirements: 1.1, 1.2, 1.3, 2.2, 2.3, 2.4_

- [x] 2. Beacon and privacy page
  - Update `app/tests/beacon.test.ts` first: `FORM_IDS` lists the five forms, a `tool-loan` send has `template: 'tool-loan'`, and an unknown id still sends `other`. Run it and see it fail.
  - Edit `app/src/beacon.ts` and `app/src/privacy.ts`.
  - Verify: `npm test --workspace app -- beacon site` passes.
  - _Requirements: 5.1, 5.2_

- [x] 3. Pick screen and layout
  - Update `app/tests/pick.test.ts` and `app/tests/layout-screens.test.ts` first: the pick screen offers `pick-tool-loan` between `pick-sold-as-seen` and `pick-blank`, and the pinned first view list has it. Run them and see them fail.
  - Edit `app/src/layout.ts` and the comment in `app/src/screens/pick.ts`.
  - Verify: `npm test --workspace app -- pick layout` passes at all seven sizes. If a control leaves the first view at 360x640, report it and fix the style.
  - _Requirements: 4.1, 4.2_

- [x] 4. Browser steps
  - Add the Tool loan step to `e2e/good-path.spec.ts` (pick, fill the required lines, sign twice, press, tear off, verify) and to `e2e/bad-path.spec.ts` (an empty `Return by` keeps the stamp locked, and a changed line in the copy shows the broken seal). Add the empty Tool loan fill screen to `e2e/screens.ts`. Write the steps with a check on the seal words and the marked line, run them, and see any failure before you fix the code. If they pass at once, say so in the log, because tasks 1 to 3 already hold the code.
  - Verify: `npx playwright test good-path bad-path layout` passes, with no page error and no console error.
  - _Requirements: 2.1, 3.1, 3.2, 6.1_

- [x] 5. Docs and full verification
  - Add tool loan to the list of forms in `README.md`. Add the log rows for tasks 1 to 5.
  - Verify: `npm run verify` and `npm run verify:e2e` both exit 0. Write the real exit codes and test counts in the log. If a check does not run or fails, write that.
  - _Requirements: 6.2, 6.3_
