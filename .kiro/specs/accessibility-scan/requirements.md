# Requirements Document

## Introduction

Press Hard has no automated accessibility check. This spec adds one scan with axe, fixes what it finds at the cause, and records the result. An automated scan finds only part of the problems. It does not show that the product is accessible to every person.

## Requirements

### Requirement 1: The scan package
**User Story:** As the owner, I want one known dev package for the scan, so that the build stays small and the licence is recorded.

#### Acceptance Criteria
1. THE root `package.json` SHALL list `@axe-core/playwright` at exactly `4.14.0` in `devDependencies`, added with `npm install --save-dev --save-exact`.
2. THE SYSTEM SHALL add no other package. `axe-core` `~4.14.0` comes as the dependency of that package.
3. THE package SHALL not be shipped in `app/dist/` and SHALL not be modified.
4. THE dependency table of `docs/kiro-log.md` SHALL hold one row for each of the two packages with the licence (MPL-2.0), the words "dev only, not shipped, not modified" and the task.

### Requirement 2: The scan test
**User Story:** As the owner, I want the build to fail on a serious accessibility fault, so that it cannot come back unseen.

#### Acceptance Criteria
1. THE test `e2e/a11y.spec.ts` SHALL run axe with the tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa` and `best-practice` on every screen that `walkScreens` visits, and on the verify result states that it reaches.
2. THE test SHALL run at 390 by 844 and at 1280 by 720.
3. THE test SHALL fail on any violation with the impact serious or critical. THE failure message SHALL name the rule id, the impact, the size, the screen and the first offending selector.
4. THE test SHALL write a table of every violation of any impact (rule id, impact, count, screens) to `test-results/a11y-summary.json`.
5. MODERATE and minor violations SHALL be reported in the table and SHALL not fail the test.
6. THE test SHALL exclude no rule and no element.

### Requirement 3: The fixes
**User Story:** As a person who uses a keyboard, a screen reader or a small screen, I want every control to have a name and a role, and the text to be readable.

#### Acceptance Criteria
1. EVERY serious or critical violation SHALL be fixed at its cause in `app/src/`, `site/` or `app/index.html`.
2. NO fix SHALL change a visible text, a `data-control` attribute or a layout that an existing test pins.
3. SMALL fixes of moderate violations SHALL be made when they change no pinned test. The others SHALL be listed in the log row.
4. A rule that cannot apply SHALL not be excluded by Kiro. The work stops and the lead decides.
5. THE saved result before the fixes SHALL be `D:/Projects/kiroween/press-hard-logs/a11y-before.json`, outside the repository.

### Requirement 4: Existing tests
**User Story:** As the owner, I want the fixes to break nothing.

#### Acceptance Criteria
1. EVERY test that passed before SHALL pass after the fixes.
2. A pinned test SHALL change only when a real fix changes a name or a role, in the smallest way, and the log row SHALL say which and why.

### Requirement 5: README and claims
**User Story:** As a reader, I want to know what was checked and with which tool.

#### Acceptance Criteria
1. THE `README.md` SHALL hold a section "Accessibility" after the table "Tests on the last full run".
2. THE section SHALL state the tool, the sizes, the number of screens by sizes scanned, the violations before and after the fixes read from the saved result, and that an automated scan does not prove a product is accessible to every person.
3. EACH finished task SHALL add one row to `docs/kiro-log.md`.
4. NO new file SHALL name a prize, a budget or another project.
