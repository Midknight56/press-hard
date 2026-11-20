# Implementation Plan

After each finished task, add one row to `docs/kiro-log.md` on the same day. Leave the Credits cell empty. The owner fills it.

This spec owns `core/tests/steering-forms.test.ts`, `.kiro/steering/product.md` and `docs/kiro-log.md`. It does not edit `core/src/`, `app/src/`, `mcp/src/`, `.kiro/settings/` or `.kiro/hooks/`. It adds no package.

- [ ] 1. Failing test: add the test described in the design to core/tests/. Run it with `npx vitest run tests/<file>` inside core and see it fail because product.md does not name Tool loan.
  - File: `core/tests/steering-forms.test.ts`.
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [ ] 2. The fix: change step 1 of "The flow" and any other line of .kiro/steering/product.md that says there are four forms, so it names all five forms. Run the same test file until it passes, then `npm run typecheck`.
  - Do not change the test to make it pass.
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [ ] 3. Log: add one row to docs/kiro-log.md for tasks 1 and 2 with the surface "Kiro IDE" and the checks run.
  - Say which case failed first and why. Leave the Credits cell empty.
  - _Requirements: 2.3_
