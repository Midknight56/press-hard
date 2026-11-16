import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (path: string): string => readFileSync(resolve(root, path), 'utf8');
const json = (path: string): Record<string, unknown> => JSON.parse(read(path)) as Record<string, unknown>;

describe('workspace scaffold', () => {
  it('root package is private, version 0.1.0, with workspaces core and mcp only', () => {
    const pkg = json('package.json');
    expect(pkg.private).toBe(true);
    expect(pkg.version).toBe('0.1.0');
    expect(pkg.workspaces).toEqual(['core', 'mcp']);
  });

  it('root has the six scripts', () => {
    const scripts = json('package.json').scripts as Record<string, string>;
    for (const name of ['typecheck', 'lint', 'test', 'e2e', 'verify', 'build']) {
      expect(scripts[name], name).toBeTypeOf('string');
    }
    expect(scripts.e2e).toContain('not built yet');
    expect(scripts.build).toContain('not built yet');
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

  it('has an MIT LICENSE and a three line README', () => {
    expect(read('LICENSE')).toContain('MIT License');
    const lines = read('README.md').split('\n').filter((line) => line.trim() !== '');
    expect(lines).toHaveLength(3);
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
