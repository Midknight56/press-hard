# Requirements Document

## Introduction

Tool loan is a fifth ready form for the counter app in `app/`. A tool library or a neighbour who lends a drill uses it to record who took which tool, in what condition, and when it comes back. It works like the four existing forms: it is data in `app/src/templates/`, it is filled, signed and pressed like any form, and its copy file is checked like any copy. This spec changes no file in `core/`.

## Requirements

### Requirement 1: The form exists
**User Story:** As a tool library volunteer, I want a ready form for lending a tool, so that I do not build one on the blank form each time.

#### Acceptance Criteria
1. THE SYSTEM SHALL define a template with id `tool-loan` and title `Tool loan` in `app/src/templates/tool-loan.ts`, with the fields listed in `design.md` in that order.
2. THE SYSTEM SHALL list the five forms in this order: rental return, key handover, item sold as seen, tool loan, blank.
3. THE SYSTEM SHALL start the form with the required giver name line and the required receiver name line, as every form does. These lines fill `parties` and are not fields.

### Requirement 2: Fill
**User Story:** As a neighbour lending a drill, I want to name the tool and say what shape it is in, so that we agree before it leaves.

#### Acceptance Criteria
1. WHILE the `Tool`, `Condition` or `Return by` line is empty THE SYSTEM SHALL keep the stamp locked and SHALL mark the first missing line.
2. THE SYSTEM SHALL offer `good`, `worn` and `damaged` as the only values of `Condition`.
3. THE SYSTEM SHALL show `CA$` as the unit of `Deposit` and accept a number with at most 3 decimal places.
4. WHILE `Marking or serial`, `Deposit`, `Notes` and `Photo of the tool` are empty THE SYSTEM SHALL still allow the stamp.

### Requirement 3: Seal and check
**User Story:** As a lender, I want the copy to show if anyone changes the return date later, so that we both trust the paper.

#### Acceptance Criteria
1. WHEN a filled Tool loan form is pressed THEN THE SYSTEM SHALL seal it and build a copy file that `validateRecord` accepts.
2. WHEN one line of a Tool loan copy is changed THEN THE SYSTEM SHALL show that the copy no longer matches the seal and mark the changed line.

### Requirement 4: Pick screen
**User Story:** As a first time user, I want to find Tool loan on the first screen, so that I start in seconds.

#### Acceptance Criteria
1. THE SYSTEM SHALL show a `Tool loan` button with `data-control="pick-tool-loan"` on the first screen, between the item sold as seen button and the blank form button.
2. THE SYSTEM SHALL keep every control on the first screen inside the layout limits at all seven screen sizes of the layout test.

### Requirement 5: Usage beacon and privacy page
**User Story:** As a visitor, I want the privacy page to match what the app sends, so that I can trust it.

#### Acceptance Criteria
1. THE SYSTEM SHALL send `tool-loan` as the `template` value for this form and SHALL keep sending `other` for any id that is not in the list of the five forms.
2. THE SYSTEM SHALL say `five forms` on the privacy page and in the beacon comments and test names that now say `four forms`.

### Requirement 6: Checks and records
**User Story:** As the owner, I want the change checked in a browser and logged, so that the claim has a record.

#### Acceptance Criteria
1. THE SYSTEM SHALL add one step for Tool loan to the good path test and one to the bad path test.
2. THE SYSTEM SHALL pass `npm run verify` and `npm run verify:e2e`.
3. THE SYSTEM SHALL add one row to `docs/kiro-log.md` for each finished task and leave the Credits cell empty.
