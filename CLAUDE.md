# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A personal, single-user design-review bench. Claude Code proposes batches of UI component candidates (JSX), submits them via an MCP tool, and blocks until a human reviews live-rendered previews in a browser and records a decision. The decision (status, comment, selected example, screenshot, version) is returned to Claude Code as structured JSON.

## Atlas (project docs)

```
atlas/
  foundation/
    problem.md       — problem statement, constraints, decisions
    vision.md        — solution rationale and system map
    research.md      — library choices, gotchas, versioning state machine
    scaffold.md      — stage-by-stage execution plan (Stages 0–7)
  plans/
    s0-setup.md      — Stage 0 implementation plan
    s1-tests.md      — Stage 1 test spec (acceptance conditions)
    s2-storage.md    — Stage 2 implementation plan
    s3-api.md        — Stage 3 implementation plan
    s4-mcp.md        — Stage 4 implementation plan
    s5-review-ui.md  — Stage 5 implementation plan
    s6-screenshot.md — Stage 6 implementation plan
    s7-smoke.md      — Stage 7 end-to-end checklist
  notes.md           — open decisions and ad-hoc notes
```

## Repo layout

```
/web       — Review UI: Vite + React + TS + Tailwind 4 + Shadcn
/server    — Core API + MCP adapter (Bun + ElysiaJS + Prisma + TS)
compose.yaml — PostgreSQL 17 via Podman Compose
```

Two independent `package.json`s. No monorepo tooling.

## Commands

```bash
# Start database
podman compose up -d

# Web (from /web)
bun run dev        # start dev server
bun run build      # production build
bun test           # vitest (unit + integration)
bunx vitest run src/decisionForm.test.ts   # single file

# Server (from /server)
bun run src/index.ts       # run Core API (port 3000)
bun run src/mcp-server.ts  # run MCP adapter (stdio)
bun test                   # bun:test runner
bun test src/versioning.test.ts     # single file
```

## Architecture

### Data flow

```
Claude Code
   │  submit_examples(item, examples[])
   ▼
MCP stdio server  ──HTTP (localhost:3000)──►  Core API ──► PostgreSQL (Prisma)
   │  await_decision(batch_id)
   ▼
(blocks, polls every ~2s until decision or timeout)
                                              ▲ REST
                                              │
                                    Review web app (React + Vite)
                                    - react-live gallery, live-rendered JSX
                                    - decision form (accepted/direction/refused)
                                    - html-to-image screenshot on decision submit
```

### Server (`/server/src/`)

| File | Purpose |
|---|---|
| `db.ts` | Singleton `PrismaClient` export — all DB access goes through this |
| `versioning.ts` | Pure function: `applyDecision(item, status)` → `{finalVersion, nextMajor, nextMinor}` |
| `routes/items.ts` | `POST /api/v1/items` |
| `routes/batches.ts` | `POST /api/v1/items/:uuid/batches`, `GET /api/v1/items/:uuid/pending` |
| `routes/decisions.ts` | `POST /api/v1/batches/:id/decision`, `GET /api/v1/batches/:id/decision` |
| `index.ts` | Mounts route plugins, exports `app`, listens only when `import.meta.main` |
| `mcp-server.ts` | stdio MCP adapter, two tools: `submit_examples` and `await_decision` |

### Core API routes (all under `/api/v1/`)

| Method & path | Purpose |
|---|---|
| `POST /items` | Create item |
| `POST /items/:uuid/batches` | Submit a batch of examples |
| `GET /items/:uuid/pending` | Fetch latest undecided batch (or `null`) |
| `POST /batches/:id/decision` | Record a decision — calls `applyDecision`, bumps item version |
| `GET /batches/:id/decision` | Fetch decision, or `404` if not yet decided |

### Versioning

`version` is `major.minor`, starting at `0.0`. `accepted` stamps `(major+1).0` and resets minor. `direction` and `refused` both leave the batch at its submitted version; the next batch increments minor.

### MCP tools

**`submit_examples`** — `{item_uuid?, name, goal, examples: [{number, jsx}]}` → `{item_uuid, batch_id, version}`. Each `jsx` string must end with `render(<ComponentName />)` (react-live `noInline` mode).

**`await_decision`** — `{batch_id, timeout_seconds?=120}` → `{status, comment?, selected_number, jsx?, version?, screenshot_base64?, timed_out?}`. Polls every ~2s. On timeout returns `{status:"pending", timed_out:true}`.

### Test files and what they gate

| File | Runner | Goes green at |
|---|---|---|
| `server/src/versioning.test.ts` | `bun test` | Stage 2 — Storage & versioning |
| `server/src/api.test.ts` | `bun test` | Stage 3 — Core API |
| `web/src/decisionForm.test.ts` | vitest | Stage 5 — Review UI |
| `web/src/apiClient.test.ts` | vitest | Stage 5 — Review UI |

## Key constraints

- **No `console.log` in `mcp-server.ts` or anything it imports** — stdio MCP uses stdout as the JSON-RPC channel; log output corrupts the protocol. Use a file-based logger.
- All Core API route bodies validated with Elysia's built-in TypeBox (`t` from `'elysia'`). `direction` and `refused` require a non-empty `comment` (manual handler check — TypeBox can't express conditional required fields). Clear 400s so Claude Code can self-correct.
- The MCP process holds no state — thin adapter over the Core API only.
- `/api/v1/` prefix is mandatory on every route. Breaking changes ship as `/api/v2/`, not mutations of `/v1/`.
- Day 1 scope: single user, no auth, stdio MCP transport, PostgreSQL via Podman, client-side screenshot only.
- Formatting: single quotes, no semicolons, 100-char lines, trailing commas — enforced by Prettier in both packages.
