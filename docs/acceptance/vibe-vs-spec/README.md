# Proof: one feature built twice, from a loose prompt and from a spec

Date: 2026-11-20. Tool: Kiro CLI 3.5.0, headless, harness V3, model Auto for both builds compared here. The feature: a form for lending a tool, named Tool loan, like the four forms that exist (rental return, key handover, item sold as seen, blank). It touches the form list, the usage events, the privacy page, the pick screen layout and the tests that pin the four forms.

## How it was run

Both builds started from the same commit of `kiro-breadth` (the vibe build from `97d07c4`, the spec builds from `0b7a222`, which adds only the spec). Each ran in its own throwaway git worktree with its own `npm ci`, and one after another. The prompt files are in `prompts/`.

- Vibe: one sentence (`prompts/V.prompt.txt`): add a Tool loan form like the other forms, then run the checks of the project. No spec, no list of fields, no test first. The steering files of the repository applied to both builds, because they are always included.
- Spec: first one Kiro run wrote a short spec from the same idea (`prompts/SPECW.prompt.txt`; it names the fields and told Kiro to find every place that pins the four forms), saved as `.kiro/specs/tool-loan-form/`. Then a second run did its tasks test first (`prompts/SB.prompt.txt`).

## Result

| | Vibe | Spec (Auto) |
| --- | --- | --- |
| Wall time of the build run | 3 min 13 s | 4 min 01 s, plus 1 min 30 s to write the spec |
| Files changed | 11 (+22, -18 lines) | 15 (+145, -23 lines) |
| App unit tests after the build (419 before) | 428 (+9) | 433 (+14) |
| Browser tests after the build (62 before) | 62 (+0) | 64 (+2: a good path and a bad path step for the new form) |
| `npm run verify:e2e` run again by the lead | exit 0, 68 s | exit 0, 84 s |
| Tests seen failing before the code | not asked, not done | 11 failed first, as the spec's tasks say |
| Privacy page | still says "one of the four forms" (a false statement on a public page) | says "five forms" |
| A test fixture changed to pass | 1 (a made up preview position, 400 to 500) | 1 (the same fixture, moved to 700) |
| Mistakes while building | a helper named `Rd` clashed with a PowerShell alias and deleted 10 tracked files; Kiro restored them with `git restore` and said so | none reported |
| Form fields | Tool, Condition, Accessories, Due back, Notes, Photo (its own choice) | the seven fields of the spec |

Sources: the run logs in `D:\Projects\kiroween\hauntmap-logs\PH-V.log`, `PH-SPECW.log` and `PH-S-auto.log` (outside the repository), the new log rows of `docs/kiro-log.md`, and `npm run verify:e2e` output re-run on each worktree (`D:\Projects\kiroween\press-hard-logs\e2e-vibe.txt`, `e2e-spec-auto.txt`). The privacy page line was read in `app/src/privacy.ts` of the vibe worktree.

## Credits

The credit pool is shared with other work on the same account, and Kiro gives no figure per run, so a pool reading before and after a run is an upper bound, not the cost of the run. Readings of the Kiroween pool (`credits.ps1`, total used): 3,384.62 at 2:25 PM before the vibe build; 3,389.86 at 2:28 PM after it (a README run shared that window); 3,391.47 at 2:31 PM before the spec build; 3,408.90 at 2:35 PM after it. So the vibe window moved the pool by 5.24 and the spec build window by 17.43, with other Kiro work running on the account in both.

## What it shows

- Both builds passed the full gate. A loose prompt was enough for a working form, because the tests of the repository pinned most places that list the forms.
- The loose build missed one place that no test pinned: the privacy page's sentence about the number of forms. The spec build found it because the spec step was asked to look for every place that lists the forms.
- The spec build added the browser steps and the test first discipline. It cost about a minute more and wrote more test code.
- The spec left one place stale: `.kiro/steering/product.md` still named four forms, because the spec told the builder not to edit steering. The kept build was fixed afterwards (see `docs/kiro-log.md`).

## Limits

One feature, one run of each build. A different run could differ, and no claim is made about other features. The spec was written by Kiro from a prompt that already named the fields and the form, so the comparison is a loose prompt against a written spec, not against the owner's own spec.
