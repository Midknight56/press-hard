import { readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const readme = readFileSync(resolve(root, 'README.md'), 'utf8').replace(/\r\n/g, '\n');
const lines = readme.split('\n');
const top = lines.slice(0, 12);

const appLink = 'https://press-hard.midknight-ent-llc.workers.dev';
const videoLink = 'https://youtu.be/Xl3lRyM_yCI';
const pictures = ['docs/img/hero-carbon-copy.png', 'docs/img/hero-changed-copy.png'];

const image = /^!\[([^\]]*)\]\(([^)\s]+)\)\s*$/;
const imageLine = (path: string): { index: number; alt: string } | undefined => {
  for (const [index, line] of lines.entries()) {
    const match = image.exec(line);
    if (match && match[2] === path) return { index, alt: match[1] ?? '' };
  }
  return undefined;
};

describe('README top', () => {
  it('has the title, the first picture, then the live link line, in this order', () => {
    expect(top[0]).toBe('# Press Hard');
    const first = imageLine(pictures[0] as string);
    expect(first, 'first picture line').toBeDefined();
    const linkIndex = top.findIndex((line) => line.includes(appLink));
    expect(linkIndex, 'live app link in the first 12 lines').toBeGreaterThan(-1);
    expect(first?.index).toBeGreaterThan(0);
    expect(first?.index).toBeLessThan(12);
    expect(first?.index).toBeLessThan(linkIndex);
  });

  it('puts the video link in the first 12 lines', () => {
    expect(top.some((line) => line.includes(videoLink))).toBe(true);
  });

  it('gives the first picture a real alt text', () => {
    const alt = imageLine(pictures[0] as string)?.alt ?? '';
    expect(alt.trim().length).toBeGreaterThanOrEqual(20);
  });

  it('references the second picture with a real alt text, after the How it works list', () => {
    const second = imageLine(pictures[1] as string);
    expect(second, 'second picture line').toBeDefined();
    expect((second?.alt ?? '').trim().length).toBeGreaterThanOrEqual(20);
    const list = lines.indexOf('## How it works');
    const lastItem = lines.findIndex((line, index) => index > list && /^5\. /.test(line));
    expect(list).toBeGreaterThan(-1);
    expect(second?.index).toBeGreaterThan(lastItem);
    const next = lines.findIndex((line, index) => index > list && line.startsWith('## '));
    expect(second?.index).toBeLessThan(next);
  });

  it('has both picture files, as PNG, under 1.5 MB', () => {
    const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    for (const path of pictures) {
      const file = resolve(root, path);
      expect(statSync(file).size, path).toBeLessThan(1.5 * 1024 * 1024);
      expect([...readFileSync(file).subarray(0, 8)], path).toEqual(signature);
    }
  });

  it('has no dash between words and none of the banned words', () => {
    const prose = readme
      .replace(/^```[\s\S]*?^```/gm, '')
      .replace(/`[^`\n]*`/g, '')
      .replace(/\]\([^)]*\)/g, ']')
      .replace(/https?:\/\/\S+/g, '');
    expect(prose).not.toContain('\u2014');
    expect(prose).not.toContain('\u2013');
    expect(/\p{L}-\p{L}/u.test(prose)).toBe(false);
    // A word in straight double quotes is named, not used, as in scaffold.test.ts.
    const unquoted = prose.replace(/"[^"\n]*"/g, '');
    for (const word of ['legal proof', 'tamper proof', 'secure', 'certified']) {
      expect(new RegExp(`(^|[^\\p{L}])${word}($|[^\\p{L}])`, 'iu').test(unquoted), word).toBe(false);
    }
  });
});
