# Proof: one real change made from Kiro Web

Date: 2026-11-20. Tool: Kiro Web (app.kiro.dev), model Auto, repository `Midknight56/press-hard` through the GitHub connection, branch `kiro-breadth`. The session was named by Kiro Web "Add Accessibility Script To Package".

## The task

The task text, as typed into Kiro Web: add a script `a11y` to the root `package.json` that runs only the accessibility scan (`e2e/a11y.spec.ts`); add one sentence to the Accessibility section of `README.md` that names `npm run a11y`; write the test first, as a case in `core/tests/scaffold.test.ts`; add one row to `docs/kiro-log.md` with the surface Kiro Web; add no package; say so where a command cannot run; open a pull request into `kiro-breadth`.

## What Kiro Web did

- It worked in its own copy of the repository, on branch `kiro-breadth` (its first command printed `On branch kiro-breadth`), read the four steering files, and pushed a new branch `kiro-a11y-script`.
- It opened pull request 1, https://github.com/Midknight56/press-hard/pull/1, into `kiro-breadth`: 4 files changed, 9 lines added, 1 line removed, one commit, `80779c9`.
- The change: `package.json` has `"a11y": "playwright test e2e/a11y.spec.ts"`; the Accessibility section of `README.md` has one added sentence naming `npm run a11y`; `core/tests/scaffold.test.ts` has one new case; `docs/kiro-log.md` has one new row.
- Kiro Web's own figures at the end of the session: estimated credits used 0.81, elapsed time 42 seconds.
- The pull request was merged into `kiro-breadth` by merge commit `6327239`.

## What did not run in Kiro Web

Kiro Web's session ran with network access set to "Repository access only". Its `npm ci` failed with a 403, so `node_modules` did not exist, and none of vitest, lint, the type check or Playwright ran there. Kiro Web said so in the log row and in the pull request, and ran the two checks of the new test case with a small Node script instead (both failed before the change and passed after it). That script is not the real test run, and Kiro Web did not claim it was.

## Check made after the merge, on the local machine

`npx vitest run tests/scaffold.test.ts` in `core/` on `kiro-breadth` after the merge: 21 tests passed, including the new case "the a11y script runs only the accessibility scan, and the README names it".

## How Kiro Web differed from the CLI

| | Kiro CLI (headless) | Kiro Web |
| --- | --- | --- |
| Where the code runs | This machine, in the repository folder | A cloud sandbox with its own copy of the repository |
| Packages | Installed here | Could not be downloaded (403), so no test suite ran |
| Result | Files changed in the working tree, no commit by Kiro | A branch pushed by the GitHub app and a pull request |
| Credits | Read from the usage page | The session shows an estimate (0.81) |
