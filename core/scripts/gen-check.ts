// Builds core/src/generated/check-script.ts. It turns sha256.ts and canonical.ts
// into plain JavaScript text, so that the inline check script of a copy file
// uses the same source as the rest of the core. Run by `pretest` and `prebuild`.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sources = ['src/sha256.ts', 'src/canonical.ts'];

let lib = '';
for (const source of sources) {
  const output = ts.transpileModule(readFileSync(resolve(root, source), 'utf8'), {
    compilerOptions: {
      target: ts.ScriptTarget.ES2019,
      module: ts.ModuleKind.ESNext,
      removeComments: true,
    },
  }).outputText;
  lib += output.replace(/^export /gm, '');
}

if (/\b(import|export)\b/.test(lib)) {
  throw new Error('gen-check: an inlined source still holds import or export. Keep sha256.ts and canonical.ts self contained.');
}
if (lib.includes('</')) {
  throw new Error('gen-check: the check script text must not hold "</".');
}

const target = resolve(root, 'src/generated/check-script.ts');
mkdirSync(dirname(target), { recursive: true });
writeFileSync(
  target,
  `// Written by core/scripts/gen-check.ts. Do not edit. Not committed.\nexport const CHECK_LIB = ${JSON.stringify(lib)};\n`,
  'utf8',
);
console.log(`gen-check: wrote ${target}`);
