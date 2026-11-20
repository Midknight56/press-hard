# Kiro IDE session, 20 November 2026

The Kiro IDE was opened on this repository, on the side display, with a small spec of its own (`.kiro/specs/steering-forms/`). Kiro IDE ran the three tasks from the `Start task` links of `tasks.md`, then two requests in chat. Facts below were read from the screen (the screenshots here), from the process list, and from the files.

## What was seen

| Step | What was seen | File |
| --- | --- | --- |
| Window on the side display | The IDE window was at `left=-1998 top=40 right=-94 bottom=1092` in the window list taken while it ran (3:28:37 PM). The main display is at x 0. A guard script moved any Kiro window to x -1998. Its log holds only the start and stop lines; the window was already at x -1998 at the first check, about a minute after the start. | `window-list.txt` |
| Restricted Mode | The folder opened in Restricted Mode. The IDE showed a banner and the Workspace Trust page; the folder was trusted from that page. | none |
| Spec tasks | `tasks.md` shows a `Start task` link above each task. Task 1 added `core/tests/steering-forms.test.ts` and ran it: 6 tests, 5 passed, 1 failed, and the failing case was the one that checks the steering names Tool loan, as the task asks. Task 2 changed `.kiro/steering/product.md` so that it names all five forms, and the test then passed 7 of 7. Task 3 added a row to `docs/kiro-log.md`. The IDE ticked the three tasks. | `01-tasks-start-task-links.jpg`, `03-task-1-running-approval.jpg`, `04-task-1-done-test-fails-as-asked.jpg`, `07-task-2-done.jpg`, `08-task-3-done.jpg` |
| Credits shown by the IDE | Task 1: 1.09 credits in 53 s. Task 2: 1.30 in 1 min 51 s. Task 3: 1.64 in 3 min 45 s. | the screenshots above |
| Hooks start switched off | The Agent Hooks panel listed both hooks of `.kiro/hooks/` as `(disabled)`. The eye icon beside each wrote `"enabled": true` into its file and the IDE rewrote the JSON in its own layout. The label stayed until `Developer: Reload Window`; after the reload both hooks showed their triggers, `PostFileSave` and `Stop`, with no label. The hook files were put back to their committed text after the session. | `02-agent-hooks-panel-disabled.jpg`, `05-after-reload-hooks-enabled-mcp-steering.jpg` |
| MCP and steering | After the reload the IDE listed the four steering files of `.kiro/steering/` and the `copycheck` MCP server as `Connected (2 tools)`. | `05-after-reload-hooks-enabled-mcp-steering.jpg` |
| Turn end hook | At the end of each turn the chat showed a row `Run Command Hook verify-on-stop`, and `npm run verify` started on the machine: 15:20:06, 15:20:43, 15:21:11 and 15:23:38. | `hook-process-log.txt`, `06-agent-edit-hook-triggered.jpg` |
| Save hook, first try | A request in the task chat made the agent write the new test case with a PowerShell command. No `npm run typecheck` started. The agent answered that in that task session it had no file edit tool, only the shell. | `hook-process-log.txt` |
| Save hook, edit tool in a new chat | A request in a new chat session made the agent add one comment line to `core/tests/steering-forms.test.ts` with its file edit tool. The chat showed `1 tool call · 1 hook triggered`. The process list shows `cmd.exe /d /s /c "npm run typecheck"` started at 15:21:03.880, with the Kiro extension host as its parent (pid 55220). Then `npm run verify` ran at the end of that turn, 15:21:11. | `06-agent-edit-hook-triggered.jpg`, `hook-process-log.txt` |

So `typecheck-on-save` ran from a save that the agent made with its edit tool, in the Kiro IDE. It did not run when the agent wrote the file with a shell command. A Ctrl+S in the editor was not tried in this session.

## What the IDE changed in the repository

- `core/tests/steering-forms.test.ts`: a test that reads the title of each template and checks that `.kiro/steering/product.md` names it, and that the steering does not say four forms (7 cases).
- `.kiro/steering/product.md`: step 1 of the flow now reads "rental return, key handover, item sold as seen, tool loan, or a blank form".
- `.kiro/specs/steering-forms/tasks.md`: the three tasks ticked. `docs/kiro-log.md`: one row.

## How the IDE differed from the CLI

- The IDE asked for approval for each shell command the agent ran (`Allow`, `Always allow`, `Deny`): 11 approvals were given. The headless CLI runs with `--trust-all-tools` and asks nothing.
- The IDE runs a spec task in a sub agent called `spec-task-execution`, ticks the box in `tasks.md` itself and writes `tasks.meta.json` (a task state file that was not kept). The CLI run ticked the boxes by an instruction in the prompt.
- Hooks show in the chat as `Run Command Hook <name>` rows. In the CLI the hook output came back to the session as text.
- The IDE shows each hook with its trigger and starts them switched off until someone enables them, then needs a window reload. The CLI read the same files with no such step.
- `PostFileSave` ran for a file the agent saved with its edit tool in a new chat session. It did not run for a file written by a shell command in a task session.
- The IDE opens a folder in Restricted Mode until the folder is trusted.
- In the IDE the agent has the steering files and the `copycheck` MCP server loaded from the workspace without a flag.

## Limits

One window, one run, one machine. It does not show how often the save hook fires, or that it fires on other versions.
