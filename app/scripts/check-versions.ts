import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const VERSION = /^(\d+)\.(\d+)\.(\d+)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

/** The first number of a version such as `0.1.0`, or null for text that is not a version. */
export function majorOf(version: string): number | null {
  const match = VERSION.exec(version);
  return match === null ? null : Number(match[1]);
}

function readJson(path: string): { version?: unknown; workspaces?: unknown } | null {
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as { version?: unknown; workspaces?: unknown };
  } catch {
    return null;
  }
}

/**
 * Checks the `package.json` of the root and of each workspace. The version must stay below 1.0.0.
 * Returns one line for each problem, naming the file.
 */
export function checkVersions(root: string): string[] {
  const problems: string[] = [];
  const rootFile = join(root, 'package.json');
  const rootPackage = existsSync(rootFile) ? readJson(rootFile) : null;
  if (rootPackage === null) return [`package.json: missing or not readable in ${root}`];
  const folders = Array.isArray(rootPackage.workspaces)
    ? rootPackage.workspaces.filter((w): w is string => typeof w === 'string')
    : [];
  const files = ['package.json', ...folders.map((folder) => join(folder, 'package.json'))];
  for (const file of files) {
    const path = join(root, file);
    const pkg = existsSync(path) ? readJson(path) : null;
    if (pkg === null) {
      problems.push(`${file}: missing or not readable`);
      continue;
    }
    if (typeof pkg.version !== 'string') {
      problems.push(`${file}: no version`);
      continue;
    }
    const major = majorOf(pkg.version);
    if (major === null) problems.push(`${file}: version ${pkg.version} is not a version`);
    else if (major >= 1) problems.push(`${file}: version ${pkg.version} is 1.0.0 or higher, and the version stays below 1.0`);
  }
  return problems;
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(import.meta.dirname, '..', '..');
  const problems = checkVersions(root);
  if (problems.length > 0) {
    console.error(`check-versions: ${problems.length} problem(s)`);
    for (const line of problems) console.error(`  ${line}`);
    process.exit(1);
  }
  console.log('check-versions: every package version is below 1.0.0');
}
