# Stage 6 — Screenshot

**Goal:** `html-to-image` capture wired into the decision submit handler. Screenshot round-trips through the DB and back out via `await_decision`.

No new API routes. No schema changes. Server is untouched.

---

## 6.1 Background colour constant

Define the capture background in one place alongside the theme tokens in `web/src/styles/theme.css`, then export it as a TypeScript constant so the capture call and the CSS stay in sync:

`web/src/lib/theme.ts`:

```ts
// Matches the dark-mode page background (Zinc-950) used in theme.css
export const CAPTURE_BG = '#09090b'
```

Import this constant in `DecisionForm.tsx` — do not hardcode the hex inline in the handler.

## 6.2 Wire capture into `DecisionForm`

`html-to-image` is already installed from Stage 0. Import `toPng`:

```ts
import { toPng } from 'html-to-image'
import { CAPTURE_BG } from '../lib/theme'
```

In the submit handler, before calling `submitDecision`:

```ts
async function handleSubmit() {
  const validation = validateDecision({ status, comment, selectedNumber })
  if (!validation.valid) return

  // Determine which example node to capture
  const effectiveNumber = status === 'refused' ? 1 : (selectedNumber || 1)
  const node = exampleRefs.current.get(effectiveNumber)
    ?? exampleRefs.current.values().next().value

  let screenshotBase64: string | undefined
  if (node) {
    screenshotBase64 = await toPng(node, { backgroundColor: CAPTURE_BG })
  }

  await submitDecision(batchId, {
    status,
    comment: comment || undefined,
    selectedNumber,
    screenshotBase64,
  })

  onDecided()
}
```

The `exampleRefs` map is populated by `ReviewView` — each `ExampleCard` registers its outer `div` ref into the map keyed by `example.number`.

## 6.3 Ref wiring in `ReviewView`

```tsx
const exampleRefs = useRef<Map<number, HTMLDivElement>>(new Map())

// In the gallery render:
{batch.examples.map((ex) => (
  <ExampleCard
    key={ex.number}
    example={ex}
    containerRef={(el) => {
      if (el) exampleRefs.current.set(ex.number, el)
      else exampleRefs.current.delete(ex.number)
    }}
  />
))}

<DecisionForm
  batchId={batch.id}
  examples={batch.examples}
  exampleRefs={exampleRefs}
  onDecided={() => setSelectedUuid(null)}
/>
```

## Stage 6 success condition

Manually invoke `await_decision` from a Claude Code session against an already-decided batch. Confirm:

- `screenshot_base64` is a non-empty string
- Decoding it (e.g. `echo "<base64>" | base64 -d > out.png && open out.png`) produces a recognisable image of the captured example
