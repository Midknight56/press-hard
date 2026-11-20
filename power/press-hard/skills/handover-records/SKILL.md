---
name: handover-records
description: Check a Press Hard copy file with verify_copy, name the changed line with diff_copies, and report with the product's words. Use when someone gives you a carbon copy or top copy file, asks if a copy was changed, or asks what a seal means.
---

# Check a copy file

A copy file is one HTML file that holds a handover record and its seal. The tools read the file and change nothing. A relative path means a path inside the folder of the session.

## Before you say anything about a copy

1. Call `verify_copy(path)` on the file. Do this first, for every copy you are given.
2. Read the result: `matches`, `changed`, `unsealed` or `wrong_seal`. Report the seal words that the tool returns.
3. If you are given two copies, call `diff_copies(pathA, pathB)` after `verify_copy` on each.
4. Name the changed line by the path of each difference (for example `fields.mileage.value`) and the value on each side. Copy these from the tool result.

Do not say a copy is good or changed from its name, its look or your memory. If a tool fails, quote its error text and stop.

## Words to use

- a changed copy no longer matches the seal
- seal and seal words
- top copy and carbon copy

## Words never to use

Never say legal proof, tamper proof, secure or certified.

## What a seal shows

A seal shows only that a copy was not changed after it was sealed. It does not show who signed, when, or what really happened. End your report with that sentence.
