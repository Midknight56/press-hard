# Proof: the same spec task on three models

Date: 2026-11-20. Tool: Kiro CLI 3.5.0, headless, harness V3. The task: do the five tasks of `.kiro/specs/tool-loan-form/` test first (prompt `docs/acceptance/vibe-vs-spec/prompts/SB.prompt.txt`). Each model ran in its own throwaway worktree from the same commit, one after another, with the `--model` flag.

The credit multipliers are read from `kiro-cli chat --list-models` on 2026-11-20: `auto` 1.00x, `claude-sonnet-5.5` 1.30x, `gpt-5.6-luna` 0.60x.

## Result

| | Auto | claude-sonnet-5.5 | gpt-5.6-luna |
| --- | --- | --- | --- |
| Wall time | 4 min 01 s | 7 min 48 s | 17 min 34 s |
| Files changed | 15 (+145, -23) | 17 (+258, -28) | 16 (+121, -24) |
| App unit tests after (419 before) | 433 (+14) | 439 (+20) | 429 (+10) |
| Browser tests after (62 before) | 64 | 64 | 64 |
| `npm run verify:e2e`, run again by the lead | exit 0, 84 s | exit 0, 79 s | exit 0, 69 s |
| Form fields | the seven of the spec | the seven of the spec | the seven of the spec |
| Privacy page updated | yes | yes | yes |
| Extra tests beyond the spec | none | a `firstMissing` unit test for the form and a privacy sentence test | a privacy sentence check |
| Faults reported by the model in its own run | one fixture moved | a number typed as 25 where a record stores text, fixed; the same fixture moved | two test setup errors in the first browser run, fixed |
| Pool reading before to after (shared, upper bound) | 3,391.47 to 3,408.90 | 3,408.90 to 3,491.41 | 3,491.41 to 3,538.02 |

Sources: `D:\Projects\kiroween\hauntmap-logs\PH-S-auto.log`, `PH-S-sonnet.log`, `PH-S-luna.log` (outside the repository), the log rows each run added to `docs/kiro-log.md`, and the `verify:e2e` output re-run on each worktree (`D:\Projects\kiroween\press-hard-logs\e2e-spec-auto.txt`, `e2e-spec-sonnet.txt`, `e2e-spec-luna.txt`).

## Credits

The pool is shared with other work on the same account and Kiro gives no figure per run, so the last row is an upper bound and is not the cost of a run. The sonnet window also held a Kiro Web session of this repository (estimated 0.81 credits by Kiro Web) and other Kiro work, so its 82.51 is not comparable with the others. Read the multipliers and the times, not the last row, to compare cost.

## Which build was kept

`claude-sonnet-5.5`: it wrote the most tests (20 new app tests, against 14 and 10), including two that the spec did not ask for, and all three builds passed the full gate. Its build is merged into `kiro-breadth` (commit `c31dbf5`, merge `65436aa`). Its log rows said "Kiro IDE (non-interactive session)"; they were wrong, because the runs were CLI runs, and the lead corrected the rows.

## What it shows

- The spec task is done by all three models and passes the same gate. The speed order is the reverse of the test count order: Auto was fastest, luna slowest.
- A cheaper multiplier did not mean a cheaper run: luna's multiplier is 0.60x and its run took 17 minutes.
- The three form files are the same, so the spec fixed the shape of the feature, and the models differed in how many tests and how much care they added.

## Limits

One task, one run per model, with the pool shared. Not a benchmark. No claim is made about other tasks or other days.
