# Stage 7 — End-to-end smoke test

**Goal:** One real, unscripted round-trip through the full system. No code to write.

---

## 7.1 Start everything

```bash
# Terminal 1 — database
podman compose up

# Terminal 2 — Core API
cd server && bun run src/index.ts

# Terminal 3 — Review UI
cd web && bun run dev
```

Confirm:
- `podman compose ps` shows `db` healthy
- Core API responds: `curl -s http://localhost:3000/api/v1/items` returns `[]`
- Browser at `localhost:5173` shows the item list (empty is fine)
- `claude mcp list` shows `visualiser` connected

## 7.2 The test

From an actual Claude Code session — not a curl script:

> "Submit 2 small JSX variants of a primary button for a new item called 'button-primary', goal 'a reusable primary CTA button', then wait for the decision."

Claude Code should call `submit_examples` (which creates the item and batch) then `await_decision` and block.

While it's blocked:

1. Open `localhost:5173` — the item `button-primary` appears with a PENDING badge
2. Click it — see 2 live-rendered button variants
3. Select one, write a short comment, click Submit
4. The screenshot capture fires; the decision is posted to the API

## 7.3 Success condition

Claude Code's `await_decision` call returns unblocked with all seven fields correct:

| Field | What to verify |
|---|---|
| `status` | Matches what you selected |
| `comment` | Matches what you typed |
| `selected_number` | Matches which example you picked |
| `jsx` | The JSX string of the selected example |
| `version` | `"1.0"` if you accepted, `"0.0"` if direction/refused |
| `screenshot_base64` | Non-empty string |

Ask Claude Code to describe back what you decided. It should be able to do so correctly from the returned JSON without you repeating yourself.

---

**All stages complete.**

Anything beyond this point — HTTP MCP transport, homelab hosting, a wider component scope, managed Postgres — is an explicit, separate decision per `atlas/foundation/vision.md`'s migration notes.
