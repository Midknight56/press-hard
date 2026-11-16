# Requirements Document

## Introduction

The counter app is the screen part of the carbon copy app. It lives in `app/`. Two people fill one handover form on one phone, add photos, sign, and press and hold a stamp to seal the record. The app then shows the carbon copy and gives it away as one file. A verify page checks any copy file and shows what changed. This spec also covers the landing page, the privacy page, the usage beacon and the build. All record logic comes from `core/`, which the `record-core` spec builds first.

## Requirements

### Requirement 1: Forms
**User Story:** As a rental shop worker, I want a ready form for a return, so that I start in seconds.

#### Acceptance Criteria
1. THE SYSTEM SHALL offer four forms on the first screen: rental return, key handover, item sold as seen, and blank.
2. THE SYSTEM SHALL define each ready form in `app/src/templates/` as data: a title and a list of fields with id, label, kind, options, unit and whether the line is required.
3. WHEN the blank form is chosen THEN THE SYSTEM SHALL let the user add up to 12 lines, each a text line or a photo.
4. THE SYSTEM SHALL offer a filled sample of the rental return form from the first screen, marked `Sample`, so that a visitor can press the stamp without typing.
5. THE SYSTEM SHALL start every form with a required giver name line and a required receiver name line. These two lines fill `parties.giver` and `parties.receiver` of the record and are not fields.

### Requirement 2: Fill
**User Story:** As two people at a counter, I want to fill the form as on paper, so that nobody needs training.

#### Acceptance Criteria
1. THE SYSTEM SHALL show the form as one paper sheet with each label on its line, and SHALL save a draft to IndexedDB within 1 second after each change.
2. WHEN a photo is added from the camera or from files THEN THE SYSTEM SHALL resize it so that its longer side is at most 1600 px, store it as JPEG, and show its size.
3. IF adding a photo would pass 6 photos or 1,500,000 base64 characters for one photo THEN THE SYSTEM SHALL refuse it and say why in one line.
4. THE SYSTEM SHALL offer a signature box for the giver and one for the receiver, each drawn with a finger, a pen or a mouse, and stored as stroke points from 0 to 1000.
5. WHILE a required line is empty or a signature is missing THE SYSTEM SHALL keep the stamp locked and SHALL mark the first missing line.
6. THE SYSTEM SHALL stop the user at the limits of `record-core`: a text value of 500 characters, and a signature of 4000 points. At a limit it SHALL take no more input and SHALL say so in one line.
7. IF storage is blocked THEN THE SYSTEM SHALL say once that drafts will not be kept, and SHALL still let the user fill, seal and tear off.

### Requirement 3: Press hard
**User Story:** As two people at a counter, I want one clear moment when the form is final, so that we both know when it happened.

#### Acceptance Criteria
1. WHEN the user presses and holds the stamp for 1.2 seconds THEN THE SYSTEM SHALL seal the record with `sealRecord` from `core/`, with the time taken from the device clock at that moment.
2. IF the user lets go before 1.2 seconds THEN THE SYSTEM SHALL seal nothing and the meter SHALL fall back to empty.
3. THE SYSTEM SHALL offer the same action to the keyboard: holding the space key or the enter key on the stamp for 1.2 seconds.
4. WHEN the record is sealed THEN THE SYSTEM SHALL show the top sheet lifting and the carbon copy under it in carbon blue with the same content, and SHALL show the four seal words on both.
5. WHEN the system asks for reduced motion THEN THE SYSTEM SHALL show the copy with a plain fade and no lift.
6. IF `sealRecord` returns problems THEN THE SYSTEM SHALL seal nothing, store no sealed record, and say in one line which line is the problem.

### Requirement 4: Tear off
**User Story:** As the person who takes the copy, I want it as one file on my phone, so that I own it.

#### Acceptance Criteria
1. WHEN the user chooses tear off THEN THE SYSTEM SHALL build the copy file with `buildCopyFile` and SHALL offer it through the share sheet where the browser supports sharing files, and as a download otherwise.
2. THE SYSTEM SHALL name the file `copy-<first seal word>-<second seal word>.html` and SHALL show its size before the user shares it.
3. THE SYSTEM SHALL keep the sealed top copy in the device library and SHALL list sealed records by title, date and seal words.
4. THE SYSTEM SHALL never change a sealed record. The only actions on it are view, tear off again, print, delete with a confirmation box, and `Try to change this copy`, which works on a duplicate (requirement 6).

### Requirement 5: Verify
**User Story:** As either person, I want to check a copy at any time, so that a later edit shows.

#### Acceptance Criteria
1. WHEN a copy file is dropped on or chosen in the verify page THEN THE SYSTEM SHALL parse it with `parseCopyFile`, run `verifyRecord`, and show a large stamp: `Seal matches`, `Changed after sealing` or, for a copy with no seal, `This copy has no seal`.
2. WHEN the user types or pastes seal words or a full seal THEN THE SYSTEM SHALL compare them with the seal stored in the copy and SHALL show `These words belong to another copy` when they differ. Seal words are compared with `sealWords` of the stored seal. A full seal is passed to `verifyRecord` as the expected seal. A changed copy still shows `Changed after sealing`.
3. WHEN two copy files are given THEN THE SYSTEM SHALL show each difference from `diffRecords` on the form line it belongs to, with both values. A difference that has no form line (a photo, a signature, a party name, the time of sealing, a line order) SHALL be listed under the form with its path.
4. IF a file is not a copy file THEN THE SYSTEM SHALL say so in one line and SHALL keep the page working.
5. THE SYSTEM SHALL read a copy file as text only and SHALL never run a script from it.

### Requirement 6: Try to change a copy
**User Story:** As a visitor, I want to try to cheat, so that I believe the seal.

#### Acceptance Criteria
1. WHEN the user chooses `Try to change this copy` on a sealed record THEN THE SYSTEM SHALL open a duplicate in which one line can be edited, and SHALL then verify the duplicate against the original seal.
2. THE SYSTEM SHALL show `Changed after sealing` and mark the edited line, and SHALL leave the original record untouched.

### Requirement 7: Print
**User Story:** As a shop, I want a paper copy too, so that old habits still work.

#### Acceptance Criteria
1. WHEN the user prints a sealed record THEN THE SYSTEM SHALL lay it out on one or more A4 or Letter pages with the seal words and the full seal at the foot of each page, with no page that cuts a photo in two.

### Requirement 8: Layout, look and sound
**User Story:** As a user on a phone, I want every control easy to reach, so that the form is quicker than paper.

#### Acceptance Criteria
1. THE SYSTEM SHALL pass the layout test of the screen standards steering file on every screen at the 7 listed sizes, and the test SHALL name the screen and the control that fails.
2. THE SYSTEM SHALL reach every control with the keyboard alone, with a visible focus mark.
3. THE SYSTEM SHALL make its sounds in code with WebAudio, start none before the first tap, and offer one saved switch for sound.
4. THE SYSTEM SHALL load no font, script, style or image from another site, and a browser test SHALL record every request of the path tests and fail on any request to another origin. The beacon is the one allowed exception, and only when `VITE_BEACON_URL` is set.
5. THE SYSTEM SHALL show an instruction of at most 6 words next to its control and at most three times, after which it lives only on the help screen. A browser test SHALL check that body text on its background has a contrast ratio of 4.5 or more.

### Requirement 9: Path tests
**User Story:** As a maker, I want the whole flow run in a real browser on each change, so that a broken step never ships.

#### Acceptance Criteria
1. THE SYSTEM SHALL run a good path test in a headless browser: pick a form, fill it, add a photo, sign twice, press and hold, see the carbon copy, tear off, load the file in the verify page, see `Seal matches`, change one line of the copy, and see the broken seal with the changed line shown. A second short test SHALL open the sample and seal it.
2. THE SYSTEM SHALL run a bad path test: release the stamp early, add a seventh photo, verify a changed copy, verify a text file that is not a copy, verify a copy with no seal, and use the app with storage blocked.
3. THE SYSTEM SHALL fail either test on any page error or console error.

### Requirement 10: Site, privacy and build
**User Story:** As a judge, I want one link that shows the idea at once, so that I do not need to read first.

#### Acceptance Criteria
1. THE SYSTEM SHALL build a static site with the landing page at `/`, the app at `/app/`, the verify page at `/verify/` and a privacy page at `/privacy/`.
2. THE SYSTEM SHALL show, in the first screen of the landing page and with no tap needed, a short loop of the sample form being pressed, the copy appearing, and one line being changed with the broken seal.
3. THE SYSTEM SHALL send a usage beacon only when the build variable `VITE_BEACON_URL` is set, and then only these events with no id, no time and no form content in the body: `open`, `form_start`, `sealed`, `tear_off`, `verify`, each with the template id. A template id that is not one of the four forms is sent as `other`.
4. THE SYSTEM SHALL list every beacon event and its fields on the privacy page, SHALL state there that the server that receives a beacon also sees the request itself, and SHALL state that form content never leaves the device unless the user shares the copy file. The privacy page SHALL make only claims that a recorded check covers (requirement 8.4 for requests).
5. THE SYSTEM SHALL work offline after the first load, and the build SHALL fail when any `package.json` version is 1.0.0 or higher.
