# Requirements Document

## Introduction

Press Hard has a small MCP server, `copycheck`, with two tools: `verify_copy` and `diff_copies`. This spec packages that server for other Kiro users as a power, adds one custom agent that checks copy files, and prepares the input files for the proof sessions that the lead runs later. It adds no app code and changes no file in `core/src/`, `app/src/` or `mcp/src/`.

## Requirements

### Requirement 1: Power
**User Story:** As a Kiro user who clones this repository, I want to install one power, so that Kiro can check a copy file and knows the rules for talking about the result.

#### Acceptance Criteria
1. THE SYSTEM SHALL hold a power in `power/press-hard/` in the Agent Plugins format: `plugin.json`, `mcp.json`, `README.md` and `skills/`.
2. THE `plugin.json` SHALL have the name `press-hard`, a semantic version below 1.0.0, a description, an author with a name, at least 4 keywords and the licence `MIT`.
3. THE `mcp.json` SHALL start the server file that `npm run build --workspace mcp` writes (`mcp/dist/server.js`). It SHALL read the full path of that file from `PRESS_HARD_MCP_DIST` and the folder of the session from `PRESS_HARD_WORKSPACE`, and it SHALL hold no drive path and no user name.
4. THE power SHALL not carry the server code.
5. THE skill `skills/handover-records/SKILL.md` SHALL have a name and a description in its front matter, and SHALL tell the agent to call `verify_copy` on a copy before saying anything about it, to call `diff_copies` to name the changed line, which words to use and not to use, and that a seal shows only that a copy was not changed after it was sealed.
6. THE skill SHALL name only tools that the server lists.
7. THE `README.md` of the power SHALL give the install command, the needs (Node 24, `npm install`, `npm run build`, the two variables), the use and the uninstall command.

### Requirement 2: Custom agent
**User Story:** As a user, I want an agent that can only read files and check copies, so that I can give it a copy file without giving it the power to change anything.

#### Acceptance Criteria
1. THE SYSTEM SHALL hold `.kiro/agents/copy-checker.json` with a name, a description and a prompt.
2. THE agent SHALL list only `read`, `@copycheck/verify_copy` and `@copycheck/diff_copies` as tools. It SHALL have no write tool, no shell tool, no `allowedTools` and no `toolsSettings`.
3. THE agent SHALL set `includeMcpJson` to true and `includePowers` to false.
4. THE prompt SHALL tell the agent to call `verify_copy` on each given file first, and `diff_copies` when two files are given.
5. THE prompt SHALL tell the agent to report the result (matches, changed, unsealed or wrong_seal), the seal words, and each difference as its path with the value on each side.
6. THE prompt SHALL tell the agent to use the product's words, to quote the error text of a failed tool and stop, and to end with one sentence that a seal shows only that a copy was not changed after sealing and is not legal proof.
7. WHEN `kiro-cli agent validate --path .kiro/agents/copy-checker.json` is run THEN it SHALL exit 0.

### Requirement 3: Proof inputs
**User Story:** As the owner, I want fixed input files for the proof sessions, so that each session checks the same pair of copies.

#### Acceptance Criteria
1. THE SYSTEM SHALL hold `rental-return-good.html` and `rental-return-changed.html` in `docs/acceptance/copy-checker-session/inputs/` and in `docs/acceptance/power-session/inputs/`, copied from the output of `mcp/scripts/make-demo-copies.ts`.
2. WHEN `verifyCopy` is called on the good file THEN it SHALL return `matches`. WHEN it is called on the changed file THEN it SHALL return `changed`.
3. EACH of the two folders SHALL hold a `README.md` that says what the files are.
4. THE proof pages SHALL be written by the lead after real sessions. Until then two tests stay red: one for each session folder. They SHALL not be weakened.

### Requirement 4: Words and claims
**User Story:** As the owner, I want every new text to follow the product words and the claims policy.

#### Acceptance Criteria
1. THE new texts SHALL use "top copy", "carbon copy", "seal" and "seal words", and SHALL name "legal proof", "tamper proof", "secure" and "certified" only as words never to use.
2. NO new file SHALL name a prize, a budget or another project.
3. EACH finished task SHALL add one row to `docs/kiro-log.md`.
