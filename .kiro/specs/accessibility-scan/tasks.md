# Implementation Plan

After each finished task, add one row to `docs/kiro-log.md` on the same day. Leave the Credits cell empty. The owner fills it.

This spec owns `e2e/a11y.spec.ts`, the root `package.json` and lockfile entries for the scan package, and the fixes it demands in `app/src/`, `site/` and `app/index.html`. It edits no file in `core/src/`, `mcp/src/`, `.design-ref/`, `.kiro/settings/` or `.kiro/hooks/`. It adds a section to `README.md` and rows to `docs/kiro-log.md`.

Write every file as UTF-8 with no byte order mark and with LF line endings. On Windows, do not write files with PowerShell `Set-Content` or `Out-File`.

- [x] 1. The scan package
  - Check first that `@axe-core/playwright` cannot be resolved. See it fail.
  - Run `npm install --save-dev --save-exact @axe-core/playwright@4.14.0` at the root. Add the two rows to the dependency table of `docs/kiro-log.md`.
  - Verify: the package resolves, `package.json` holds `4.14.0` with no range, and `npm ls axe-core` shows `~4.14.0` satisfied.
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 2. The scan test
  - Write `e2e/a11y.spec.ts` from the design. Run it on the unfixed code and see it fail on a real serious or critical violation.
  - Verify: `npx playwright test e2e/a11y.spec.ts` fails with the rule id, impact, size, screen and selector, and `test-results/a11y-summary.json` exists.
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

- [x] 3. Save the result and fix the violations
  - Save the raw result before the fixes to `D:/Projects/kiroween/press-hard-logs/a11y-before.json`.
  - Fix each serious or critical violation at its cause. Fix small moderate ones. List the rest in the log row.
  - Verify: `npx playwright test e2e/a11y.spec.ts` passes.
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 4. The existing suites
  - Check free memory is at least 8 GB. Run `npm run verify:e2e`.
  - Verify: every test that passed before passes. Change a pinned test only as requirement 4.2 says.
  - _Requirements: 4.1, 4.2_

- [x] 5. README section
  - Add the section "Accessibility" after the table "Tests on the last full run", and the new test count in that table, read from the run.
  - Verify: the numbers in the section match the saved result and the run.
  - _Requirements: 5.1, 5.2, 5.3, 5.4_
