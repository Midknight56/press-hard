---
inclusion: always
---
# Product

## What this repository is
A carbon copy form for the browser. Two people fill one handover form on one phone, press hard, and each leaves with the same sealed copy.

## Who it is for
Small rental shops first. Also anyone who hands an item or a key to another person.

## The flow
1. Pick a form: rental return, key handover, item sold as seen, or a blank form.
2. Fill it. Add up to 6 photos. Both people sign.
3. Press and hold the stamp. The record is sealed.
4. Tear off the copy. It is one HTML file. The seal is shown as four words.
5. Later, anyone can check a copy. A changed copy no longer matches its seal, and the changed line is shown.

## Words
- Say "top copy", "carbon copy", "seal" and "seal words".
- Never say "legal proof", "tamper proof", "secure" or "certified". Say "a changed copy no longer matches the seal".
- Write plain short sentences. No sales words.
- The product name lives only in `app/app.config.ts`.

## Limits that always hold
- No account, no login, no server. The app works offline after the first load.
- No AI model and no paid service is called.
- A record never leaves the device unless the user shares the copy file.
- Code, drawings and sounds in the repository are original work made for it. The fonts are Gochi Hand, Rubik Mono One, Saira and Saira Condensed, bundled in app/src/fonts under the SIL Open Font Licence, with the licence texts beside them.
- The version stays below 1.0.
- Write every text file as UTF-8 with no byte order mark and with LF line endings. On Windows, do not write files with PowerShell `Set-Content` or `Out-File`.
