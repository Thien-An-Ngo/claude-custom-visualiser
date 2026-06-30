# Stage 2 — Storage & versioning

**Goal:** Prisma schema migrated against PostgreSQL. DB client singleton. Versioning pure function. `versioning.test.ts` passes; `api.test.ts` still errors on missing module.

---

## 2.1 Prisma schema

Replace the generated placeholder in `server/prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Item {
  uuid      String   @id @default(uuid())
  name      String
  goal      String
  major     Int      @default(0)
  minor     Int      @default(0)
  createdAt DateTime @default(now()) @map("created_at")
  batches   Batch[]

  @@map("items")
}

model Batch {
  id        Int      @id @default(autoincrement())
  itemUuid  String   @map("item_uuid")
  item      Item     @relation(fields: [itemUuid], references: [uuid])
  major     Int
  minor     Int
  createdAt DateTime @default(now()) @map("created_at")
  examples  Example[]
  decision  Decision?

  @@map("batches")
}

model Example {
  id       Int    @id @default(autoincrement())
  batchId  Int    @map("batch_id")
  batch    Batch  @relation(fields: [batchId], references: [id])
  number   Int
  jsx      String
  metadata Json?

  @@map("examples")
}

model Decision {
  batchId          Int      @id @map("batch_id")
  batch            Batch    @relation(fields: [batchId], references: [id])
  status           String
  comment          String?
  selectedNumber   Int      @default(0) @map("selected_number")
  screenshotBase64 String?  @map("screenshot_base64")
  finalVersion     String   @map("final_version")
  decidedAt        DateTime @default(now()) @map("decided_at")

  @@map("decisions")
}
```

## 2.2 Run the initial migration

Make sure Podman Compose is up (`podman compose up -d`), then from `server/`:

```bash
bunx prisma migrate dev --name init
bunx prisma generate
```

`server/prisma/migrations/` is created — commit it alongside the schema.

## 2.3 Test database

Create the `bench_test` database in the running container:

```bash
podman exec -it $(podman compose ps -q db) psql -U bench -c "CREATE DATABASE bench_test;"
```

Apply the schema to it:

```bash
DATABASE_URL=postgresql://bench:bench@localhost:5432/bench_test bunx prisma migrate deploy
```

Create `server/.env.test` (add to `.gitignore`):

```
DATABASE_URL=postgresql://bench:bench@localhost:5432/bench_test
```

Document it in `.env.example`:

```
# Dev DB
DATABASE_URL=postgresql://bench:bench@localhost:5432/bench

# Test DB — used by `bun test`
# DATABASE_URL=postgresql://bench:bench@localhost:5432/bench_test
```

Run server tests with the test DB:

```bash
cd server && DATABASE_URL=$(grep DATABASE_URL .env.test | cut -d= -f2-) bun test
```

Or add a `test` script in `server/package.json` that reads `.env.test` automatically via `--env-file`:

```json
{ "scripts": { "test": "bun test --env-file .env.test" } }
```

## 2.4 DB client

`server/src/db.ts`:

```ts
import { PrismaClient } from '@prisma/client'

export const db = new PrismaClient()
```

Single shared instance. Nothing else in the codebase imports `PrismaClient` directly — all DB access goes through this export.

## 2.5 Versioning function

`server/src/versioning.ts`:

```ts
export function applyDecision(
  item: { major: number; minor: number },
  status: 'accepted' | 'direction' | 'refused',
): { finalVersion: string; nextMajor: number; nextMinor: number } {
  if (status === 'accepted') {
    const nextMajor = item.major + 1
    return { finalVersion: `${nextMajor}.0`, nextMajor, nextMinor: 0 }
  }
  return {
    finalVersion: `${item.major}.${item.minor}`,
    nextMajor: item.major,
    nextMinor: item.minor + 1,
  }
}
```

Pure function, no imports beyond types. `refused` follows the same branch as `direction` (Decision A in `atlas/foundation/problem.md`).

## 2.6 Write versioning.test.ts

Write `server/src/versioning.test.ts` as specified in `atlas/plans/s1-tests.md`. Import from `bun:test`:

```ts
import { describe, it, expect } from 'bun:test'
import { applyDecision } from './versioning'
```

Run it:

```bash
cd server && bun test src/versioning.test.ts
```

## Stage 2 success condition

- `bun test src/versioning.test.ts` — all four test groups pass
- `bun test src/api.test.ts` (or `bun test` for the whole suite) — errors on missing module (`./index` or `./routes/...`), not a syntax error
- `bunx prisma migrate status` — shows migration applied on both `bench` and `bench_test`
