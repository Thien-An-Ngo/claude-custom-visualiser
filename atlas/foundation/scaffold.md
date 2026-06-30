# Plan

Step-by-step execution guide for Day 1.
Each stage assumes no prior knowledge of what came before it in this file.
Check the success condition before moving to the next stage.

---

## Table of contents

- [Stage 0 — Reset](#stage-0--reset)
- [Stage 1 — Test suite](#stage-1--test-suite)
- [Stage 2 — Storage & versioning](#stage-2--storage--versioning)
- [Stage 3 — Core API](#stage-3--core-api)
- [Stage 4 — MCP adapter](#stage-4--mcp-adapter)
- [Stage 5 — Review UI](#stage-5--review-ui)
- [Stage 6 — Screenshot](#stage-6--screenshot)
- [Stage 7 — End-to-end smoke test](#stage-7--end-to-end-smoke-test)

---

## Stage 0 — Reset

**Goal:** SvelteKit scaffold gone. Vite + React + TS + Tailwind in its
place, repo laid out as two packages.

### 0.1 Wipe the scaffold

Keep `.git`, remove everything else (`src/`, `static/`, the Svelte config
files, `package.json`, `bun.lock`, etc).

### 0.2 Lay out the repo

```
/web      — the review UI (Vite + React + TS)
/server   — Core API + MCP adapter (Node + TS)
```

Two separate `package.json`s. No monorepo tooling needed for two packages
with one user.

### 0.3 Scaffold the web app

```bash
npm create vite@latest web -- --template react-ts
cd web
npm install
npm install -D tailwindcss @tailwindcss/vite
npm install react-live html-to-image lucide-react clsx tailwind-merge
```

Wire Tailwind into `vite.config.ts` per the `@tailwindcss/vite` plugin docs,
and add a base stylesheet import in `main.tsx`.

### 0.4 Scaffold the server

```bash
mkdir server && cd server
npm init -y
npm install express better-sqlite3 @modelcontextprotocol/sdk zod
npm install -D typescript tsx @types/express @types/node
npx tsc --init
```

> See `atlas/notes.md` — backend framework (Express vs ElysiaJS) is an open
> decision. Resolve it before Stage 3.

### Stage 0 success condition

- `cd web && npm run dev` shows a blank React + Tailwind page
- `cd server && npx tsx src/index.ts` (an empty placeholder file is fine for
  now) runs without error

---

## Stage 1 — Test suite

**Goal:** All test files written as failing acceptance conditions. No
implementations yet — imports will error until later stages create the
modules. See `atlas/plans/supplementary-init-tests.md` for the full test
specification.

### 1.1 Server tests

Install test dependencies in `/server`:

```bash
npm install -D vitest supertest @types/supertest
```

Write `server/src/versioning.test.ts` and `server/src/api.test.ts` exactly
as specified in `atlas/plans/s1-tests.md`.

### 1.2 Web tests

Install test dependencies in `/web`:

```bash
npm install -D vitest jsdom @testing-library/react @testing-library/jest-dom
```

Write `web/src/decisionForm.test.ts` and `web/src/apiClient.test.ts` exactly
as specified in `atlas/plans/s1-tests.md`.

### Stage 1 success condition

- `cd server && npm test` errors on missing modules (not syntax errors)
- `cd web && npm test` errors on missing modules (not syntax errors)
- All four test files exist and match the spec

---

## Stage 2 — Storage & versioning

**Goal:** SQLite schema in place. Versioning logic is a pure, tested
function with zero dependency on the API, DB, or UI.

### 2.1 Schema

`server/src/schema.sql`:

```sql
CREATE TABLE IF NOT EXISTS items (
  uuid TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  goal TEXT NOT NULL,
  major INTEGER NOT NULL DEFAULT 0,
  minor INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS batches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_uuid TEXT NOT NULL REFERENCES items(uuid),
  major INTEGER NOT NULL,
  minor INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS examples (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  batch_id INTEGER NOT NULL REFERENCES batches(id),
  number INTEGER NOT NULL,
  jsx TEXT NOT NULL,
  metadata TEXT  -- JSON, optional, free-form
);

CREATE TABLE IF NOT EXISTS decisions (
  batch_id INTEGER PRIMARY KEY REFERENCES batches(id),
  status TEXT NOT NULL CHECK(status IN ('accepted','direction','refused')),
  comment TEXT,
  selected_number INTEGER NOT NULL DEFAULT 0,  -- 0 = none
  screenshot_base64 TEXT,
  final_version TEXT NOT NULL,
  decided_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### 2.2 DB bootstrap

`server/src/db.ts` — open `server/data/bench.db` with `better-sqlite3`, run
`schema.sql` if tables don't exist yet (`better-sqlite3`'s `.exec()` on the
raw schema string is enough — no migration framework needed for one schema
that won't change often).

### 2.3 Versioning function

`server/src/versioning.ts` — implement exactly the pseudocode from
`research.md` §7:

```ts
export function applyDecision(
  item: { major: number; minor: number },
  status: 'accepted' | 'direction' | 'refused'
): { finalVersion: string; nextMajor: number; nextMinor: number } {
  if (status === 'accepted') {
    const nextMajor = item.major + 1;
    return { finalVersion: `${nextMajor}.0`, nextMajor, nextMinor: 0 };
  }
  // 'direction' and 'refused' both keep the batch at its submitted version
  return {
    finalVersion: `${item.major}.${item.minor}`,
    nextMajor: item.major,
    nextMinor: item.minor + 1,
  };
}
```

### Stage 2 success condition

`cd server && npm test` — `versioning.test.ts` passes. `api.test.ts` still
errors on missing modules.

---

## Stage 3 — Core API

**Goal:** Full CRUD loop, testable with `curl` and passing `api.test.ts`.

### 3.1 Versioning convention

Every route lives under `/api/v1/`. See `research.md` §10 for what counts as
a breaking change requiring `/api/v2/` later versus what doesn't. This
applies from the first route written — retrofitting a prefix after the MCP
adapter already hardcodes unprefixed paths is exactly the kind of avoidable
rework this convention exists to prevent.

> Resolve the Express vs ElysiaJS question (see `atlas/notes.md`) before
> writing any routes.

### 3.2 Routes

| Method & path | Body | Returns |
|---|---|---|
| `POST /api/v1/items` | `{name, goal}` | `{uuid, name, goal, major:0, minor:0}` |
| `POST /api/v1/items/:uuid/batches` | `{examples:[{number, jsx}]}` | `{batch_id, version}` |
| `GET /api/v1/items/:uuid/pending` | — | latest batch + examples with no decision yet, or `null` |
| `POST /api/v1/batches/:id/decision` | `{status, comment?, selected_number?, screenshot_base64?}` | the stamped decision record, including `final_version` |
| `GET /api/v1/batches/:id/decision` | — | the decision record, or `404` if not yet decided |

`POST /api/v1/batches/:id/decision` is the only place
`versioning.applyDecision` gets called — it reads the item's current
`major`/`minor`, applies the decision, writes the new counters back onto
the item row, and writes the `decisions` row with the stamped
`final_version`.

### 3.3 Validate inputs

Every route body gets a validation schema (zod, or the framework's built-in
validator if using ElysiaJS). `direction` and `refused` must require a
non-empty `comment` — a malformed batch should return a clear 400 with a
message Claude Code can read and self-correct from, not a 500 or a silent
half-write.

### Stage 3 success condition

- `cd server && npm test` — both `versioning.test.ts` and `api.test.ts` pass
- Manual `curl` sequence:
  1. `POST /api/v1/items` → get a uuid
  2. `POST /api/v1/items/:uuid/batches` with 2 toy examples → get a `batch_id` and `version: "0.0"`
  3. `GET /api/v1/items/:uuid/pending` → see the batch
  4. `POST /api/v1/batches/:id/decision` with `{status:"accepted"}` → get back `final_version: "1.0"`
  5. `GET /api/v1/batches/:id/decision` → see the same record

---

## Stage 4 — MCP adapter

**Goal:** stdio server with two tools, proxying to the Stage 3 API over
`localhost` HTTP. Connects cleanly from Claude Code.

### 4.1 Tool schemas

`submit_examples`:
```
input:  { item_uuid?: string, name: string, goal: string,
          examples: [{ number: int, jsx: string }] }
output: { item_uuid: string, batch_id: int, version: string }
```
If `item_uuid` is omitted, create a new item first via `POST /items`, then
submit the batch against it.

Each example's `jsx` string must end with its own `render(<ComponentName />)`
call (`react-live` `noInline` mode). Document this in the tool description
so Claude Code follows the convention without needing to be reminded each
session.

`await_decision`:
```
input:  { batch_id: int, timeout_seconds?: int = 120 }
output: { status: "accepted"|"direction"|"refused"|"pending",
          comment?: string, selected_number: int, jsx?: string,
          version?: string, screenshot_base64?: string,
          timed_out?: boolean }
```
Poll `GET /batches/:id/decision` every ~2 seconds until it returns a
decision or the timeout elapses. On timeout, return `{status:"pending",
timed_out:true}` rather than hanging Claude Code indefinitely.

### 4.2 Build with `@modelcontextprotocol/sdk`, stdio transport

`server/src/mcp-server.ts` — register both tools, each handler making plain
`fetch()` calls to `http://localhost:<core-api-port>/api/v1/...`. **No
`console.log` anywhere in this file or anything it imports** — see
`research.md` §5 for why. Use a tiny file-based logger if you need to debug.

### 4.3 Register with Claude Code

```bash
claude mcp add --scope project --transport stdio visualiser -- \
  node server/dist/mcp-server.js
```

`--scope project` writes it into `.mcp.json` so it travels with the repo.

### Stage 4 success condition

- `claude mcp list` shows `visualiser` connected
- `/mcp` inside a Claude Code session shows both `submit_examples` and
  `await_decision`
- Manually invoking `submit_examples` from a Claude Code session with 1–2
  toy examples returns a real `batch_id`

---

## Stage 5 — Review UI

**Goal:** Gallery page, live-rendered examples, decision form that actually
writes a decision.

### 5.1 Fixed scope

`web/src/liveScope.ts` — the only names available inside submitted JSX:

```ts
import * as Lucide from 'lucide-react';
import { useState, useEffect, useMemo } from 'react';

export const liveScope = { useState, useEffect, useMemo, ...Lucide };
```

Extend this list deliberately, one library at a time, if a real submission
needs something it doesn't have — don't open it up wholesale.

### 5.2 API client

`web/src/apiClient.ts` — fetch wrapper functions: `listPendingBatch(itemUuid)`
and `submitDecision(batchId, payload)`. Non-2xx responses reject with an
error containing the status code.

### 5.3 Decision form validation

Extract form validation as a pure function before wiring it into the
component — this is what `decisionForm.test.ts` tests. Rules:

- `direction` or `refused` requires a non-empty comment
- `refused` locks `selected_number` to 0 (no example selected)

### 5.4 Gallery component

For each example in the pending batch, render its own:
```tsx
<LiveProvider code={example.jsx} scope={liveScope} noInline>
  <LiveError />
  <LivePreview />
</LiveProvider>
```

### 5.5 Decision form

- Radio: Accepted / Direction / Refused
- Comment textarea — required when Direction or Refused is selected
- Example picker — disabled (locked to "0 / none") when Refused is selected
- Submit → `POST /batches/:id/decision`

### Stage 5 success condition

- `cd web && npm test` — `decisionForm.test.ts` and `apiClient.test.ts` pass
- Manual: seed a batch via the Stage 3 `curl` sequence, open the web app,
  see 2–3 live-rendered examples, submit a decision, confirm
  `GET /batches/:id/decision` reflects it

---

## Stage 6 — Screenshot

**Goal:** `html-to-image` wired into the decision flow, round-tripping
through the database and back out through `await_decision`.

### 6.1 Capture on submit

In the decision form's submit handler, before calling the API: capture the
DOM node of the selected example (or example #1, if none selected) with
`html-to-image`'s `toPng()`, giving the node's container an explicit
background color first (see `research.md` §8). Send the resulting base64
string as `screenshot_base64` in the `POST /batches/:id/decision` body.

### Stage 6 success condition

Manually trigger `await_decision` from a Claude Code session against an
already-decided batch and confirm `screenshot_base64` comes back as a
non-empty string that actually decodes to the right image.

---

## Stage 7 — End-to-end smoke test

**Goal:** One real, unscripted round trip through the whole system.

### 7.1 The test

From an actual Claude Code session (not a curl script): ask it to design 2
small variants of something trivial (e.g. a button) for a fake item, using
`submit_examples`, then call `await_decision`. While it's blocked, open the
web app, review the two live previews, pick one with a short comment, and
submit.

### Stage 7 success condition

Claude Code's `await_decision` call returns, unblocked, with the correct
`status`, `comment`, `selected_number`, `jsx`, `version`, and
`screenshot_base64` — and the session can describe back to you, correctly,
what you decided without you having to repeat it.

**All stages complete.** From here, anything further — HTTP transport,
homelab hosting, a wider component scope, Postgres — is an explicit,
separate decision per `vision.md`'s migration notes, not something to
backfill silently.
