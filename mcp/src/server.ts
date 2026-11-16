import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { diffCopies, verifyCopy } from './tools.js';
import type { ToolResult } from './tools.js';

const TOOLS = [
  {
    name: 'verify_copy',
    description:
      'Check one copy file. Returns matches, changed, unsealed or wrong_seal, with the seal, the seal words, the time of sealing, the form title, the party names and the number of photos. Reads the file only.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        path: { type: 'string', description: 'Path of the copy file (HTML).' },
        expectedSeal: { type: 'string', description: 'Optional. The seal the copy should have, 64 hex characters.' },
      },
      required: ['path'],
    },
  },
  {
    name: 'diff_copies',
    description:
      'Compare two copy files. Returns equal and the list of differences, each with a path and the value on each side. Reads the files only.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        pathA: { type: 'string', description: 'Path of the first copy file.' },
        pathB: { type: 'string', description: 'Path of the second copy file.' },
      },
      required: ['pathA', 'pathB'],
    },
  },
];

type Reply = ToolResult<unknown> | { ok: false; error: { code: 'unknown_tool' | 'internal_error'; message: string } };

const reply = (result: Reply) =>
  result.ok
    ? { content: [{ type: 'text' as const, text: JSON.stringify(result.value) }] }
    : { isError: true, content: [{ type: 'text' as const, text: JSON.stringify({ error: result.error }) }] };

const server = new Server({ name: 'copycheck', version: '0.1.0' }, { capabilities: { tools: {} } });

server.setRequestHandler(ListToolsRequestSchema, () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, (request) => {
  const { name, arguments: args } = request.params;
  try {
    if (name === 'verify_copy') return reply(verifyCopy(args));
    if (name === 'diff_copies') return reply(diffCopies(args));
    return reply({ ok: false, error: { code: 'unknown_tool', message: `unknown tool: ${name}` } });
  } catch (error) {
    // Standard output carries only MCP messages, so the stack goes to standard error.
    console.error(error instanceof Error ? (error.stack ?? error.message) : String(error));
    return reply({ ok: false, error: { code: 'internal_error', message: 'the tool failed, see standard error' } });
  }
});

await server.connect(new StdioServerTransport());