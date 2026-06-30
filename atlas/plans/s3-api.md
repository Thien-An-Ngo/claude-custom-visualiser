# Stage 3 — Core API

**Goal:** All five routes implemented, validated, and tested. Both server test files green.

---

## 3.1 Route structure

```
server/src/
  routes/
    items.ts       ← POST /api/v1/items
    batches.ts     ← POST /api/v1/items/:uuid/batches
                      GET  /api/v1/items/:uuid/pending
    decisions.ts   ← POST /api/v1/batches/:id/decision
                      GET  /api/v1/batches/:id/decision
  index.ts         ← mounts all plugins, exports app, optionally listens
  db.ts            ← (from Stage 2)
  versioning.ts    ← (from Stage 2)
```

Each route file exports a `new Elysia({ prefix: '/api/v1' })` plugin. `index.ts` mounts all three and exports the composed `app` for testing.

## 3.2 App entry point (`index.ts`)

```ts
import { Elysia } from 'elysia'
import { itemsPlugin } from './routes/items'
import { batchesPlugin } from './routes/batches'
import { decisionsPlugin } from './routes/decisions'

export const app = new Elysia()
  .use(itemsPlugin)
  .use(batchesPlugin)
  .use(decisionsPlugin)

// Only listen when run directly — not when imported by tests
if (import.meta.main) {
  app.listen(3000)
  console.log('Server running on port 3000')
}
```

Exporting `app` without calling `listen()` is what allows `app.handle(new Request(...))` in tests.

## 3.3 Items routes (`routes/items.ts`)

```ts
import { Elysia, t } from 'elysia'
import { db } from '../db'

export const itemsPlugin = new Elysia({ prefix: '/api/v1' }).post(
  '/items',
  async ({ body, set }) => {
    const item = await db.item.create({
      data: { name: body.name, goal: body.goal },
    })
    set.status = 201
    return item
  },
  {
    body: t.Object({
      name: t.String({ minLength: 1 }),
      goal: t.String({ minLength: 1 }),
    }),
  },
)
```

Elysia auto-returns 422 for schema violations (covers test #2: missing `name`).

## 3.4 Batches routes (`routes/batches.ts`)

**`POST /api/v1/items/:uuid/batches`**

1. Look up the item (404 if not found)
2. Read its current `major`/`minor` — that pair is the `pending_version`
3. Create the `Batch` row and all `Example` rows in one `$transaction`
4. Return `{ batch_id: batch.id, version: "${major}.${minor}" }`, status 201

```ts
import { Elysia, t, error } from 'elysia'
import { db } from '../db'

export const batchesPlugin = new Elysia({ prefix: '/api/v1' })
  .post(
    '/items/:uuid/batches',
    async ({ params, body, set }) => {
      const item = await db.item.findUnique({ where: { uuid: params.uuid } })
      if (!item) return error(404, { message: 'item not found' })

      const batch = await db.$transaction(async (tx) => {
        const b = await tx.batch.create({
          data: { itemUuid: item.uuid, major: item.major, minor: item.minor },
        })
        await tx.example.createMany({
          data: body.examples.map((e) => ({ batchId: b.id, number: e.number, jsx: e.jsx })),
        })
        return b
      })

      set.status = 201
      return { batch_id: batch.id, version: `${item.major}.${item.minor}` }
    },
    {
      body: t.Object({
        examples: t.Array(
          t.Object({ number: t.Integer(), jsx: t.String({ minLength: 1 }) }),
          { minItems: 1 },
        ),
      }),
    },
  )
  .get('/items/:uuid/pending', async ({ params }) => {
    const batch = await db.batch.findFirst({
      where: { itemUuid: params.uuid, decision: null },
      include: { examples: true },
      orderBy: { id: 'desc' },
    })
    return batch ?? null
  })
```

## 3.5 Decisions routes (`routes/decisions.ts`)

**`POST /api/v1/batches/:id/decision`**

Manual conditional validation runs before any DB write:

```ts
if (
  (body.status === 'direction' || body.status === 'refused') &&
  !body.comment?.trim()
) {
  return error(400, { message: 'comment is required for direction and refused decisions' })
}
if (body.status === 'refused' && (body.selectedNumber ?? 0) !== 0) {
  return error(400, { message: 'selected_number must be 0 for refused decisions' })
}
```

Then:

1. Check for existing decision → 409 if found
2. Load the batch → 404 if not found
3. Load the item via `batch.itemUuid`
4. Call `applyDecision(item, body.status)` → `{ finalVersion, nextMajor, nextMinor }`
5. In one `$transaction`: create `Decision` row with `finalVersion`, update `Item` with `nextMajor`/`nextMinor`
6. Return the decision record, status 200

```ts
import { Elysia, t, error } from 'elysia'
import { db } from '../db'
import { applyDecision } from '../versioning'

export const decisionsPlugin = new Elysia({ prefix: '/api/v1' })
  .post(
    '/batches/:id/decision',
    async ({ params, body }) => {
      // Conditional validation
      if (
        (body.status === 'direction' || body.status === 'refused') &&
        !body.comment?.trim()
      ) {
        return error(400, { message: 'comment is required for direction and refused decisions' })
      }
      if (body.status === 'refused' && (body.selectedNumber ?? 0) !== 0) {
        return error(400, { message: 'selected_number must be 0 for refused decisions' })
      }

      const batchId = Number(params.id)

      const existing = await db.decision.findUnique({ where: { batchId } })
      if (existing) return error(409, { message: 'already decided' })

      const batch = await db.batch.findUnique({ where: { id: batchId } })
      if (!batch) return error(404, { message: 'batch not found' })

      const item = await db.item.findUniqueOrThrow({ where: { uuid: batch.itemUuid } })
      const { finalVersion, nextMajor, nextMinor } = applyDecision(item, body.status)

      const decision = await db.$transaction(async (tx) => {
        const d = await tx.decision.create({
          data: {
            batchId,
            status: body.status,
            comment: body.comment ?? null,
            selectedNumber: body.selectedNumber ?? 0,
            screenshotBase64: body.screenshotBase64 ?? null,
            finalVersion,
          },
        })
        await tx.item.update({
          where: { uuid: batch.itemUuid },
          data: { major: nextMajor, minor: nextMinor },
        })
        return d
      })

      return decision
    },
    {
      body: t.Object({
        status: t.Union([t.Literal('accepted'), t.Literal('direction'), t.Literal('refused')]),
        comment: t.Optional(t.String()),
        selectedNumber: t.Optional(t.Integer()),
        screenshotBase64: t.Optional(t.String()),
      }),
    },
  )
  .get('/batches/:id/decision', async ({ params }) => {
    const decision = await db.decision.findUnique({
      where: { batchId: Number(params.id) },
    })
    if (!decision) return error(404, { message: 'no decision yet' })
    return decision
  })
```

## 3.6 Write api.test.ts

Write `server/src/api.test.ts` as specified in `atlas/plans/s1-tests.md`, using the Elysia-native test pattern:

```ts
import { describe, it, expect, beforeEach } from 'bun:test'
import { app } from './index'
import { db } from './db'

async function req(path: string, options?: RequestInit) {
  return app.handle(new Request(`http://localhost${path}`, options))
}

function post(path: string, body: unknown) {
  return req(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(async () => {
  await db.$executeRaw`TRUNCATE TABLE decisions, examples, batches, items RESTART IDENTITY CASCADE`
})
```

All 13 test cases from the spec use `req()` / `post()` instead of supertest's chained API.

## Stage 3 success condition

- `cd server && bun test` — both `versioning.test.ts` and `api.test.ts` pass (all 13 + 4 tests)
- Manual curl sequence:
  1. `curl -s -X POST http://localhost:3000/api/v1/items -H 'Content-Type: application/json' -d '{"name":"btn","goal":"test"}' | jq .uuid`
  2. `curl -s -X POST http://localhost:3000/api/v1/items/:uuid/batches -H 'Content-Type: application/json' -d '{"examples":[{"number":1,"jsx":"render(<div>A</div>)"},{"number":2,"jsx":"render(<div>B</div>)"}]}' | jq .`  → `version: "0.0"`
  3. `curl -s http://localhost:3000/api/v1/items/:uuid/pending | jq .`  → batch with examples
  4. `curl -s -X POST http://localhost:3000/api/v1/batches/:id/decision -H 'Content-Type: application/json' -d '{"status":"accepted","selectedNumber":1}' | jq .final_version`  → `"1.0"`
  5. `curl -s http://localhost:3000/api/v1/batches/:id/decision | jq .`  → same record
