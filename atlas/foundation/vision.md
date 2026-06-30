# Vision

---

## Overarching goal

A small, self-contained bench where Claude Code can propose several UI
design candidates for a given item, you look at them rendered live, pick one
(or none) with a comment, and Claude Code gets a structured answer back it
can act on immediately — running entirely on your own machine, no cloud
dependency, in a stack you won't be fighting with the day after you build
it.

---

## Solution per problem

### Component format: why JSX/React, not Svelte, not something else

**Problem:** Claude Code needs to generate UI it hasn't seen rendered before,
reliably enough that a human can judge the design rather than fight broken
markup.

**Solution:** Standardize on single-default-export React functional
components. This is the format with the most training signal behind it, the
least ambiguity about "what counts as a valid submission," and — not
incidentally — the same format Anthropic's own equivalent feature already
converged on for the identical problem (generate UI, human reviews it).
Picking the same target Claude already does well, rather than picking a
target for novelty or learning value, is the whole point now that learning
Svelte is no longer a goal.

### Rendering: `react-live` instead of a hand-built sandbox

**Problem:** A submission is just a string of JSX. Turning a string into a
rendered, interactive component in the browser needs a transpiler and a
mount point — and a broken submission shouldn't break the review page.

**Solution:** `react-live` (Formidable Labs, current major v4, TypeScript
rewrite since v4.0, actively maintained — see `research.md` §2). Use
`LiveProvider` with `noInline` mode and a fixed `scope` object containing
React, the hooks Claude is allowed to use, and a small icon/chart library.
Each example gets its own `LiveProvider` + `LiveError`, so one bad example
shows an inline error instead of taking down the gallery. Tailwind utility
classes in submitted JSX work for free, since they're matched against the
host page's global stylesheet — no extra wiring needed.

### Storage: SQLite + a JSON column, not a Mongo/Postgres server

**Problem:** Each example needs a code blob plus a handful of structured and
loose fields, for one user, at low traffic.

**Solution:** SQLite via `better-sqlite3`. A JSON column on the examples
table gives the same "shove a loose object in" flexibility a document store
would, without a server process to run, configure, or keep patched. See
`problem.md` for the override note if you'd rather use this as a chance to
get Postgres practice instead.

### Core API: why versioned routes

**Problem:** The Core API is the contract between the MCP adapter and the
database. Even with one consumer you control, the two pieces get rebuilt and
redeployed independently — Claude Code might be running an MCP adapter
built last week against a Core API that changed today, mid-Stage-6-testing
or after a future feature gets bolted on.

**Solution:** Prefix every route with `/api/v1/`. A breaking change to a
request or response shape ships as `/api/v2/`, running alongside `/v1/`
until the adapter is updated to match, instead of mutating `/v1/` in place
and silently breaking whatever's already calling it. Non-breaking additions
(a new optional field, a new route) don't need a version bump — see
`research.md` §10 for what counts as "breaking" here.

### Transport: stdio MCP, two tools

**Problem:** Claude Code needs to push a batch and then learn the outcome,
without a human re-explaining context across the round trip.

**Solution:** A stdio MCP server (since Claude Code and the server are on
the same machine for now) exposing:
- `submit_examples` — item metadata + numbered examples → returns
  `{item_uuid, batch_id, version}`
- `await_decision` — batch id → blocks, polling a local API, until a
  decision is recorded or a timeout elapses, then returns the full decision
  JSON

The MCP process itself holds no state — it's a thin adapter that calls a
small persistent API service over `localhost` HTTP. That keeps "speaks MCP"
and "owns the database" as separate, independently debuggable concerns,
which also avoids SQLite write contention from multiple short-lived stdio
subprocess spawns.

### Screenshot: `html-to-image`, client-side, no headless browser

**Problem:** Claude Code wants a visual reference of what was decided, not
just code.

**Solution:** `html-to-image` (actively maintained, TypeScript-native,
handles text/icon/SVG-heavy UI better than `html2canvas` — see `research.md`
§4) captures the decided example's DOM node at the moment of decision,
straight in the browser, no extra service. Stored as base64 PNG alongside
the decision row.

---

## Why not the alternatives

- **Keep Svelte as the host, sandbox JSX inside an iframe:** doable, but
  doesn't remove the hard part — you'd still need a JSX transpiler and an
  isolated mount point, just behind a postMessage bridge instead of a direct
  mount. The only thing Svelte bought was the learning goal, which is gone.
- **A full bundler/import resolver for submissions:** lets Claude import
  anything, but means resolving and bundling arbitrary npm packages at
  preview time — real complexity for a benefit (free-form imports) this
  tool doesn't need. A fixed scope covers nearly everything a UI mockup
  requires.
- **Playwright/headless Chromium for screenshots:** more faithful for exotic
  CSS, but it's a whole extra service (browser binary, process management)
  for a feature whose only consumer is "a quick visual reference passed back
  to Claude Code." Client-side capture is the right size for the job;
  Playwright is the documented upgrade path if fidelity ever becomes a real
  problem.

---

## Solution map

```
Claude Code
   │  submit_examples(item, examples[])
   ▼
MCP stdio server  ──HTTP (localhost)──►  Core API service ──► SQLite
   │  await_decision(batch_id)                  ▲
   ▼                                             │ REST
(blocks, polling)                                │
                                          Review web app (React + Vite)
                                          - gallery, live-rendered via react-live
                                          - decision controls (accept / direction / refused)
                                          - screenshot via html-to-image on decision
                                                  │
                                                  ▼
                                          decision recorded in SQLite
   ▲
   │  returns {status, comment, selected_number, jsx, version, screenshot}
Claude Code
```

---

## Stage bundles (Day 1)

### Stage 0 — Reset
**Goal:** SvelteKit scaffold gone, Vite + React + TS + Tailwind in its place.

### Stage 1 — Storage & versioning
**Goal:** SQLite schema in place. Versioning is a pure, unit-tested
function, decoupled from everything else.

### Stage 2 — Core API
**Goal:** Express service: create item, submit batch, fetch pending batch,
record decision, fetch decision. Fully testable with `curl`, no UI needed
yet.

### Stage 3 — MCP adapter
**Goal:** stdio server exposing `submit_examples` and `await_decision`,
proxying to the Core API. Connects cleanly from `claude mcp list`.

### Stage 4 — Review UI
**Goal:** Gallery page, `react-live` rendering with a fixed scope,
per-example error boundary, decision form.

### Stage 5 — Screenshot
**Goal:** `html-to-image` wired into the decision flow, round-trips through
the database and back out through `await_decision`.

### Stage 6 — End-to-end smoke test
**Goal:** A real Claude Code session runs the whole loop once: submit, you
decide in the browser, Claude Code receives and can act on the JSON.

---

## Long-term migration notes

| Current state | Target state | When |
|---|---|---|
| SQLite | Postgres, if multi-user or homelab-hosted | Only if the bench outgrows single-user use |
| MCP stdio transport | HTTP transport | Only if the bench moves onto the homeserver |
| Client-side screenshot (`html-to-image`) | Playwright/headless Chromium | Only if visual fidelity becomes a real problem |
| Fixed component scope | Wider/no allowlist | Only if the fixed scope proves too restrictive in practice |
