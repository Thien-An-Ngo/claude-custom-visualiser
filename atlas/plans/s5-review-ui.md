# Stage 5 — Review UI

**Goal:** Item list page, live-rendered gallery, decision form that writes a decision. Both web test files green.

---

## 5.0 Prerequisite — add `GET /api/v1/items` to Core API

Add to `server/src/routes/items.ts` before starting the UI work:

```ts
.get('/items', async () => {
  return db.item.findMany({ orderBy: { createdAt: 'desc' } })
})
```

No breaking change — existing routes are unaffected.

## 5.1 Fixed scope (`lib/liveScope.ts`)

```ts
import * as Lucide from 'lucide-react'
import { useState, useEffect, useMemo } from 'react'

export const liveScope = { useState, useEffect, useMemo, ...Lucide }
```

Extend this list deliberately, one library at a time, when a real submission needs something it doesn't have. Do not open it wholesale.

## 5.2 API client (`lib/apiClient.ts`)

```ts
async function apiFetch(path: string, options?: RequestInit) {
  const res = await fetch(`/api/v1${path}`, options)
  if (!res.ok) throw Object.assign(new Error('API error'), { status: res.status })
  return res.json()
}

export function listItems() {
  return apiFetch('/items')
}

export function listPendingBatch(itemUuid: string) {
  return apiFetch(`/items/${itemUuid}/pending`)
}

export function submitDecision(batchId: number, payload: Record<string, unknown>) {
  return apiFetch(`/batches/${batchId}/decision`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}
```

Vite's `server.proxy` should forward `/api/v1` to `http://localhost:3000` in `vite.config.ts`:

```ts
server: {
  proxy: {
    '/api': 'http://localhost:3000',
  },
}
```

## 5.3 Decision form validation (`lib/decisionFormValidation.ts`)

Pure function — no imports, no side effects:

```ts
export type DecisionStatus = 'accepted' | 'direction' | 'refused'

export interface DecisionFormValues {
  status: DecisionStatus
  comment: string
  selectedNumber: number
}

export interface ValidationResult {
  valid: boolean
  error?: string
}

export function validateDecision(values: DecisionFormValues): ValidationResult {
  if (
    (values.status === 'direction' || values.status === 'refused') &&
    !values.comment.trim()
  ) {
    return { valid: false, error: 'A comment is required for Direction and Refused decisions' }
  }
  if (values.status === 'refused' && values.selectedNumber !== 0) {
    return { valid: false, error: 'Selected example must be "none" for Refused decisions' }
  }
  return { valid: true }
}
```

## 5.4 Write decisionForm.test.ts and apiClient.test.ts

Write `web/src/decisionForm.test.ts` and `web/src/apiClient.test.ts` as specified in `atlas/plans/s1-tests.md`.

Configure vitest in `web/vite.config.ts`:

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { proxy: { '/api': 'http://localhost:3000' } },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
  },
})
```

`web/src/test-setup.ts`:

```ts
import '@testing-library/jest-dom'
```

Run:

```bash
cd web && bun test
```

Both test files should now pass (they only test `validateDecision` and the `apiClient` fetch wrappers — no component rendering required).

## 5.5 Component structure

```
web/src/
  components/
    ItemList.tsx
    ReviewView.tsx
    ExampleCard.tsx
    DecisionForm.tsx
  App.tsx         ← state-based routing
```

### `App.tsx`

```tsx
import { useState } from 'react'
import { ItemList } from './components/ItemList'
import { ReviewView } from './components/ReviewView'

export default function App() {
  const [selectedUuid, setSelectedUuid] = useState<string | null>(null)

  return selectedUuid
    ? <ReviewView itemUuid={selectedUuid} onBack={() => setSelectedUuid(null)} />
    : <ItemList onSelect={setSelectedUuid} />
}
```

### `ItemList.tsx`

Polls `listItems()` every 3 seconds. Renders a Shadcn `Card` per item showing `name` and `goal`. A `Badge` reads "PENDING" (accent colour) when the item has an undecided batch — determined by `GET /api/v1/items/:uuid/pending` returning non-null, or by a convention: if `listPendingBatch` is too many requests, add a `hasPending` boolean to the `GET /api/v1/items` response instead (non-breaking addition). Clicking a card calls `onSelect(item.uuid)`.

### `ReviewView.tsx`

Calls `listPendingBatch(itemUuid)`. If `null`, renders a "No pending batch" message with a Back button. Otherwise renders:

1. A header with item name and Back button
2. The example gallery (one `ExampleCard` per example)
3. `DecisionForm`

Holds a `exampleRefs = useRef<Map<number, HTMLDivElement>>(new Map())` and passes it to both `ExampleCard` (for ref registration) and `DecisionForm` (for screenshot capture in Stage 6).

### `ExampleCard.tsx`

```tsx
import { LiveProvider, LivePreview, LiveError } from 'react-live'
import { liveScope } from '../lib/liveScope'
import { forwardRef } from 'react'

interface Props {
  example: { number: number; jsx: string }
  containerRef: (el: HTMLDivElement | null) => void
}

export function ExampleCard({ example, containerRef }: Props) {
  return (
    <div ref={containerRef} className="rounded-lg border bg-card p-4">
      <p className="text-xs text-muted-foreground mb-2">#{example.number}</p>
      <LiveProvider code={example.jsx} scope={liveScope} noInline>
        <LiveError className="text-destructive text-sm font-mono" />
        <LivePreview />
      </LiveProvider>
    </div>
  )
}
```

### `DecisionForm.tsx`

Shadcn components: `RadioGroup` + `RadioGroupItem` (status), `Textarea` (comment), `Select` (example picker), `Button` (submit).

State: `status`, `comment`, `selectedNumber`. On status change to `refused`, reset `selectedNumber` to `0` and disable the picker.

Calls `validateDecision` before enabling the submit button. On submit, calls the `onSubmit` prop (implemented in Stage 6 to add screenshot capture before calling `submitDecision`).

Props:

```ts
interface DecisionFormProps {
  batchId: number
  examples: { number: number }[]
  exampleRefs: React.RefObject<Map<number, HTMLDivElement>>
  onDecided: () => void
}
```

## Stage 5 success condition

- `cd web && bun test` — `decisionForm.test.ts` and `apiClient.test.ts` pass
- Manual: seed a batch via the Stage 3 curl sequence, open `localhost:5173`, see the item with a PENDING badge, click it, see 2–3 live-rendered examples, submit a decision, confirm `GET /api/v1/batches/:id/decision` reflects it
