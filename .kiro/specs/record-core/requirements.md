# Requirements Document

## Introduction

The record core is the part of the carbon copy app that has no screen. It defines a handover record, turns it into one canonical text, seals it with SHA-256, shows the seal as four words, builds the copy file, reads a copy file back, checks it, and lists what differs between two records. It also holds a small MCP server with two tools so that an AI coding tool can check a copy file. The form app in the `counter-app` spec depends on this spec.

## Requirements

### Requirement 1: Record
**User Story:** As a user, I want everything about a handover in one record, so that one seal covers all of it.

#### Acceptance Criteria
1. THE SYSTEM SHALL define a record with `format` 1, `form` (template id and title), `sealedAt`, `parties` (giver and receiver names), `fields`, `photos` and `signatures`, as in the design.
2. WHEN `validateRecord(value)` is called THEN THE SYSTEM SHALL return a list of problems that names the path of each bad value, and an empty list for a good record.
3. THE SYSTEM SHALL refuse a record with more than 40 fields, more than 6 photos, a photo over 1,500,000 base64 characters, a text value over 500 characters, or a signature with more than 4000 points.
4. THE SYSTEM SHALL refuse a field of kind `photo` whose `photoDigest` matches no photo in the record.

### Requirement 2: Canonical text
**User Story:** As a user, I want the same record to always give the same seal, so that two devices agree.

#### Acceptance Criteria
1. THE SYSTEM SHALL produce one canonical text for a record: keys sorted by code unit order, no spaces, arrays in their order.
2. THE SYSTEM SHALL produce the same canonical text for two records that are deep equal, whatever the order in which keys were added.
3. THE SYSTEM SHALL leave the `seal` key out of the canonical text.

### Requirement 3: SHA-256
**User Story:** As a user, I want the copy file to check itself when opened from disk, so that I need no app and no network.

#### Acceptance Criteria
1. THE SYSTEM SHALL include its own SHA-256 function that takes bytes and returns 64 lower case hex characters, with no dependency.
2. THE SYSTEM SHALL return `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` for empty input and `ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad` for the three bytes of `abc`.
3. THE SYSTEM SHALL return the same result as the platform's own SHA-256 for any input of 0 to 5000 bytes.

### Requirement 4: Seal and seal words
**User Story:** As two people at a counter, I want a seal we can say out loud, so that we both know we hold the same copy.

#### Acceptance Criteria
1. WHEN `sealRecord(record, sealedAt)` is called with a valid record and a time text THEN THE SYSTEM SHALL return the record with `sealedAt` set and `seal` set to the SHA-256 of the canonical text.
2. THE SYSTEM SHALL refuse to seal a record that has problems or that already has a seal.
3. WHEN `sealWords(seal)` is called THEN THE SYSTEM SHALL return four words joined with `-`, taken from a list of exactly 256 words by the first four bytes of the seal.
4. THE SYSTEM SHALL keep 256 different lower case English words of 3 to 6 letters in the list.

### Requirement 5: Copy file
**User Story:** As the person who takes the copy, I want one file that opens in any browser, so that I can read and check it years later.

#### Acceptance Criteria
1. WHEN `buildCopyFile(sealedRecord, options)` is called THEN THE SYSTEM SHALL return the text of one HTML document that shows every field, photo and signature, holds the record as JSON in a `script` element with id `record`, and holds an inline check script.
2. THE SYSTEM SHALL write every `<` inside the embedded JSON as `<`.
3. THE SYSTEM SHALL build a copy file that loads nothing from the network: no outside script, style, font or image.
4. WHEN a copy file is opened in a browser THEN its check script SHALL compute the seal again and SHALL show `Seal matches this copy` or `This copy was changed after sealing`.
5. WHEN `parseCopyFile(text)` is called with the text of a copy file THEN THE SYSTEM SHALL return the record, and SHALL return a typed error for text with no record element or with JSON that does not parse.

### Requirement 6: Check and compare
**User Story:** As either person, I want to check a copy and see what changed, so that an edit cannot hide.

#### Acceptance Criteria
1. WHEN `verifyRecord(record)` is called THEN THE SYSTEM SHALL return `matches` when the stored seal equals the seal computed from the record, `changed` when it differs, and `unsealed` when there is no seal.
2. WHEN `verifyRecord(record, expectedSeal)` is called THEN THE SYSTEM SHALL also return `wrong_seal` when the record matches its own seal but not the expected one.
3. WHEN `diffRecords(a, b)` is called THEN THE SYSTEM SHALL return one entry for each difference: the field id or the path, the value in `a` and the value in `b`. For a photo it SHALL return the photo digests, not the image data.
4. THE SYSTEM SHALL return an empty list from `diffRecords` exactly when the two canonical texts are equal.

### Requirement 7: Tool server
**User Story:** As a maker using an AI coding tool, I want the tool to check a copy file, so that the check is part of my workflow.

#### Acceptance Criteria
1. WHEN `node mcp/dist/server.js` runs THEN THE SYSTEM SHALL serve MCP over standard input and output with exactly two tools: `verify_copy` and `diff_copies`.
2. WHEN `verify_copy` is called with a file path and an optional expected seal THEN THE SYSTEM SHALL return the result of `verifyRecord`, the seal, the seal words, the form title, the party names and the number of photos. It SHALL not return photo data.
3. WHEN `diff_copies` is called with two file paths THEN THE SYSTEM SHALL return the list from `diffRecords`.
4. IF a path is missing, is not a file, is over 20 MB, or is not a copy file THEN THE SYSTEM SHALL return an error result with a code and SHALL not crash.
5. THE SYSTEM SHALL read files only. It SHALL write no file.
