import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** The pages that `dist/` must hold: `/`, `/app/`, `/verify/` and `/privacy/`. */
export const REQUIRED_PAGES = ['index.html', 'app/index.html', 'verify/index.html', 'privacy/index.html'];

/** The service worker, at the root so that its scope is the whole site. */
export const WORKER_FILE = 'sw.js';

/** The licence texts of the four bundled fonts. The licence asks for them to travel with the font files, so they sit in assets/ beside them. */
export const FONT_LICENCES = ['OFL-saira.txt', 'OFL-sairacondensed.txt', 'OFL-gochihand.txt', 'OFL-rubikmonoone.txt'] as const;

export interface DistOptions {
  /** Texts that must not be anywhere in the built files, such as a beacon address that was not set. */
  forbidden?: string[];
}

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? files(join(dir, entry.name)) : [join(dir, entry.name)],
  );
}

/** Returns one line for each problem. An empty list means the folder is good. */
export function checkDist(dist: string, options: DistOptions = {}): string[] {
  if (!existsSync(dist) || !statSync(dist).isDirectory()) return [`${dist}: the folder does not exist`];
  const problems: string[] = [];
  for (const page of REQUIRED_PAGES) {
    const path = join(dist, page);
    if (!existsSync(path)) {
      problems.push(`${page}: the page is missing`);
      continue;
    }
    const text = readFileSync(path, 'utf8');
    if (text.trim() === '') problems.push(`${page}: the page is empty`);
    if (text.includes('%APP_TITLE%')) problems.push(`${page}: the product name placeholder %APP_TITLE% is still there`);
  }
  const worker = join(dist, WORKER_FILE);
  if (!existsSync(worker)) {
    problems.push(`${WORKER_FILE}: the file is missing`);
  } else {
    const text = readFileSync(worker, 'utf8');
    for (const placeholder of ['__PRECACHE__', '__CACHE_NAME__']) {
      if (text.includes(placeholder)) problems.push(`${WORKER_FILE}: ${placeholder} was not replaced`);
    }
    if (!text.includes('./app/')) problems.push(`${WORKER_FILE}: the list of files does not list ./app/`);
  }
  for (const forbidden of options.forbidden ?? []) {
    for (const path of files(dist)) {
      if (readFileSync(path, 'utf8').includes(forbidden)) problems.push(`${path}: holds ${forbidden}`);
    }
  }
  return problems;
}

/** Returns one line for each font licence text that is not in assets/ beside the font files. */
export function checkFontLicences(dist: string): string[] {
  const assets = join(dist, 'assets');
  if (!existsSync(assets) || !statSync(assets).isDirectory()) return ['assets/: the folder does not exist'];
  const names = readdirSync(assets);
  const problems: string[] = [];
  if (!names.some((name) => name.endsWith('.woff2'))) problems.push('assets/: no font file (woff2) for the licence texts to sit beside');
  for (const licence of FONT_LICENCES) {
    if (!names.includes(licence)) problems.push(`assets/${licence}: the font licence text is missing`);
  }
  return problems;
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dist = resolve(import.meta.dirname, '..', '..', 'dist');
  const problems = [...checkDist(dist), ...checkFontLicences(dist)];
  if (problems.length > 0) {
    console.error(`check-dist: ${problems.length} problem(s)`);
    for (const line of problems) console.error(`  ${line}`);
    process.exit(1);
  }
  console.log(`check-dist: ${REQUIRED_PAGES.length} pages and ${FONT_LICENCES.length} font licence texts found in ${dist}`);
}
