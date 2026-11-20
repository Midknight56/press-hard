# Design Document

## Overview

One new test file and one edit of one steering file. The test reads files only. It starts no app and no browser.

```
core/tests/steering-forms.test.ts   the check (new file)
.kiro/steering/product.md           names all five forms (edited in task 2)
docs/kiro-log.md                    one row for tasks 1 and 2 (task 3)
```

## The test

The file follows `core/tests/readme-top.test.ts`. It takes the repository root from `import.meta.url`, reads files with `readFileSync` from `node:fs`, and replaces `\r\n` with `\n` before it reads lines. It imports nothing from `app/`, so `core` gets no new dependency on the app, and no package is added.

Steps:

1. Read `app/src/templates/index.ts`. Find the array assigned to `templates`. Take the names in it, in order. Match each name to its `import { name } from './file.js'` line, and so to the file `app/src/templates/file.ts`.
2. For each such file, read it and take the first `title: '...'` string. That is the title of the template. A single quoted or double quoted string is accepted.
3. Read `.kiro/steering/product.md`.
4. For each title, check that the steering text contains it, ignoring case. One `it` case runs per title, named after the title, so a failure names the missing form. The text of the failure says the title and the steering file.

Guards, so that the test cannot pass by finding nothing:

- One case checks that `index.ts` yields at least 5 template names, that every name matches an import, and that every file yields a title.
- The titles today are `Rental return`, `Key handover`, `Item sold as seen`, `Tool loan` and `Blank form`. The test does not list them. It reads them, so a new template is checked without an edit of the test.

The test lives in a new file, `core/tests/steering-forms.test.ts`, and not in an existing one, because no existing file in `core/tests/` reads steering. The run command is `npx vitest run tests/steering-forms.test.ts` inside `core`.

## The steering fix

Step 1 of "The flow" becomes a list of the five forms, in the order of the app: rental return, key handover, item sold as seen, tool loan, or a blank form. Task 2 also searches the file for any other line that says four forms. At the time of writing the text "Who it is for" and the other sections hold no such count, but the task checks the whole file and does not assume. Nothing else in the file changes.

## Limits of the check

The test shows that each title appears somewhere in `product.md`, not that it appears in step 1. It does not check the order of the forms. It does not read a title that is built in code instead of written as a string in the template file. If a template file is changed that way, the guard case fails and the test is updated then.

## Correctness properties

None. This is a file check, not the behaviour of a function over a range of inputs.
