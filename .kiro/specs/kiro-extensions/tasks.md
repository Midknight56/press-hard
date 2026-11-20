# Implementation Plan

After each finished task, add one row to `docs/kiro-log.md` on the same day. Leave the Credits cell empty. The owner fills it.

This spec owns `power/`, `.kiro/agents/`, `docs/acceptance/`, `mcp/tests/extensions.test.ts` and `docs/kiro-log.md`. It does not edit `core/src/`, `app/src/`, `mcp/src/`, `.kiro/settings/` or `.kiro/hooks/`.

- [x] 1. The power
  - Write the power checks in `mcp/tests/extensions.test.ts` first. See them fail.
  - Create `power/press-hard/` with `plugin.json`, `mcp.json`, `README.md` and `skills/handover-records/SKILL.md`.
  - Verify: `npx vitest run tests/extensions.test.ts` in `mcp/` passes the power cases.
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 4.1, 4.2_

- [x] 2. The custom agent
  - Write the agent checks first. See them fail.
  - Create `.kiro/agents/copy-checker.json`.
  - Verify: the agent cases pass, and `kiro-cli agent validate --path .kiro/agents/copy-checker.json` exits 0.
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 4.1, 4.2_

- [x] 3. Proof inputs and the two red proof cases
  - Write the input checks and the two proof cases first. See them fail.
  - Build `core`, run `node mcp/scripts/make-demo-copies.ts`, and copy the two files into both `inputs/` folders. Add one `README.md` to each session folder that says what the files are.
  - Verify: the input cases pass. The two proof cases stay red until the lead saves the proof pages. Run `npm run verify` and report the names of the failing tests.
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 4. Repair the agent tool name
  - Change the agent cases to name `fs_read` and refuse `read`. See them fail on the old file.
  - Put `fs_read` in `.kiro/agents/copy-checker.json`.
  - Verify: the agent cases pass, and `kiro-cli agent validate --path .kiro/agents/copy-checker.json` exits 0.
  - _Requirements: 2.2_
