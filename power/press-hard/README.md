# Press Hard power

A Kiro power in the Agent Plugins format. It gives Kiro the two tools of the `copycheck` server of Press Hard, `verify_copy` and `diff_copies` (from `mcp/src/server.ts`), and one skill, `handover-records`. The skill holds the rules for a person who checks a copy: call `verify_copy` before saying anything, call `diff_copies` to name the changed line, use the product's words, and say what a seal shows.

The power does not carry the server. It starts the server file that your clone of this repository builds.

## What it needs

- Node 24.
- A clone of this repository, with `npm install` and `npm run build --workspace mcp` run once. That writes `mcp/dist/server.js`. `npm run build` also does it.
- Two environment variables, set before you start Kiro:
  - `PRESS_HARD_MCP_DIST`: the full path of `mcp/dist/server.js` in your clone.
  - `PRESS_HARD_WORKSPACE`: the full path of the folder you work in. A relative path given to a tool means a path in this folder.

Kiro copies an installed power to its own folder and starts its server there. The server cannot find your clone or your folder on its own, so the two variables name them.

## Install

From the root of your clone, in PowerShell:

```powershell
npm install
npm run build
$env:PRESS_HARD_MCP_DIST = (Resolve-Path mcp/dist/server.js).Path
$env:PRESS_HARD_WORKSPACE = (Get-Location).Path
kiro-cli powers install power/press-hard
```

The next Kiro CLI session loads the power. It activates when you talk about a carbon copy, a seal, seal words or a changed copy.

## Use

Ask in plain words, for example: `Check the copy file rental-return-changed.html.` Kiro calls `verify_copy`, and `diff_copies` when you give two files. Tools from a power ask for approval. In a headless session, name the trusted tools: `--trust-tools="kiro_powers,@copycheck"`.

## Uninstall

```powershell
kiro-cli powers uninstall press-hard
```

An installed power loads into every later session on the machine, so uninstall it when you are done.

## Limits

A seal shows only that a copy was not changed after it was sealed. It is not legal proof. The tools read the files you name and never change them.
