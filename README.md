# claude-custom-visualiser

A personal design-review bench for Claude Code. Claude proposes batches of JSX UI candidates via an MCP tool, a human reviews live-rendered previews in a browser and records a decision, and that decision is returned to Claude as structured JSON.

## How it works

```
Claude Code
  │  submit_examples(name, goal, examples[])
  ▼
MCP stdio server ──► Core API (ElysiaJS) ──► PostgreSQL (Prisma)
  │  await_decision(batch_id)              ▲
  ▼                                        │ REST
(blocks until decided)            Review UI (React + Vite)
                                  - live-rendered JSX gallery
                                  - decision form (accepted / direction / refused)
                                  - screenshot on submit
```

## Stack

| Layer | Tech |
|---|---|
| Runtime | Bun |
| API | ElysiaJS |
| ORM | Prisma |
| Database | PostgreSQL 17 (Podman Compose) |
| UI | React + Vite + Tailwind 4 + Shadcn |
| MCP | `@modelcontextprotocol/sdk`, stdio transport |

## Repo layout

```
/web          — Review UI
/server       — Core API + MCP adapter
compose.yaml  — PostgreSQL container
atlas/        — Project documentation
```

## Getting started

```bash
# 1. Start the database
podman compose up -d

# 2. Run the API (from /server)
bun run src/index.ts

# 3. Run the UI (from /web)
bun run dev
```

## Documentation

All design decisions, implementation plans, and stage-by-stage instructions live in `atlas/`:

- `atlas/foundation/scaffold.md` — execution plan, Stages 0–7
- `atlas/plans/` — per-stage implementation plans (`s0-setup.md` through `s7-smoke.md`)
- `atlas/foundation/research.md` — library choices, gotchas, versioning state machine
- `atlas/notes.md` — open decisions

Start with `scaffold.md` for the big picture, then the corresponding `plans/s*.md` file for each stage you're working on.
