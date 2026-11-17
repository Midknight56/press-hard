# Deploy

## Build
Run `npm run build` from the repository root.

## Output
The output folder is `dist` at the repository root.

## What it is
The folder holds plain static files. There is no server code. There are no rewrites.

## Where it can sit
Every link, script, style, image, the service worker and its file list use relative paths. The folder works at the root of a host. It also works under a sub path, such as `https://host/press-hard/`. Copy the folder as it is. Do not edit any file.

## Check it locally
Run this one command from the repository root. It builds `dist` and serves it on port 4473.

`npm run serve --workspace app`

Then open `http://127.0.0.1:4473/`.

## Check a sub path
The browser test `e2e/subpath.spec.ts` serves the existing `dist` folder under `/press-hard/` on port 4474. It fails on any 404, any request outside that path, and any page or console error. `npm run verify:e2e` builds `dist` before it runs.