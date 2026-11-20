# Design Document

## Overview

Three additions and one test file. Nothing here runs the app. The test file reads files only and starts no Kiro session.

```
power/press-hard/plugin.json                    manifest
power/press-hard/mcp.json                       starts mcp/dist/server.js through two variables
power/press-hard/README.md                      install, needs, use, uninstall
power/press-hard/skills/handover-records/SKILL.md
.kiro/agents/copy-checker.json                  custom agent
docs/acceptance/copy-checker-session/README.md  folder note, replaced later by the proof page
docs/acceptance/copy-checker-session/inputs/    the good copy and the changed copy
docs/acceptance/power-session/README.md         folder note, replaced later by the proof page
docs/acceptance/power-session/inputs/           the same two files
mcp/tests/extensions.test.ts                    the checks
```

## The power

Kiro copies an installed power to its own folder and starts its server there. The server therefore cannot find this clone or the user's folder by itself. `mcp.json` starts `node` with a short inline script. The script reads `PRESS_HARD_MCP_DIST` and `PRESS_HARD_WORKSPACE`, prints one line and exits 1 if either is missing, changes the working directory to the workspace, and imports the server file by its file URL. The tools read a path as given, so a relative path then means a path in the workspace. `mcp.json` holds the two names as `${PRESS_HARD_MCP_DIST}` and `${PRESS_HARD_WORKSPACE}` in `env`. It holds no drive path and no user name.

The server name in `mcp.json` is `copycheck`, so the tool names a session sees follow the server name.

## The skill

One skill, `handover-records`. It holds the rules of `record-rules.md` and `claims-policy.md` that matter to a person who checks a copy: verify before saying anything, diff to name the line, the words to use and not to use, and what a seal shows. It names the tools as `verify_copy(path)` and `diff_copies(pathA, pathB)`.

## The agent

`copy-checker.json` follows `custom-agents.md`: `tools` holds `read` and the two full MCP selectors, `includeMcpJson` is true and `includePowers` is false. It has no `permissions`, no `allowedTools` and no `toolsSettings`. The server comes from the workspace `.kiro/settings/mcp.json`, which already defines `copycheck`.

## Tests (`mcp/tests/extensions.test.ts`)

The repository root comes from `import.meta.url`. The tool names are read from the `TOOLS` list in `mcp/src/server.ts`. The demo pair check uses `verifyCopy` from `mcp/src/tools.ts`. Two cases check the proof pages of the lead and stay red until those pages exist.

## Correctness properties

None. These are file checks, not behaviour of a function over a range of inputs.
