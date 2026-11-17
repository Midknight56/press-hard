# Press Hard

The carbon copy form, back to life in the browser. Two people fill one handover form on one phone. They press and hold a stamp. Each leaves with the same sealed copy. A changed copy no longer matches its seal, and the changed line is shown.

Category: Resurrection. Built with Kiro: two specs, four steering files, two hooks, a custom MCP server and 26 property tests.

Live app: link added at submission
Video: link added at submission

## Judging criteria at a glance

**Potential Impact.** Small rental shops and anyone who hands over an item or a key still use paper duplicate books, or nothing. Press Hard gives both sides the same copy on one phone, with no account, no login and no server. It works offline after the first load. A record never leaves the device unless the person shares the copy file.

**Technological Implementation.** Kiro wrote the code from two specs, `record-core` and `counter-app`, each reviewed by Kiro before any code. Four steering files hold the product rules, the record rules, the screen standards and the claims policy. A custom MCP server, `copycheck`, lets Kiro check a copy (`verify_copy`) and compare two copies (`diff_copies`); `docs/kiro-log.md` holds a real transcript of Kiro calling both. 26 correctness properties run as property tests with `fast-check`. Every task went test first: the log records each test failing before the code existed.

**Design.** A complete product, not a proof of concept: pick a form, fill it, add photos, sign, press and hold the stamp, tear off the copy, keep a library, check any copy later, print it. An automatic layout test measures every screen at 7 sizes from 360 by 640 to 1920 by 1080 (16 px edges, 44 px controls, 12 px gaps), and a contrast test checks every text at 4.5 or more. The stamp, paper, torn edge and icon are hand drawn SVG in the form's own palette.

**Innovation/Idea.** It brings back the carbon paper duplicate book and keeps its best part: both people hold the same record. The new part is the seal. The copy is one HTML file with a SHA-256 seal shown as four plain words, so two people can compare copies by reading four words aloud.

**Presentation.** The video shows the whole flow on a phone: fill, press hard, the carbon copy appears, tear off, four words, then a changed copy is caught with the changed line marked.

## How it works

1. Pick a form: rental return, key handover, item sold as seen, or a blank form.
2. Fill it. Add up to 6 photos. Both people sign.
3. Press and hold the stamp. The record is sealed.
4. Tear off the copy. It is one HTML file. The seal is shown as four words.
5. Later, anyone can check a copy at the verify page. A changed copy no longer matches its seal, and the changed line is shown.

## Run it

Node 24.

```bash
npm install
npm run verify
npm run verify:e2e
npm run build
```

`verify` runs the type check, lint and unit tests. `verify:e2e` adds the browser tests, headless. `build` writes the site, the app and the verify page to `dist/`.

## Tests on the last full run

| Suite | Tests | Result |
| --- | --- | --- |
| core: record, seal, copy file, compare | 249 | pass |
| mcp: copycheck server | 15 | pass |
| app: screens, store, art | 382 | pass |
| browser: good path, bad path, layout, carbon copy, contrast, print, offline, site, words on screen, sub path | 35 | pass |

## How Kiro was used

**Kiro IDE, CLI, Web, Crew.** Press Hard was built with the Kiro CLI 3.3.0, run with no person at the keyboard, model Auto. Each task was one CLI run from a written prompt, and each run ended with the verify command. The CLI cannot press the IDE's spec correctness button, so for task 10 of `record-core` Kiro derived the properties by reading every acceptance criterion in `requirements.md` and comparing it with `design.md`. The log says so on that row.

**Custom agents.** None. One CLI agent did every task, guided by the steering files.

**Agent hooks.** Two hooks live in `.kiro/hooks/`: a type check on each TypeScript save, and the full `npm run verify` when the agent finishes a turn. In CLI runs these hooks did not fire, so each prompt ran the verify command itself and the log records each result.

**Spec driven development.** Two specs. `record-core` is the record, the canonical text, the SHA-256 seal, the seal words, the copy file and the compare. `counter-app` is every screen built on it. Kiro reviewed each spec first and fixed the gaps it found before any code. Then each task went test first, and each log row records the failing test, the passing run and the files touched. Compared with vibe coding, nothing was built that a requirement did not ask for, and every requirement has a test.

**Steering docs.** `product.md` holds the flow, the words to use and never use, and the limits. `record-rules.md` holds the record format and the seal. `ui-standards.md` holds edges, sizes and contrast. `claims-policy.md` holds what the product may claim. The words rule made the biggest difference: the app never says "tamper proof" or "secure"; it says "a changed copy no longer matches the seal", and a test checks for the banned words.

**MCP.** The `copycheck` server (`mcp/src/server.ts`) gives Kiro two tools. With them Kiro checked a real copy file and a changed one, and named the changed field: `fields.mileage.value`, 48210.5 changed to 12.5. The full call list is in `docs/kiro-log.md`.

**Property based testing.** 26 properties: 7 from the design and 19 derived from the requirements. They cover the copy file round trip, the seal changing when any field changes, the seal words, the canonical text, the record limits and the compare. No property found a bug in the finished code. To prove they can fail, two faults were put in by hand and then removed: dropping the key sort in the canonical text failed property 1, and a broken value compare failed property 6.

**Kiro powers.** None.

## Licence

MIT. Every asset in the repository is original work made for it. System fonts only.
