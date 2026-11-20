# Design Document

## Overview

One test file and the fixes it demands. The scan reuses `walkScreens`, so it sees the same screens as the layout and contrast tests and they cannot drift apart.

```
e2e/a11y.spec.ts                  the scan, at two sizes
test-results/a11y-summary.json    table of every violation, written by the test
press-hard-logs/a11y-before.json  raw result on the code before the fixes (outside the repository)
```

## The scan

For each size (390 by 844 and 1280 by 720) one test calls `walkScreens`. In the `visit` callback it waits for fonts, then runs `new AxeBuilder({ page }).withTags([...]).analyze()` with the six tags. It sets no `exclude`, no `disableRules` and no `include`.

`walkScreens` already reaches the pick, fill, copy, tamper, library, library delete box, help, verify (empty, one file, two files), landing and privacy screens. The copy screen is scanned after the peel ends, as the layout test does it.

Each violation is stored with its rule id, impact, size, screen and first node selector. After the walk the test appends to a file per size in `test-results/`, and a final summary step joins the two files into `a11y-summary.json` as rows of rule id, impact, count and screens. The files are written with `writeFileSync` as UTF-8.

The test fails when any violation has the impact serious or critical. The message lists, for each: `rule id, impact, size, screen, first selector`. The summary is written before the assertion, so a failing run still leaves the table.

## Raw result

For the before run, a one off run with the environment variable `A11Y_RAW` set writes the whole axe result of each screen to the path in that variable. The variable is unset in normal runs. The raw file is outside the repository.

## Fixes

Each fix is made at the cause in `app/src/`, `site/` or `app/index.html`. A fix never changes visible text or a `data-control` attribute. A name for a control that has no visible text comes from an `aria-label` or a visually hidden text. A rule that cannot apply (for example colour contrast of an `aria-hidden` stamp impression) is not excluded. The work stops and the lead decides.

## Tests

The scan is the test. It is first run on the unfixed code and must fail on a real violation, not on a missing package or a bad selector. The existing unit and browser suites must still pass.

## Correctness properties

None. The scan checks a fixed set of screens, not a function over a range of inputs.
