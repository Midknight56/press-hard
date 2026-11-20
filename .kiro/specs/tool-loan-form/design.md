# Design Document

## Overview

Tool loan is data, like the other forms. The fill screen, the paper form renderer, the copy file and the verify page read the template and need no new code. No file in `core/` or `mcp/` changes.

## The form

Id `tool-loan`, title `Tool loan`. The giver and receiver name lines are added by every form and are not listed.

| Field id | Label | Kind | Options | Unit | Required |
|---|---|---|---|---|---|
| `tool` | Tool | text | | | yes |
| `serial` | Marking or serial | text | | | no |
| `condition` | Condition | choice | good, worn, damaged | | yes |
| `return-by` | Return by | text | | | yes |
| `deposit` | Deposit | number | | CA$ | no |
| `notes` | Notes | text | | | no |
| `photo-tool` | Photo of the tool | photo | | | no |

`Return by` is a text line, so the user writes the date as they like. Photo lines enter the record with their photo, as for the other forms.

## Places that change

Code:
- `app/src/templates/tool-loan.ts`: new file, exports `toolLoan`.
- `app/src/templates/index.ts`: import it and set the list to `[rentalReturn, keyHandover, soldAsSeen, toolLoan, blank]`. The pick screen builds its buttons from this list, so `pick.ts` needs only its comment changed from `four forms` to `five forms`.
- `app/src/beacon.ts`: add `'tool-loan'` to `FORM_IDS` (before `'blank'`) and change the comment.
- `app/src/privacy.ts`: change `one of the four forms` to `one of the five forms`.
- `app/src/layout.ts`: add `'pick-tool-loan'` to `REQUIRED_FIRST_VIEW.pick`, after `'pick-sold-as-seen'`.

Tests:
- `app/tests/templates.test.ts`: the order test, the title, the fields, the required lines, and the loops over `rental-return`, `key-handover` and `sold-as-seen` (lines 70 and 77) get the new id.
- `app/tests/pick.test.ts`: the order and title test, and its name.
- `app/tests/layout-screens.test.ts`: the pinned list on line 93 and the names on line 125.
- `app/tests/beacon.test.ts`: the list test and the test names that say `four forms`.
- `e2e/good-path.spec.ts` and `e2e/bad-path.spec.ts`: one Tool loan step each. `e2e/screens.ts` adds the empty Tool loan fill screen to the layout walk.

Docs:
- `README.md` line 25: add tool loan to the list of forms.
- `.kiro/steering/product.md` line 13 has the same list. It is a steering file, so the owner decides whether to change it. Leave it unless asked.
- `docs/kiro-log.md`: one row per finished task.

Not changed: `app/src/look.css` (its form rules name only `rental-return`), `app/src/templates/sample.ts`, `core/tests/fixtures/` and `submission/devpost.md`. The counter-app spec keeps its text about four forms as the record of that earlier work.

## Risk

A fifth button adds a row to the pick list. The layout test at 360x640 may show that a control leaves the first view. If it does, fix the pick list style, and do not remove a check.
