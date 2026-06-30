# Stage 4 — MCP adapter

**Goal:** stdio MCP server with two tools proxying to the Core API. Connects cleanly from Claude Code with no manual intervention per session.

---

## 4.1 Build script

Add a `build:mcp` script to `server/package.json`:

```json
{
  "scripts": {
    "build:mcp": "bun build src/mcp-server.ts --outfile dist/mcp-server.js --target bun"
  }
}
```

Run it once now and after any change to `mcp-server.ts`:

```bash
cd server && bun run build:mcp
```

`dist/` should be in `.gitignore`. The build output is a self-contained JS file that Bun can execute without needing the `src/` tree.

## 4.2 File-based logger

`server/src/logger.ts` — used only by the MCP adapter and anything it imports. Never imported by the Core API.

```ts
import { appendFileSync, mkdirSync } from 'fs'
import { join } from 'path'

const logPath = join(import.meta.dir, '../../logs/mcp.log')
mkdirSync(join(import.meta.dir, '../../logs'), { recursive: true })

export function log(msg: string) {
  appendFileSync(logPath, `[${new Date().toISOString()}] ${msg}\n`)
}
```

`server/logs/` goes in `.gitignore`.

## 4.3 MCP server (`mcp-server.ts`)

```ts
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { log } from './logger'

const API = 'http://localhost:3000/api/v1'

const server = new Server(
  { name: 'visualiser', version: '1.0.0' },
  { capabilities: { tools: {} } },
)
```

Register both tools in the `ListToolsRequestSchema` handler. Implement each in the `CallToolRequestSchema` handler. No state — every handler is a standalone `fetch()` call.

**No `console.log` anywhere in this file or `logger.ts`.** Use `log()` for debug output.

## 4.4 `submit_examples` tool

Schema:

```ts
{
  name: 'submit_examples',
  description: `Submit a batch of JSX UI examples for human review.
Each jsx string must end with render(<ComponentName />) — react-live noInline mode.
Returns item_uuid and batch_id to pass to await_decision.`,
  inputSchema: {
    type: 'object',
    properties: {
      item_uuid: { type: 'string', description: 'Omit to create a new item' },
      name: { type: 'string' },
      goal: { type: 'string' },
      examples: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            number: { type: 'integer' },
            jsx: { type: 'string' },
          },
          required: ['number', 'jsx'],
        },
      },
    },
    required: ['name', 'goal', 'examples'],
  },
}
```

Handler logic:

```ts
let itemUuid = args.item_uuid

if (!itemUuid) {
  const res = await fetch(`${API}/items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: args.name, goal: args.goal }),
  })
  const item = await res.json()
  itemUuid = item.uuid
}

const res = await fetch(`${API}/items/${itemUuid}/batches`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ examples: args.examples }),
})
const batch = await res.json()

return { content: [{ type: 'text', text: JSON.stringify({ item_uuid: itemUuid, batch_id: batch.batch_id, version: batch.version }) }] }
```

## 4.5 `await_decision` tool

Schema:

```ts
{
  name: 'await_decision',
  description: 'Block until a human records a decision on the given batch. Returns the decision or timed_out:true after timeout_seconds.',
  inputSchema: {
    type: 'object',
    properties: {
      batch_id: { type: 'integer' },
      timeout_seconds: { type: 'integer', default: 120 },
    },
    required: ['batch_id'],
  },
}
```

Handler logic — poll every 2s, return on first 200:

```ts
const timeout = (args.timeout_seconds ?? 120) * 1000
const start = Date.now()

while (Date.now() - start < timeout) {
  const res = await fetch(`${API}/batches/${args.batch_id}/decision`)
  if (res.ok) {
    const decision = await res.json()
    return { content: [{ type: 'text', text: JSON.stringify(decision) }] }
  }
  await Bun.sleep(2000)
}

return { content: [{ type: 'text', text: JSON.stringify({ status: 'pending', timed_out: true }) }] }
```

## 4.6 Register with Claude Code

Build first, then register:

```bash
cd server && bun run build:mcp

claude mcp add --scope project --transport stdio visualiser -- \
  bun $(pwd)/dist/mcp-server.js
```

The `$(pwd)` expands to an absolute path — necessary because Claude Code spawns the process from a different working directory. `--scope project` writes `.mcp.json` to the repo root; commit it.

If `bun` is not found in Claude Code's stripped PATH, add it to the `env` block in `.mcp.json` manually:

```json
{
  "mcpServers": {
    "visualiser": {
      "command": "bun",
      "args": ["/absolute/path/to/server/dist/mcp-server.js"],
      "env": {
        "PATH": "/home/<user>/.bun/bin:/usr/local/bin:/usr/bin:/bin"
      }
    }
  }
}
```

## Stage 4 success condition

- `claude mcp list` shows `visualiser` connected
- `/mcp` inside a Claude Code session shows both `submit_examples` and `await_decision`
- Manually invoking `submit_examples` with 1–2 toy examples returns a real `batch_id`
- `server/logs/mcp.log` receives entries during the invocation (confirms logger works)
