import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { checkVersions, majorOf } from '../scripts/check-versions.js';

const made: string[] = [];
afterEach(() => {
  for (const dir of made.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/** A repository with a root package and one folder for each workspace, each with the given version. */
function repo(versions: Record<string, string | null>, workspaces = Object.keys(versions).filter((k) => k !== '.')): string {
  const dir = mkdtempSync(join(tmpdir(), 'versions-'));
  made.push(dir);
  for (const [folder, version] of Object.entries(versions)) {
    mkdirSync(join(dir, folder), { recursive: true });
    const body: Record<string, unknown> = { name: folder === '.' ? 'root' : folder };
    if (version !== null) body.version = version;
    if (folder === '.') body.workspaces = workspaces;
    writeFileSync(join(dir, folder, 'package.json'), JSON.stringify(body));
  }
  return dir;
}

describe('majorOf', () => {
  it('reads the first number of a version', () => {
    expect(majorOf('0.1.0')).toBe(0);
    expect(majorOf('0.99.9')).toBe(0);
    expect(majorOf('1.0.0')).toBe(1);
    expect(majorOf('12.3.4-rc.1')).toBe(12);
  });

  it('returns null for text that is not a version', () => {
    for (const text of ['', 'one', '.1.0', '-1.0.0', 'v1.0.0', '1', '1.0']) expect(majorOf(text), text).toBeNull();
  });
});

describe('checkVersions', () => {
  it('accepts every package below 1.0', () => {
    expect(checkVersions(repo({ '.': '0.1.0', core: '0.1.0', mcp: '0.9.12', app: '0.0.1' }))).toEqual([]);
  });

  it.each(['1.0.0', '1.0.1', '1.2.3', '2.0.0', '10.0.0', '1.0.0-rc.1', '1.0.0-0'])('fails for version %s and names the file', (version) => {
    const problems = checkVersions(repo({ '.': '0.1.0', core: '0.1.0', app: version }));
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain(join('app', 'package.json'));
    expect(problems[0]).toContain(version);
  });

  it('fails for the root package too', () => {
    const problems = checkVersions(repo({ '.': '1.0.0', core: '0.1.0' }));
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('package.json');
  });

  it('names every package that is too high', () => {
    expect(checkVersions(repo({ '.': '0.1.0', core: '1.0.0', mcp: '3.1.0', app: '0.2.0' }))).toHaveLength(2);
  });

  it('fails for a package with no version or a version that is not a version', () => {
    expect(checkVersions(repo({ '.': '0.1.0', core: null }))).toHaveLength(1);
    expect(checkVersions(repo({ '.': '0.1.0', core: 'latest' }))).toHaveLength(1);
  });

  it('fails for a workspace folder that has no package.json', () => {
    expect(checkVersions(repo({ '.': '0.1.0', core: '0.1.0' }, ['core', 'missing'])).join(' ')).toContain('missing');
  });

  it('fails for a folder that has no package.json at all', () => {
    const dir = mkdtempSync(join(tmpdir(), 'versions-'));
    made.push(dir);
    expect(checkVersions(dir).length).toBeGreaterThan(0);
  });

  it('accepts this repository', () => {
    expect(checkVersions(resolve(import.meta.dirname, '..', '..'))).toEqual([]);
  });
});
