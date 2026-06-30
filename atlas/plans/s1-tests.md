# Stage 1 — Test suite (acceptance conditions)

**Approach:** Write test files only — no stub implementations. Imports resolve to nothing until later stages create the modules; that's intentional signal. Each stage's success condition is "the test files mapped to it all pass."

---

## File layout

```
server/
  src/
    versioning.test.ts     # pure unit tests — no DB, no HTTP
    api.test.ts            # integration tests — real bench_test PostgreSQL, Elysia handle()

web/
  src/
    decisionForm.test.ts   # form validation logic unit tests
    apiClient.test.ts      # API client function tests (fetch mocked)
```

Server tests use **`bun test`** (`bun:test` import). `api.test.ts` drives the Elysia app via **`.handle(new Request(...))`** (no HTTP port). Web tests use **vitest** with **jsdom**.

---

## `server/src/versioning.test.ts`

Pure unit tests. Only import: the `applyDecision` function.

| # | Assertion |
|---|---|
| 1 | `accepted` from `{major:0, minor:0}` → `{finalVersion:"1.0", nextMajor:1, nextMinor:0}` |
| 2 | `direction` from `{major:0, minor:0}` → `{finalVersion:"0.0", nextMajor:0, nextMinor:1}` |
| 3 | `refused` from `{major:0, minor:0}` → identical result to `direction` |
| 4 | Five-batch sequence (research.md §7), feeding each call's `next*` output into the next call: |
|   | batch 1 `direction` → `finalVersion:"0.0"` |
|   | batch 2 `direction` → `finalVersion:"0.1"` |
|   | batch 3 `accepted`  → `finalVersion:"1.0"` |
|   | batch 4 `direction` → `finalVersion:"1.0"` |
|   | batch 5 `accepted`  → `finalVersion:"2.0"` |

**Goes green at:** Stage 2 (Storage & versioning)

---

## `server/src/api.test.ts`

Integration tests. `beforeEach` truncates all tables in the `bench_test` PostgreSQL database (see `atlas/plans/s2-storage.md` §2.3). All routes are under `/api/v1/`.

### Items

| # | Request | Expected |
|---|---|---|
| 1 | `POST /api/v1/items` `{name, goal}` | 201, body has `uuid`, `major:0`, `minor:0` |
| 2 | `POST /api/v1/items` missing `name` | 400, readable error message |

### Batches

| # | Request | Expected |
|---|---|---|
| 3 | `POST /api/v1/items/:uuid/batches` valid examples | 201, body has `batch_id`, `version:"0.0"` |
| 4 | `GET /api/v1/items/:uuid/pending` before any batch | `null` |
| 5 | `GET /api/v1/items/:uuid/pending` after submitting | returns batch with examples |

### Decisions

| # | Request | Expected |
|---|---|---|
| 6  | `GET /api/v1/batches/:id/decision` before deciding | 404 |
| 7  | `POST /api/v1/batches/:id/decision` `{status:"accepted"}` | 200, `final_version:"1.0"` |
| 8  | `POST /api/v1/batches/:id/decision` `{status:"direction", comment:"..."}` | 200, `final_version:"0.0"` |
| 9  | `POST /api/v1/batches/:id/decision` `{status:"direction"}` no comment | 400 |
| 10 | `POST /api/v1/batches/:id/decision` `{status:"refused"}` no comment | 400 |
| 11 | `POST /api/v1/batches/:id/decision` twice on same batch | 409 |
| 12 | `GET /api/v1/batches/:id/decision` after deciding | 200, full decision record |

### Versioning through HTTP

| # | Scenario | Expected |
|---|---|---|
| 13 | Five-batch sequence end-to-end via HTTP (mirrors versioning.test.ts §4) | `final_version` at each step matches the state machine |

**Goes green at:** Stage 3 (Core API)

---

## `web/src/decisionForm.test.ts`

Unit tests for the form's validation logic — a pure function extracted from the component, not the component itself.

| # | Input | Expected |
|---|---|---|
| 1 | `accepted`, no comment | valid |
| 2 | `direction`, no comment | invalid — error references comment requirement |
| 3 | `direction`, with comment | valid |
| 4 | `refused`, no comment | invalid |
| 5 | `refused`, with comment | valid |
| 6 | `refused`, `selected_number` ≠ 0 | invalid — picker must be locked to "none" |
| 7 | `accepted`, `selected_number: 0` | valid |
| 8 | `direction`, `selected_number: 0` | valid |

**Goes green at:** Stage 5 (Review UI)

---

## `web/src/apiClient.test.ts`

Unit tests for fetch wrapper functions. `globalThis.fetch` mocked via vitest.

| # | Function | Expected |
|---|---|---|
| 1 | `listPendingBatch(itemUuid)` | calls `GET /api/v1/items/:uuid/pending`, returns parsed JSON |
| 2 | `submitDecision(batchId, payload)` | calls `POST /api/v1/batches/:id/decision` with correct body, returns parsed JSON |
| 3 | non-2xx response from either | rejects with error containing the status code |

**Goes green at:** Stage 5 (Review UI)

---

## MCP adapter — no automated tests

`mcp-server.ts` is a thin stdio proxy: each tool handler makes one `fetch()` call to the Core API and returns the result. All meaningful behaviour is covered by `api.test.ts`. The acceptance condition for Stage 4 (MCP adapter) remains the manual check in `scaffold.md`: `claude mcp list` shows the server connected, and invoking `submit_examples` from a real Claude Code session returns a valid `batch_id`.

---

## Stage mapping summary

| Test file | Goes green at |
|---|---|
| `server/src/versioning.test.ts` | Stage 2 — Storage & versioning |
| `server/src/api.test.ts` | Stage 3 — Core API |
| `web/src/decisionForm.test.ts` | Stage 5 — Review UI |
| `web/src/apiClient.test.ts` | Stage 5 — Review UI |
