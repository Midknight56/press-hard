# Kiro log

One row for each finished task, added the same day.

| Date | Kiro surface and model | Spec and task | Files or commit | Verify command and result | Credits | What changed because of a failure |
| --- | --- | --- | --- | --- | --- | --- |
| 2026-11-16 | Kiro CLI 3.3.0 (v3, no person at the keyboard), Auto (model chosen by the server) | record-core spec review (prompt B), no code | `.kiro/specs/record-core/requirements.md`, `design.md`, `tasks.md`; `.kiro/specs/counter-app/tasks.md` | No command ran: the shell tool was not trusted in this run. After the run, the files were checked for a byte order mark and CR line endings: none. The 3 SHA-256 values and the byte counts were recomputed outside Kiro and match. | | Review found gaps and the files were edited. |
| 2026-11-16 | Kiro CLI 3.3.0 (v3, no person at the keyboard), Auto (model chosen by the server) | counter-app spec review (prompt B), no code | `.kiro/specs/counter-app/requirements.md`, `design.md`, `tasks.md` | No command ran: the shell tool was not trusted in this run. After the run, the files were checked for a byte order mark and CR line endings: none. | | Review found gaps and the three files were edited. |
| 2026-11-16 | Kiro CLI 3.3.0 (v3, no person at the keyboard), Auto (model chosen by the server) | record-core task 1, scaffold the workspace | `package.json`, `package-lock.json`, `tsconfig.json`, `eslint.config.js`, `LICENSE`, `README.md`, `.gitignore`, `core/package.json`, `core/tsconfig.json`, `core/tsconfig.build.json`, `core/tests/scaffold.test.ts`, `mcp/package.json`, `.kiro/specs/record-core/tasks.md` | `npm run verify` exit 0: typecheck and lint clean, 17 of 17 tests pass, `e2e` prints `not built yet`. Before the scaffold existed, `core/tests/scaffold.test.ts` failed: first because Vitest was not installed, then 13 of 17 tests failed on missing files. The hooks `typecheck-on-save` and `verify-on-stop` were not seen to fire in this run (no hook output appeared), so they are not recorded as fired. | | `typescript` 7.0.2 was refused by `typescript-eslint` 8.73.0 (peer range below 6.1), so `typescript` is pinned to 6.0.3. The `prebuild` and `pretest` scripts of `core` print a note until the generator exists. |

## Hooks seen to fire

| Date | Hook | What triggered it | What it did |
| --- | --- | --- | --- |
| `typescript` | 6.0.3 | Apache-2.0 | record-core 1 |
| `vitest` | 5.1.0 | MIT | record-core 1 |
| `fast-check` | 4.10.2 | MIT | record-core 1 |
| `eslint` | 10.15.0 | MIT | record-core 1 |
| `@eslint/js` | 10.0.1 | MIT | record-core 1 |
| `typescript-eslint` | 8.73.0 | MIT | record-core 1 |
| `@types/node` | 26.6.6 | MIT | record-core 1 |

## Tool door transcripts

Paste each real list of tool calls here, with the date and the level.

## Dependencies and licences

| Package | Version | Licence | Added in task |
| --- | --- | --- | --- |
| typescript | 6.0.3 | Apache-2.0 | record-core 1 |
| typescript-eslint | 8.73.0 | MIT | record-core 1 |
| eslint | 10.15.0 | MIT | record-core 1 |
| @eslint/js | 10.0.1 | MIT | record-core 1 |
| vitest | 5.1.0 | MIT | record-core 1 |
| fast-check | 4.10.2 | MIT | record-core 1 |
| @types/node | 26.6.6 | MIT | record-core 1 |
