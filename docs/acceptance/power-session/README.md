# Proof: the press-hard power in one headless Kiro session

Date: 2026-11-20. Tool: Kiro CLI 3.5.0, model Auto, harness V3 (`--v3`). The power is `power/press-hard/`. Files here: `session-output.txt` (the raw output of the session), `inputs/` (the two copy files) and this page.

## Commands, in the order they ran

From the repository root, after `npm install` and `npm run build`, in a shell where the two variables of the power are set:

```powershell
$env:PRESS_HARD_MCP_DIST = (Resolve-Path mcp/dist/server.js).Path
$env:PRESS_HARD_WORKSPACE = (Resolve-Path ../press-hard-logs/power-run).Path
kiro-cli powers install power/press-hard
```

Output: `Installed power "press-hard"`. Before it, `~/.kiro/powers/installed.json` listed `"installedPowers": []`. After it, the list held `press-hard`.

The session folder held only the two copy files of `inputs/` and no `.kiro` folder, so the session had no workspace MCP configuration of its own: the copycheck tools could come only from the power. Then, from that folder:

```powershell
kiro-cli chat --v3 --no-interactive --trust-workspace --trust-tools="kiro_powers,@copycheck" "In this folder, is the copy file rental-return-good.html still the way it was sealed? And what is different in rental-return-changed.html compared with it?"
```

The prompt names no tool. Exit code 0, 11 seconds, on the first try.

```powershell
kiro-cli powers uninstall press-hard
```

Output: `Uninstalled power "press-hard"`. After it, `~/.kiro/powers/installed/` held no folder and `installed.json` listed `"installedPowers": []`. The power is not loaded into later sessions on this machine.

## Tool calls seen

Lines of `session-output.txt` that name a tool:

```
[tool] Kiro Powers
[tool] Tool Load
[tool] Tool Load
[tool] @press-hard/copycheck/verify_copy
[tool] @press-hard/copycheck/verify_copy
[tool] @press-hard/copycheck/diff_copies
```

`Kiro Powers` is Kiro reading the installed power. `Tool Load` is Kiro loading its tools. The three calls are the `verify_copy` tool called on each file and the `diff_copies` tool called on both, from the server `copycheck` of the power `press-hard`. All three completed. The output does not print the arguments of the calls. No shell call and no write call appears.

## What the session answered

- `rental-return-good.html`: `matches`, seal words `elm-marble-atlas-bagel`.
- `rental-return-changed.html`: `changed`.
- One difference: `fields.mileage.value`, `48210.5` in the good copy and `12.5` in the changed copy.

These match the demo of `mcp/demo` and `docs/acceptance/copy-checker-session/README.md`. The match was checked by reading.

## Limits

One session, one prompt, one machine. It shows that the power installs, that Kiro loads it and calls both of its tools on files of the session folder, and that the power can be uninstalled. It does not show that Kiro read the skill `handover-records` (the output does not say so). Whether the session followed the skill is not claimed. It does not show the IDE route or any other machine. A seal shows only that a copy was not changed after sealing.
