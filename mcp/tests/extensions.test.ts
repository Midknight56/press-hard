import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { verifyCopy } from '../src/tools.js';

// Requirements of .kiro/specs/kiro-extensions: the power, the custom agent and the proof inputs.
// Reads files only. It starts no Kiro session.

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

const text = (...parts: string[]): string => readFileSync(join(REPO, ...parts), 'utf8');
const json = <T>(...parts: string[]): T => JSON.parse(text(...parts)) as T;

/** The tool names in the TOOLS list of mcp/src/server.ts. */
const serverTools = (): string[] => {
  const source = text('mcp', 'src', 'server.ts');
  const block = source.slice(source.indexOf('const TOOLS'), source.indexOf('type Reply'));
  return [...block.matchAll(/^ {4}name: '(\w+)',$/gm)].map((match) => match[1] as string);
};

const POWER = ['power', 'press-hard'];

describe('the MCP server, the source of tool names', () => {
  it('lists exactly verify_copy and diff_copies', () => {
    expect(serverTools()).toEqual(['verify_copy', 'diff_copies']);
  });
});

describe('1 the power in power/press-hard', () => {
  it('1.2 has a plugin.json with the required fields', () => {
    const plugin = json<Record<string, unknown>>(...POWER, 'plugin.json');
    expect(plugin.$schema).toBe('https://agent-plugins.org/schemas/1.0.0/plugin.schema.json');
    expect(plugin.name).toBe('press-hard');
    expect(plugin.version).toMatch(/^0\.\d+\.\d+$/);
    expect(typeof plugin.description).toBe('string');
    expect((plugin.description as string).length).toBeGreaterThan(20);
    expect(typeof (plugin.author as { name?: unknown }).name).toBe('string');
    const keywords = plugin.keywords as string[];
    expect(Array.isArray(keywords)).toBe(true);
    expect(keywords.length).toBeGreaterThanOrEqual(4);
    for (const word of keywords) expect(word.trim()).not.toBe('');
    expect(plugin.license).toBe('MIT');
  });

  it('1.3 has an mcp.json that starts the copycheck server through two variables, with no path of this machine', () => {
    const raw = text(...POWER, 'mcp.json');
    const mcp = JSON.parse(raw) as { mcpServers: Record<string, { type?: string; command: string; args?: string[]; env?: Record<string, string> }> };
    expect(Object.keys(mcp.mcpServers)).toEqual(['copycheck']);
    const server = mcp.mcpServers.copycheck as { type?: string; command: string; args?: string[]; env?: Record<string, string> };
    expect(server.command).toBe('node');
    expect(server.env).toEqual({
      PRESS_HARD_MCP_DIST: '${PRESS_HARD_MCP_DIST}',
      PRESS_HARD_WORKSPACE: '${PRESS_HARD_WORKSPACE}',
    });
    const script = (server.args ?? []).join(' ');
    expect(script).toContain('process.env.PRESS_HARD_MCP_DIST');
    expect(script).toContain('process.env.PRESS_HARD_WORKSPACE');
    expect(script).toContain('process.chdir');
    expect(raw).not.toMatch(/(^|[^A-Za-z])[A-Za-z]:[\\/]/); // a drive path such as D:/ or C:\, not the s:// of https://
    expect(raw).not.toMatch(/adria/i);
    expect(existsSync(join(REPO, 'mcp', 'src', 'server.ts'))).toBe(true);
  });

  it('1.4 does not carry the server', () => {
    const files: string[] = [];
    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.isDirectory()) walk(join(dir, entry.name));
        else files.push(entry.name);
      }
    };
    walk(join(REPO, ...POWER));
    expect(files.filter((name) => /\.(js|mjs|cjs|ts)$/.test(name))).toEqual([]);
  });

  it('1.5 has a skill with front matter, the rules, and only real tools', () => {
    const skills = join(REPO, ...POWER, 'skills');
    const folders = readdirSync(skills, { withFileTypes: true }).filter((entry) => entry.isDirectory());
    expect(folders.map((folder) => folder.name)).toEqual(['handover-records']);
    const real = serverTools();
    const body = text(...POWER, 'skills', 'handover-records', 'SKILL.md');
    const front = /^---\n([\s\S]*?)\n---\n/.exec(body);
    expect(front, 'front matter').not.toBeNull();
    expect(front?.[1]).toMatch(/^name: handover-records$/m);
    expect(front?.[1]).toMatch(/^description: ./m);
    expect(body).toContain('verify_copy');
    expect(body).toContain('diff_copies');
    expect(body.indexOf('verify_copy')).toBeLessThan(body.indexOf('diff_copies'));
    for (const word of ['a changed copy no longer matches the seal', 'seal words', 'top copy', 'carbon copy']) {
      expect(body, word).toContain(word);
    }
    for (const word of ['legal proof', 'tamper proof', 'secure', 'certified']) expect(body, word).toContain(word);
    expect(body).toContain('A seal shows only that a copy was not changed after it was sealed.');
    for (const match of body.matchAll(/`([a-z_]+)\(/g)) {
      expect(real, `tool ${match[1]}`).toContain(match[1]);
    }
  });

  it('1.7 has a README with the install command, the needs and the uninstall command', () => {
    const readme = text(...POWER, 'README.md');
    expect(readme).toContain('kiro-cli powers install');
    expect(readme).toContain('kiro-cli powers uninstall press-hard');
    expect(readme).toContain('npm install');
    expect(readme).toContain('npm run build');
    expect(readme).toContain('Node 24');
    expect(readme).toContain('PRESS_HARD_MCP_DIST');
    expect(readme).toContain('PRESS_HARD_WORKSPACE');
    expect(readme).toContain('mcp/dist/server.js');
  });
});

describe('2 the custom agent copy-checker', () => {
  const path = ['.kiro', 'agents', 'copy-checker.json'];
  interface Agent {
    name: string;
    description: string;
    tools: string[];
    prompt: string;
    includeMcpJson?: boolean;
    includePowers?: boolean;
    permissions?: { rules?: { capability: string; effect: string }[] };
    allowedTools?: string[];
    toolsSettings?: unknown;
  }
  const WRITE_OR_SHELL = /^(write|fs_write|fs_append|edit|str_replace|shell|bash|execute_bash|execute_pwsh|execute|delete|code|knowledge|@builtin|\*|@\*)$/i;

  it('2.1 parses and has a name, a description and a prompt', () => {
    const agent = json<Agent>(...path);
    expect(agent.name).toBe('copy-checker');
    expect(agent.description.length).toBeGreaterThan(10);
    expect(agent.prompt.length).toBeGreaterThan(50);
  });

  it('2.2 lists file reads and the two real copycheck tools only, with no write or shell tool', () => {
    const agent = json<Agent>(...path);
    const real = serverTools().map((name) => `@copycheck/${name}`);
    expect([...agent.tools].sort()).toEqual(['read', ...real].sort());
    for (const tool of agent.tools) expect(tool, tool).not.toMatch(WRITE_OR_SHELL);
    for (const rule of agent.permissions?.rules ?? []) {
      expect(['shell', 'write', 'edit'], `rule ${rule.capability}`).not.toContain(rule.capability);
    }
    expect(agent.allowedTools).toBeUndefined();
    expect(agent.toolsSettings).toBeUndefined();
  });

  it('2.3 reads the MCP file and ignores powers', () => {
    const agent = json<Agent>(...path);
    expect(agent.includeMcpJson).toBe(true);
    expect(agent.includePowers).toBe(false);
  });

  it('2.4 to 2.6 tells the agent what to call, what to report and how to end', () => {
    const { prompt } = json<Agent>(...path);
    expect(prompt).toContain('verify_copy');
    expect(prompt).toContain('diff_copies');
    expect(prompt.indexOf('verify_copy')).toBeLessThan(prompt.indexOf('diff_copies'));
    for (const word of ['matches', 'changed', 'unsealed', 'wrong_seal', 'seal words', 'fields.mileage.value']) {
      expect(prompt, word).toContain(word);
    }
    for (const word of ['top copy', 'carbon copy']) expect(prompt, word).toContain(word);
    expect(prompt).toMatch(/quote (its|the) error text and stop/);
    expect(prompt).toMatch(/do not guess/);
    expect(prompt).toContain('a changed copy no longer matches the seal');
    expect(prompt).toContain('A seal shows only that a copy was not changed after sealing, and is not legal proof.');
    expect(prompt.trimEnd().endsWith('is not legal proof.')).toBe(true);
  });
});
describe('3 the proof inputs', () => {
  const GOOD = 'rental-return-good.html';
  const CHANGED = 'rental-return-changed.html';
  const sessions = ['copy-checker-session', 'power-session'];

  for (const session of sessions) {
    it(`3.1 ${session} holds the two copy files and a folder note`, () => {
      const dir = join(REPO, 'docs', 'acceptance', session);
      expect(existsSync(join(dir, GOOD)), 'good copy').toBe(false);
      expect(existsSync(join(dir, 'inputs', GOOD)), 'inputs/good copy').toBe(true);
      expect(existsSync(join(dir, 'inputs', CHANGED)), 'inputs/changed copy').toBe(true);
      expect(existsSync(join(dir, 'README.md')), 'README.md').toBe(true);
    });
  }

  it('3.2 the demo pair is a real pair: the good copy matches and the changed copy is changed', () => {
    for (const session of sessions) {
      const dir = join(REPO, 'docs', 'acceptance', session, 'inputs');
      const good = verifyCopy({ path: join(dir, GOOD) });
      const changed = verifyCopy({ path: join(dir, CHANGED) });
      expect(good.ok && good.value.result, `${session} good`).toBe('matches');
      expect(changed.ok && changed.value.result, `${session} changed`).toBe('changed');
    }
  });

  it('3.2 the files in the two folders are the same', () => {
    for (const name of [GOOD, CHANGED]) {
      const a = text('docs', 'acceptance', 'copy-checker-session', 'inputs', name);
      const b = text('docs', 'acceptance', 'power-session', 'inputs', name);
      expect(a).toBe(b);
    }
  });
});

// These two cases check the proof pages that the lead saves after real sessions. They stay
// red until those pages exist. Do not weaken them.
describe('4 the proof pages of the lead (red until the sessions are saved)', () => {
  it('4.1 power-session holds the install and uninstall commands, --no-interactive, a Tool calls seen heading and the session output', () => {
    const dir = ['docs', 'acceptance', 'power-session'];
    const proof = text(...dir, 'README.md');
    expect(proof).toContain('kiro-cli powers install');
    expect(proof).toContain('kiro-cli powers uninstall press-hard');
    expect(proof).toContain('--no-interactive');
    expect(proof).toContain('## Tool calls seen');
    expect(existsSync(join(REPO, ...dir, 'session-output.txt'))).toBe(true);
  });

  it('4.2 copy-checker-session holds the validate command, --agent copy-checker, --no-interactive, and an output that names fields.mileage.value and 12.5', () => {
    const dir = ['docs', 'acceptance', 'copy-checker-session'];
    const proof = text(...dir, 'README.md');
    expect(proof).toContain('kiro-cli agent validate');
    expect(proof).toContain('--agent copy-checker');
    expect(proof).toContain('--no-interactive');
    const output = text(...dir, 'session-output.txt');
    expect(output).toContain('fields.mileage.value');
    expect(output).toContain('12.5');
  });
});