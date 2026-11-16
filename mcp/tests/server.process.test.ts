import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const serverPath = resolve(dirname(fileURLToPath(import.meta.url)), '../dist/server.js');

let client: Client;

beforeAll(async () => {
  client = new Client({ name: 'process-test', version: '0.1.0' });
  await client.connect(new StdioClientTransport({ command: process.execPath, args: [serverPath] }));
});

afterAll(async () => {
  await client.close();
});

describe('tool server process', () => {
  it('lists exactly the two tools', async () => {
    const { tools } = await client.listTools();
    expect(tools.map((tool) => tool.name).sort()).toEqual(['diff_copies', 'verify_copy']);
    for (const tool of tools) expect(tool.inputSchema.type).toBe('object');
  });

  it('returns an error result with a code and keeps running', async () => {
    const missing = await client.callTool({ name: 'verify_copy', arguments: { path: resolve(serverPath, 'nope.html') } });
    expect(missing.isError).toBe(true);
    expect(JSON.stringify(missing.content)).toContain('not_found');
    const noArgs = await client.callTool({ name: 'diff_copies', arguments: {} });
    expect(noArgs.isError).toBe(true);
    expect(JSON.stringify(noArgs.content)).toContain('bad_args');
    const unknown = await client.callTool({ name: 'write_file', arguments: {} });
    expect(unknown.isError).toBe(true);
    const again = await client.listTools();
    expect(again.tools).toHaveLength(2);
  });
});