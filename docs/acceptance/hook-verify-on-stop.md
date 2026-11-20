# Observation: verify-on-stop

Hook file: `.kiro/hooks/verify-on-stop.json` (trigger `Stop`, command `npm run verify`, timeout 900).

## Result

Result: fired. In a headless Kiro CLI 3.5.0 session (harness V3, `--v3`, model Auto), the `Stop` hook ran `npm run verify` when the agent finished its turn, and its output reached the session. This replaces the sentence "these hooks did not fire in CLI runs" that the README, the Devpost page and `docs/kiro-log.md` carried until 2026-11-20. That sentence was true of the CLI 3.3.0 runs of 16 and 17 November, where no hook output was seen in any log. It is not true of CLI 3.5.0 on 20 November.

The hook `typecheck-on-save` (trigger `PostFileSave`) was not seen to fire in a CLI session. See the end of this page.

## Headless observation of 2026-11-20

Command, from the repository root (the agent is `copy-checker` so that the session can not write a file or run a shell command; its tools are file reads and the two copycheck tools):

```powershell
kiro-cli chat --v3 --agent copy-checker --no-interactive --trust-workspace "Reply with the single word ready. Do not call any tool. If hook output reaches you after that, quote its first line and its last line exactly, and say which command it came from."
```

Exit code 0, 23.7 seconds (13:52:03 to 13:52:27, machine clock). The prompt asks for one word and no tool call, so nothing in the session ran `npm`.

### Output of the session

```
[INFO] [KRS] <-- GenerateAssistantResponseCommand done totalEvents=9
readyFirst line: `⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯`

Last line: `npm error command C:\Windows\system32\cmd.exe /d /s /c vitest run`

It came from `vitest run`, which `npm test` ran in the `mcp` workspace (`mcp@0.1.0`).
```

The agent answered `ready` first and then quoted hook output that it had not asked for. The text it quotes is the output of the test step of `npm run verify` in the `mcp` workspace of this repository. At that time one case failed on purpose: the proof page `docs/acceptance/power-session/README.md` did not exist yet, and `mcp/tests/extensions.test.ts` case 4.1 was red until it did. A hook that fails is a defect to read and fix, not a sign that it did not run.

### Process poll

A poll (`D:\Projects\kiroween\press-hard-logs\hook\poll.ps1`, outside the repository) listed every new process whose command line holds `npm` and one of `verify`, `typecheck`, `vitest` or `eslint`, every 250 ms. The poll saw other work on the machine too; the lines that belong to this repository are:

```
13:52:06.691 pid 45364 cmd.exe /d /s /c "npm run verify"
13:52:07.213 pid 53644 node.exe (npm)
13:52:07.214 pid 46700 cmd.exe /d /s /c npm run typecheck && npm run lint && npm run test
13:52:07.750 pid 45240 cmd.exe /d /s /c node core/scripts/gen-check.ts && tsc --noEmit -p core/tsconfig.json && npm run typecheck --workspace mcp && ...
```

The command `npm run verify` started 3.7 seconds after the session did, and its child chain `npm run typecheck && npm run lint && npm run test` is the `verify` script of this repository's `package.json`. The hook is the only thing in the run that names `npm run verify`: the prompt, the agent's tools and the agent's prompt do not. The poll does not show which process of Kiro started it.

### Other sightings

Every headless V3 session run in this repository on 20 November after the proof pages became red (the agent runs saved in `docs/acceptance/copy-checker-session/session-output.txt` and `write-refusal-output.txt`) ends with the agent describing the failing test output of the same chain, which nobody had asked it to run. Those are repeats of this observation, not separate proof.

## The save hook

`typecheck-on-save` (trigger `PostFileSave`) was not seen to fire in a CLI session. Its trigger is the save of a file in an editor. A headless session writes files through the agent's tools, and no hook output for a save was seen in any CLI run. In the Kiro IDE it did fire once, from a file the agent saved with its edit tool; it did not fire for a file written by a shell command. That is recorded in `docs/acceptance/ide-session/`.

## Limits

One machine, one version (3.5.0), one prompt. It shows that a `Stop` hook of this repository runs at the end of a headless V3 turn and that its output reaches the session. It does not show how often it fires, or that it fires on other versions.
