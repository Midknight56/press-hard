import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (path: string): string => readFileSync(resolve(root, path), 'utf8');
const json = (path: string): Record<string, unknown> => JSON.parse(read(path)) as Record<string, unknown>;

const criteria = ['Potential Impact.', 'Technological Implementation.', 'Design.', 'Innovation/Idea.', 'Presentation.'];
const bannedWords = ['tamper proof', 'secure', 'certified', 'legal proof'];

/** Returns the problems found in the README text. An empty list means it passes. */
const checkReadme = (raw: string): string[] => {
  const problems: string[] = [];
  const text = raw.replace(/\r\n/g, '\n');
  const lines = text.split('\n');
  if (lines[0] !== '# Press Hard') problems.push('first line is not "# Press Hard"');

  const start = lines.indexOf('## Judging criteria at a glance');
  if (start < 0) {
    problems.push('missing heading "## Judging criteria at a glance"');
  } else {
    let end = lines.findIndex((line, index) => index > start && line.startsWith('## '));
    if (end < 0) end = lines.length;
    const found: string[] = [];
    for (const paragraph of lines.slice(start + 1, end).join('\n').split(/\n\s*\n/)) {
      if (paragraph.trim() === '') continue;
      const match = /^\*\*([^*]+)\*\*/.exec(paragraph.trim());
      found.push(match?.[1] ?? '(no bold start)');
    }
    if (found.join('|') !== criteria.join('|')) {
      problems.push(`criteria order: expected ${criteria.join(', ')} but found ${found.join(', ')}`);
    }
  }
  if (!lines.includes('## How Kiro was used')) problems.push('missing heading "## How Kiro was used"');

  const prose = text.replace(/^```[\s\S]*?^```/gm, '').replace(/`[^`\n]*`/g, '').replace(/\]\([^)\n]*\)/g, ']').replace(/https?:\/\/\S+/g, '');
  if (prose.includes('\u2014')) problems.push('em dash');
  if (prose.includes('\u2013')) problems.push('en dash');
  if (/\p{L}-\p{L}/u.test(prose)) problems.push('hyphen joining two words');
  // A word shown in straight double quotes is named, not used (the README lists what the app never says).
  const unquoted = prose.replace(/"[^"\n]*"/g, '');
  for (const word of bannedWords) {
    if (new RegExp(`(^|[^\\p{L}])${word}($|[^\\p{L}])`, 'iu').test(unquoted)) problems.push(`banned word: ${word}`);
  }
  return problems;
};

describe('workspace scaffold', () => {
  it('root package is private, version 0.1.0, with workspaces core, mcp and app only', () => {
    const pkg = json('package.json');
    expect(pkg.private).toBe(true);
    expect(pkg.version).toBe('0.1.0');
    expect(pkg.workspaces).toEqual(['core', 'mcp', 'app']);
  });

  it('root has the six scripts', () => {
    const scripts = json('package.json').scripts as Record<string, string>;
    for (const name of ['typecheck', 'lint', 'test', 'e2e', 'verify', 'build']) {
      expect(scripts[name], name).toBeTypeOf('string');
    }
    expect(scripts.e2e).toBe('playwright test');
    expect(scripts['verify:e2e']).toBe('npm run verify && npm run build && npm run e2e');
    expect(scripts.verify).not.toContain('e2e');
    expect(scripts.build).toBe('node app/scripts/check-versions.ts && npm run build --workspace mcp && npm run build --workspace app');
  });

  it('every dependency version is pinned', () => {
    const pkg = json('package.json');
    const deps = { ...(pkg.devDependencies as object), ...(pkg.dependencies as object) } as Record<string, string>;
    expect(Object.keys(deps).length).toBeGreaterThan(0);
    for (const [name, version] of Object.entries(deps)) {
      expect(version, name).toMatch(/^\d+\.\d+\.\d+$/);
    }
    for (const name of ['vitest', 'fast-check', 'eslint']) {
      expect(deps[name], name).toBeDefined();
    }
  });

  it('core and mcp packages are private, 0.1.0, ES modules', () => {
    for (const dir of ['core', 'mcp']) {
      const pkg = json(`${dir}/package.json`);
      expect(pkg.name).toBe(dir);
      expect(pkg.private).toBe(true);
      expect(pkg.version).toBe('0.1.0');
      expect(pkg.type).toBe('module');
    }
  });

  it('core exports dist/index.js and has build, prebuild, pretest', () => {
    const pkg = json('core/package.json');
    expect(JSON.stringify(pkg.exports)).toContain('./dist/index.js');
    const scripts = pkg.scripts as Record<string, string>;
    for (const name of ['build', 'prebuild', 'pretest']) {
      expect(scripts[name], name).toBeTypeOf('string');
    }
  });

  it('base tsconfig has strict on and core extends it', () => {
    const base = json('tsconfig.json');
    expect((base.compilerOptions as Record<string, unknown>).strict).toBe(true);
    expect(existsSync(resolve(root, 'core/tsconfig.json'))).toBe(true);
    expect(read('core/tsconfig.json')).toContain('../tsconfig.json');
  });

  it('has an MIT LICENSE', () => {
    expect(read('LICENSE')).toContain('MIT License');
  });

  it('has the submission README', () => {
    expect(checkReadme(read('README.md'))).toEqual([]);
  });

  it('the README check fails on a banned word used outside quotes, and on dashes', () => {
    const text = read('README.md');
    expect(checkReadme(`${text}\nThis copy is secure.\n`)).toContain('banned word: secure');
    expect(checkReadme(`${text}\nA hand-made copy.\n`)).toContain('hyphen joining two words');
    expect(checkReadme(`${text}\nA copy \u2014 here.\n`)).toContain('em dash');
  });

  it('the README check fails when two criteria are swapped in a copy of the text', () => {
    const text = read('README.md');
    const swapped = text
      .replace('**Design.**', '**@@Design.**')
      .replace('**Innovation/Idea.**', '**Design.**')
      .replace('**@@Design.**', '**Innovation/Idea.**');
    expect(swapped).not.toBe(text);
    expect(checkReadme(swapped).join('\n')).toContain('criteria order');
  });

  it('.gitignore lists the four folders and not .kiro', () => {
    const lines = read('.gitignore').split('\n').map((line) => line.trim());
    for (const entry of ['node_modules', 'dist', 'core/src/generated', 'mcp/demo']) {
      expect(lines, entry).toContain(entry);
    }
    expect(lines.some((line) => line.includes('.kiro'))).toBe(false);
  });

  it('keeps the existing log', () => {
    expect(read('docs/kiro-log.md')).toContain('# Kiro log');
  });
});

describe('ESLint block for core/src', () => {
  const eslint = new ESLint({ cwd: root });
  const lint = async (filePath: string, code: string): Promise<string[]> => {
    const [result] = await eslint.lintText(code, { filePath: resolve(root, filePath) });
    return (result?.messages ?? []).map((message) => message.message);
  };

  const banned: Array<[string, string]> = [
    ['Date', 'export const a = new Date();'],
    ['Math.random', 'export const a = Math.random();'],
    ['window', 'export const a = window;'],
    ['document', 'export const a = document;'],
    ['fetch', 'export const a = fetch;'],
    ['localStorage', 'export const a = localStorage;'],
  ];

  it.each(banned)('forbids %s in core/src', async (_name, code) => {
    const messages = await lint('core/src/x.ts', code);
    expect(messages.length).toBeGreaterThan(0);
  });

  it('allows the same code outside core/src', async () => {
    for (const [name, code] of banned) {
      expect(await lint('core/tests/x.ts', code), name).toEqual([]);
    }
  });

  it('allows plain code in core/src', async () => {
    expect(await lint('core/src/x.ts', 'export const a = 1;\n')).toEqual([]);
  });
});
