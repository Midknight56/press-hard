import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (path: string): string => readFileSync(resolve(root, path), 'utf8').replace(/\r\n/g, '\n');

const steeringFile = '.kiro/steering/product.md';
const steering = read(steeringFile).toLowerCase();

const index = read('app/src/templates/index.ts');
const names = (/\btemplates\b[^=\n]*=\s*\[([^\]]*)\]/.exec(index)?.[1] ?? '')
  .split(',')
  .map((name) => name.trim())
  .filter((name) => name.length > 0);

const files = new Map<string, string>();
for (const match of index.matchAll(/^import\s*\{\s*(\w+)\s*\}\s*from\s*'\.\/([^']+)\.js';/gm)) {
  files.set(match[1] as string, `app/src/templates/${match[2]}.ts`);
}

const titleOf = (name: string): string | undefined => {
  const file = files.get(name);
  if (file === undefined) return undefined;
  const match = /\btitle:\s*(?:'([^']*)'|"([^"]*)")/.exec(read(file));
  return match?.[1] ?? match?.[2];
};

const titles = names.map((name) => ({ name, title: titleOf(name) }));

describe('steering names every form', () => {
  it('finds the templates, their files and their titles', () => {
    expect(names.length).toBeGreaterThanOrEqual(5);
    for (const { name, title } of titles) {
      expect(files.has(name), `${name} has an import line`).toBe(true);
      expect(title, `${name} has a title`).toBeTruthy();
    }
  });

  for (const { name, title } of titles) {
    it(`names the form "${title ?? name}"`, () => {
      expect(title).toBeTruthy();
      expect(
        steering.includes((title ?? '').toLowerCase()),
        `${steeringFile} does not name the form "${title}"`,
      ).toBe(true);
    });
  }

  // Guards the steering against a stale count of forms.
  it('does not say the app has four forms', () => {
    expect(steering.includes('four forms'), `${steeringFile} says "four forms"`).toBe(false);
    const threeThenBlank = /:\s*[^,.:\n]+,\s*[^,.:\n]+,\s*[^,.:\n]+,\s*or a blank form/;
    expect(
      threeThenBlank.test(steering),
      `${steeringFile} lists three forms and then "or a blank form"`,
    ).toBe(false);
  });
});
