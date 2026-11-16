// Builds two demo copy files in mcp/demo/ from the rental return fixture.
//   rental-return-good.html     sealed and untouched
//   rental-return-changed.html  the mileage text is changed after sealing, with no new seal
// Run after `npm run build --workspace core`: node mcp/scripts/make-demo-copies.ts
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildCopyFile, sealRecord } from 'core';
import type { HandoverRecord } from 'core';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const fixture = resolve(root, 'core', 'tests', 'fixtures', 'rental-return.json');
const outDir = resolve(root, 'mcp', 'demo');
const SEALED_AT = '2026-11-16T09:30:00Z';
const options = { title: 'Rental return', paper: 'top' } as const;

const record = JSON.parse(readFileSync(fixture, 'utf8')) as HandoverRecord;
const sealed = sealRecord(record, SEALED_AT);
if (!sealed.ok) throw new Error(`make-demo-copies: cannot seal the fixture: ${sealed.problems.join('; ')}`);

// Same record and the same seal, but the mileage value is different.
const changed: HandoverRecord = {
  ...sealed.record,
  fields: sealed.record.fields.map((field) =>
    field.id === 'mileage' && field.kind === 'number' ? { ...field, value: '12.5' } : field,
  ),
};

mkdirSync(outDir, { recursive: true });
writeFileSync(resolve(outDir, 'rental-return-good.html'), buildCopyFile(sealed.record, options), 'utf8');
writeFileSync(resolve(outDir, 'rental-return-changed.html'), buildCopyFile(changed, options), 'utf8');
console.log(`wrote ${outDir}`);
