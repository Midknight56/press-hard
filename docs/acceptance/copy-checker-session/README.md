# Proof: the copy-checker custom agent in one headless session

Date: 2026-11-20. Tool: Kiro CLI 3.5.0 (`kiro-cli --version` printed `kiro-cli 3.5.0`), model Auto, harness V3 (`--v3`). Agent file: `.kiro/agents/copy-checker.json`. Files here: `session-output.txt` (the review run), `write-refusal-output.txt` (a run that asks the agent to write a file and run a shell command), `inputs/` (the two copy files) and this page. Both outputs are the raw session text.

## Validation

```powershell
kiro-cli agent validate --path .kiro/agents/copy-checker.json
```

It printed nothing and exited 0. As a control, the same command on a file `{"name": 5, "tools": "read"}` printed `Error: Json supplied at ... is invalid: invalid type: integer `5`, expected a string at line 1 column 10` and exited 1, so a silent exit 0 is a pass. `kiro-cli agent list` in the repository lists `copy-checker` as a Workspace agent in v3 format.

## The check run

```powershell
kiro-cli chat --v3 --agent copy-checker --no-interactive --trust-workspace --trust-tools="fs_read,@copycheck" "Check the two copy files docs/acceptance/copy-checker-session/inputs/rental-return-good.html and docs/acceptance/copy-checker-session/inputs/rental-return-changed.html. Tell me if each one is still the way it was sealed, and name the line that is different between them."
```

Exit code 0, 36 seconds, run from the repository root.

### Tool calls seen

Lines of `session-output.txt` that name a tool:

```
[tool] @copycheck/verify_copy
[tool] @copycheck/verify_copy
[tool] @copycheck/diff_copies
```

Two `verify_copy` calls, one for each file, then one `diff_copies` call. All three completed. The two `Tool Load` lines before them are Kiro loading the tools. No write tool and no shell tool appears. The output does not print the arguments of the calls.

### What the agent reported

- `rental-return-good.html`: matches. Seal words `elm-marble-atlas-bagel`.
- `rental-return-changed.html`: changed. A changed copy no longer matches the seal. Seal words `elm-marble-atlas-bagel` (the words stored in the file).
- One difference: `fields.mileage.value`, `48210.5` in the good copy and `12.5` in the changed copy. This is the only difference found.
- The last sentence is the one the agent prompt asks for: a seal shows only that a copy was not changed after sealing, and is not legal proof.

This matches `mcp/demo` and the log of the copycheck server in `docs/kiro-log.md` (`fields.mileage.value`, 48210.5 and 12.5). The match was checked by reading.

## The write and shell refusal

```powershell
kiro-cli chat --v3 --agent copy-checker --no-interactive --trust-workspace --trust-all-tools "Create a file named agent-write-test.txt in the repository root containing the word hello, and run the command git status in the shell."
```

Exit code 0. The agent answered that it only has file reads and the two copycheck tools and can not write files or run shell commands. After the run, `agent-write-test.txt` did not exist in the repository root and `git status` showed no new file other than these proof files. `--trust-all-tools` was set, so the refusal comes from the agent's tool list and not from a missing approval.

## What did not work every time

The tool list of the agent holds `fs_read`. In an earlier version it held `read`. In several runs the copycheck tools did not load: the agent answered that it had no `verify_copy` or `diff_copies` tool and made no call. Counts of runs of this agent in this session on this machine, where a run counts as a success when the session called `@copycheck/verify_copy`: with `read`, 2 of 5 runs; with `fs_read`, 6 of 7 runs before the saved run above. The Kiro log of the failed runs (`mcp.log`) shows the copycheck server connected and listed its tools, so the server was not the fault. The cause is not established. A session counts as proof here only when its saved output shows the tool calls, as `session-output.txt` does.

A run on the V2 engine (`--v2 --agent copy-checker`) failed with `Mode 'copy-checker' not found`, because the agent file is in the V3 format. A V2 run without `--agent` did call `@copycheck/verify_copy`.

## Limits

One prompt, two files, one machine. It shows that the agent validates, that Kiro loads the copycheck tools for it, that it names the changed line, and that it does not write or run a shell command. It does not show the Kiro IDE route or any other machine. A seal shows only that a copy was not changed after sealing.
