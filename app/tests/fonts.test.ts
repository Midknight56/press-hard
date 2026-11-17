import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { precacheList } from '../scripts/precache.js';

const src = join(import.meta.dirname, '..', 'src');
const fontsDir = join(src, 'fonts');
const cssPath = join(src, 'fonts.css');

const FAMILIES = ['Saira', 'Saira Condensed', 'Gochi Hand', 'Rubik Mono One'];
const FILES = [
  'Saira-variable-400-700.woff2',
  'SairaCondensed-500.woff2',
  'SairaCondensed-600.woff2',
  'SairaCondensed-700.woff2',
  'GochiHand-400.woff2',
  'RubikMonoOne-400.woff2',
];
const LICENCES = ['OFL-saira.txt', 'OFL-sairacondensed.txt', 'OFL-gochihand.txt', 'OFL-rubikmonoone.txt'];

const css = () => readFileSync(cssPath, 'utf8');
const faces = () => [...css().matchAll(/@font-face\s*{([^}]*)}/g)].map((m) => m[1] as string);

describe('the font files', () => {
  it('are in app/src/fonts with their four licence texts', () => {
    for (const name of [...FILES, ...LICENCES]) expect(existsSync(join(fontsDir, name)), name).toBe(true);
  });

  it('are woff2 files', () => {
    for (const name of FILES) {
      const bytes = readFileSync(join(fontsDir, name));
      expect(bytes.subarray(0, 4).toString('latin1'), name).toBe('wOF2');
    }
  });

  it('have licence texts that are UTF-8, with no byte order mark and LF line endings', () => {
    for (const name of LICENCES) {
      const bytes = readFileSync(join(fontsDir, name));
      expect(bytes[0], name).not.toBe(0xef);
      expect(bytes.includes(13), name).toBe(false);
      expect(bytes.toString('utf8'), name).toContain('SIL Open Font License');
    }
  });

  it('are all declared, and nothing else is in the folder', () => {
    expect(readdirSync(fontsDir).sort()).toEqual([...FILES, ...LICENCES].sort());
    for (const name of FILES) expect(css(), name).toContain(name);
  });
});

describe('fonts.css', () => {
  it('declares each of the four families', () => {
    const declared = faces().map((f) => /font-family:\s*['"]([^'"]+)['"]/.exec(f)?.[1]);
    for (const family of FAMILIES) expect(declared, family).toContain(family);
  });

  it('gives every face font-display swap and a woff2 file of the app', () => {
    expect(faces().length).toBe(FILES.length);
    for (const face of faces()) {
      expect(face).toMatch(/font-display:\s*swap/);
      expect(face).toMatch(/src:\s*url\(['"]?\.\/fonts\/[A-Za-z0-9-]+\.woff2['"]?\)\s*format\(['"]woff2['"]\)/);
    }
  });

  it('declares Saira as one variable file for weights 400 to 700', () => {
    const saira = faces().find((f) => /font-family:\s*['"]Saira['"]/.test(f)) as string;
    expect(saira).toMatch(/font-weight:\s*400 700/);
    expect(saira).toContain('Saira-variable-400-700.woff2');
  });

  it('asks nothing from another origin', () => {
    expect(css()).not.toMatch(/https?:|@import|\/\/[a-z]/i);
  });

  it('is loaded by every page that has the look', () => {
    const entries = ['main.ts', 'verify/main.ts'].map((f) => readFileSync(join(src, f), 'utf8'));
    for (const text of entries) expect(text).toMatch(/import ['"](\.\.?\/)+(src\/)?fonts\.css['"]/);
    const root = join(src, '..', '..');
    expect(readFileSync(join(root, 'site', 'landing.ts'), 'utf8')).toContain('app/src/fonts.css');
    expect(readFileSync(join(root, 'site', 'privacy.html'), 'utf8')).toContain('/app/src/fonts.css');
  });

  it('is not named in any style sheet with a web address', () => {
    for (const file of ['app.css', 'print.css', 'form/theme.css', 'look.css']) {
      const path = join(src, file);
      if (existsSync(path)) expect(readFileSync(path, 'utf8'), file).not.toMatch(/fonts\.googleapis|fonts\.gstatic|@import/);
    }
  });
});

describe('the service worker list', () => {
  it('holds the built font files, which Vite writes to assets/', () => {
    const list = precacheList(['index.html', 'assets/Saira-variable-400-700-abc123.woff2', 'assets/GochiHand-400-def456.woff2', 'assets/app-1.css']);
    expect(list).toContain('./assets/Saira-variable-400-700-abc123.woff2');
    expect(list).toContain('./assets/GochiHand-400-def456.woff2');
  });
});
