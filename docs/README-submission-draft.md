# Press Hard (draft, not published)

The carbon copy form, back to life in the browser. Two people fill one handover form on one phone. They press and hold a stamp. Each leaves with the same sealed copy. A changed copy no longer matches its seal, and the changed line is shown.

Category: Resurrection. Built with Kiro: two specs, steering, hooks, a custom MCP server and property tests.

Live app: TODO link. Video: TODO link.

## Judging criteria at a glance

**Potential Impact.** Small rental shops and anyone who hands over an item or a key still use paper duplicate books, or nothing. Press Hard gives both sides the same copy on one phone, with no account, no login and no server. It works offline after the first load. A record never leaves the device unless the person shares the copy file.

**Technological Implementation.** Kiro wrote the code from two specs (`record-core` and `counter-app`, 28 tasks in all), each reviewed by Kiro before any code. Four steering files hold the product rules, record rules, screen standards and claims policy. A custom MCP server, `copycheck`, lets Kiro check a copy (`verify_copy`) and compare two copies (`diff_copies`); the log holds a real transcript of Kiro calling both. 26 correctness properties run as property tests with fast-check. Every task went test first: the log records each test failing before the code existed.

**Design.** A complete product, not a proof of concept: pick a form, fill it, add photos, sign, press and hold the stamp, tear off the copy, keep a library, check any copy later, print it. Every screen is measured at 7 sizes from 360 by 640 to 1920 by 1080 by an automatic layout test (16 px edges, 44 px controls, 12 px gaps) and a contrast test (4.5 or more). The art is hand drawn SVG in the form's own palette.

**Innovation/Idea.** It brings back the carbon paper duplicate book and keeps its best property: both people hold the same record. The modern part is the seal. The copy is one HTML file with a SHA-256 seal shown as four plain words, so two people can compare copies by reading four words aloud.

**Presentation.** The video shows the whole flow on a phone: fill, press hard, the carbon copy appears, tear off, four words, then a changed copy is caught with the changed line marked. TODO: check against the final video.

## How it works

1. Pick a form: rental return, key handover, item sold as seen, or a blank form.
2. Fill it. Add up to 6 photos. Both people sign.
3. Press and hold the stamp. The record is sealed.
4. Tear off the copy. It is one HTML file. The seal is shown as four words.
5. Later, anyone can check a copy at the verify page. A changed copy no longer matches its seal, and the changed line is shown.

## Run it

```bash
npm install
npm run verify
npm run verify:e2e
npm run build
```

`verify` runs the type check, lint and unit tests. `verify:e2e` adds the browser tests (headless). Node 24.

## Test results on the last full run

| Suite | Tests | Result |
| --- | --- | --- |
| core (record, seal, copy file, compare) | 246 | pass |
| mcp (copycheck server) | 15 | pass |
| app (screens, store, art) | 347 | pass |
| browser (good path, bad path, layout, contrast, print, offline, site) | 27 | pass |

TODO: refresh these numbers after the last gate.

## How Kiro was used

**Kiro IDE, CLI, Web, Crew.** This entry was built with the Kiro CLI 3.3.0, run with no person at the keyboard, model Auto. Each task was one CLI run from a written prompt. The CLI cannot press the IDE's spec correctness button, so for task 10 of `record-core` Kiro derived the properties by reading every acceptance criterion in `requirements.md` and comparing it with `design.md`. The log says so on that row.

**Custom agents.** TODO: none used, or name them.

**Agent hooks.** Two hooks are defined in `.kiro/hooks/`: a type check on each TypeScript save, and the full `npm run verify` when the agent finishes a turn. In CLI runs no hook fired, so each prompt ran the verify command itself and the log records the result. The log has a table of hooks seen to fire.

**Spec driven development.** Two specs. `record-core` is the record, the canonical text, the SHA-256 seal, the seal words, the copy file and the compare. `counter-app` is every screen built on it. Kiro reviewed each spec first and fixed gaps before code. Then each task went test first, and each log row records the failing test, the passing run and the files touched. Compared with vibe coding, nothing was built that a requirement did not ask for, and every requirement has a test.

**Steering docs.** `product.md` (the flow, the words to use and never use, the limits), `record-rules.md` (the record format and seal), `ui-standards.md` (edges, sizes, contrast) and `claims-policy.md`. The words rule had the biggest effect: Kiro never wrote "tamper proof" or "secure"; it wrote "a changed copy no longer matches the seal".

**MCP.** The `copycheck` server (`mcp/src/server.ts`) gives Kiro two tools. With them Kiro checked a real copy file and a changed one, and named the changed field (`fields.mileage.value`, 48210.5 changed to 12.5). The full call list is in `docs/kiro-log.md`.

**Property based testing.** 26 properties: 7 from the design (task 9) and 19 derived from the requirements (task 10). They cover the round trip of the copy file, the seal changing when any field changes, the seal words, the canonical text and the record limits. TODO: state whether any property found a bug.

**Kiro powers.** TODO: none used, or name them.

## Licence

MIT. Every asset in the repository is original work made for it. System fonts only.
