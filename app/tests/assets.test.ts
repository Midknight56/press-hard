import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { contrastRatio, type Rgba } from '../src/layout.js';

const dir = join(import.meta.dirname, '..', 'src', 'assets');
const FILES = ['stamp.svg', 'paper.svg', 'tear-edge.svg', 'icon.svg'];

/** The palette of app/src/form/theme.css. */
const PALETTE = ['#fffdf8', '#ece8df', '#1c1b19', '#8c8678', '#eef2fb', '#1f3a8a', '#b3261e'];

function read(name: string): string {
  const path = join(dir, name);
  expect(existsSync(path), `${name} exists`).toBe(true);
  return readFileSync(path, 'utf8');
}

/** A small well-formedness check: one root, matched tags, quoted attributes, no stray text outside tags. */
function xmlProblems(text: string): string[] {
  const problems: string[] = [];
  const stack: string[] = [];
  let roots = 0;
  let pos = 0;
  const tag = /<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<(\/?)([A-Za-z][\w:.-]*)((?:\s+[\w:.-]+="[^"<]*")*)\s*(\/?)>/gy;
  while (pos < text.length) {
    if (text[pos] !== '<') {
      const next = text.indexOf('<', pos);
      const chunk = text.slice(pos, next === -1 ? text.length : next);
      if (stack.length === 0 && chunk.trim() !== '') problems.push('text outside the root element');
      if (/&(?!(amp|lt|gt|quot|apos|#\d+);)/.test(chunk)) problems.push('a bare ampersand');
      pos = next === -1 ? text.length : next;
      continue;
    }
    tag.lastIndex = pos;
    const m = tag.exec(text);
    if (m === null) {
      problems.push(`bad markup at offset ${pos}`);
      break;
    }
    pos = tag.lastIndex;
    if (m[2] === undefined) continue;
    if (m[1] === '/') {
      if (stack.pop() !== m[2]) problems.push(`the closing tag ${m[2]} does not match`);
    } else {
      if (stack.length === 0) roots += 1;
      if (m[4] !== '/') stack.push(m[2]);
    }
  }
  if (stack.length > 0) problems.push(`unclosed: ${stack.join(', ')}`);
  if (roots !== 1) problems.push(`${roots} root elements`);
  return problems;
}

describe.each(FILES)('src/assets/%s', (name) => {
  it('is valid XML with an svg root', () => {
    const text = read(name);
    expect(xmlProblems(text)).toEqual([]);
    expect(/^(<\?xml[^>]*\?>\s*)?<svg\s/.test(text)).toBe(true);
    const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
    expect(doc.documentElement.tagName.toLowerCase()).toBe('svg');
  });

  it('has a viewBox and the svg namespace', () => {
    const text = read(name);
    expect(text).toMatch(/<svg[^>]*\sviewBox="0 0 \d+ \d+"/);
    expect(text).toContain('xmlns="http://www.w3.org/2000/svg"');
  });

  it('holds no external reference, image or script', () => {
    const text = read(name).replace('xmlns="http://www.w3.org/2000/svg"', '');
    expect(text).not.toMatch(/https?:/i);
    expect(text).not.toMatch(/xlink:href/i);
    expect(text).not.toMatch(/<\s*(image|script|foreignObject|style|use)\b/i);
    expect(text).not.toMatch(/\burl\(\s*['"]?(?!#)/i);
    expect(text).not.toMatch(/\bon\w+\s*=/i);
    expect(text).not.toMatch(/\bhref\s*=\s*"(?!#)/i);
  });

  it('uses only colours from the palette', () => {
    const text = read(name);
    const hex = text.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [];
    expect(hex.length).toBeGreaterThan(0);
    for (const colour of hex) expect(PALETTE, `${name}: ${colour}`).toContain(colour.toLowerCase());
    for (const m of text.matchAll(/\b(?:fill|stroke|stop-color|flood-color)="([^"]*)"/g)) {
      const value = (m[1] as string).toLowerCase();
      expect(value === 'none' || value.startsWith('url(#') || PALETTE.includes(value), `${name}: ${value}`).toBe(true);
    }
    expect(text).not.toMatch(/\b(?:rgb|rgba|hsl|hsla)\(/i);
  });

  it('is UTF-8 with LF line endings and no byte order mark', () => {
    const bytes = readFileSync(join(dir, name));
    expect(bytes[0]).not.toBe(0xef);
    expect(bytes.includes(13)).toBe(false);
    expect(bytes.at(-1)).toBe(10);
  });
});

describe('paper.svg keeps text contrast', () => {
  it('holds ink on the darkest point of the tile at 4.5 or more', () => {
    const text = read('paper.svg');
    // The tile draws only the paper colour and rule colour marks at an opacity of at most 0.08.
    const opacities = [...text.matchAll(/\b(?:opacity|fill-opacity|stroke-opacity)="([\d.]+)"/g)].map((m) => Number(m[1]));
    expect(opacities.length).toBeGreaterThan(0);
    const worst = Math.max(...opacities);
    expect(worst).toBeLessThanOrEqual(0.08);
    const rgb = (hex: string): Rgba => ({
      r: parseInt(hex.slice(1, 3), 16),
      g: parseInt(hex.slice(3, 5), 16),
      b: parseInt(hex.slice(5, 7), 16),
      a: 1,
    });
    const paper = rgb('#fffdf8');
    const rule = rgb('#8c8678');
    // Marks may stack, so allow 3 layers at the highest opacity.
    const alpha = 1 - (1 - worst) ** 3;
    const mix = (p: number, q: number) => Math.round(p * (1 - alpha) + q * alpha);
    const darkest: Rgba = { r: mix(paper.r, rule.r), g: mix(paper.g, rule.g), b: mix(paper.b, rule.b), a: 1 };
    for (const ink of ['#1c1b19', '#1f3a8a', '#b3261e']) {
      expect(contrastRatio(rgb(ink), darkest), ink).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe('wiring', () => {
  const root = join(import.meta.dirname, '..', '..');
  it('links the icon as the favicon of the app, the verify page and the site', () => {
    for (const page of ['app/index.html', 'app/verify/index.html', 'site/index.html', 'site/privacy.html']) {
      expect(readFileSync(join(root, page), 'utf8'), page).toMatch(
        /<link rel="icon" type="image\/svg\+xml" href="\/app\/src\/assets\/icon\.svg" \/>/,
      );
    }
  });
  it('uses the stamp, the paper tile and the tear edge in the style sheets', () => {
    const theme = readFileSync(join(root, 'app/src/form/theme.css'), 'utf8');
    expect(theme).toContain('../assets/stamp.svg');
    expect(theme).toContain('../assets/paper.svg');
    expect(theme).toContain('../assets/tear-edge.svg');
  });
});
