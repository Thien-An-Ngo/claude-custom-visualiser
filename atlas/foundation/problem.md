# Problem

---

## Problem statement

Give Claude Code a way to propose several candidate UI component designs for a
named "item," let a human review live-rendered previews of each candidate,
record one of three decisions per review round, and feed that decision back
to Claude Code as structured JSON — including which example (if any) was
picked, its JSX, a screenshot, and a version number that tracks how many
revision rounds and how many full acceptances the item has gone through.

This is a personal, single-user design-review bench, not a public product.
Claude Code is the producer. You are the only reviewer. Nobody else ever
touches it.

---

## Context

### What changed from the original plan

- The repo was scaffolded as SvelteKit (`sv create` defaults: Svelte 5,
  Tailwind 4, bits-ui, lucide-svelte, gsap). Nothing project-specific was
  ever written into it — no MCP server, no database, no review UI. The
  `CLAUDE.md` and `.mcp.json` already in the repo are stock Svelte-docs MCP
  boilerplate, unrelated to this tool.
- Learning Svelte was the original motivation for that scaffold. That's no
  longer a requirement, so the framework choice is now driven purely by "what
  renders Claude's output most reliably," not by a learning goal.
- This document supersedes the scaffold. The repo is being rebuilt from zero.

### The actors

- **Claude Code** — runs locally on your machine (for now). Produces batches
  of UI component candidates for a given item, submits them, and waits for a
  decision.
- **You** — review rendered previews in a browser. Pick accepted / direction
  / refused, optionally with a comment, optionally pick which example
  number.
- **The bench** — the system being designed: storage, an MCP server, a small
  API, and a review web app.

### Hard constraints

- Single user, single reviewer. No auth or multi-tenant concerns for Day 1.
- Submitted code must render live, not just display as text — you're
  evaluating a design, not reading source.
- The decision returned to Claude Code must be structured JSON, so a Claude
  Code session can act on it programmatically without parsing prose.
- Versioning must be automatic and consistent: `0.0` → … → `1.0` on first
  acceptance → `1.1`, `1.2` … → `2.0` on next acceptance → and so on,
  indefinitely, for the life of the item.

---

## Atomic issues

### Component format

| ID | Issue |
|----|-------|
| C1 | Decide the language/format Claude Code generates components in — **resolved below, see "Decision: component format"** |
| C2 | Define a fixed allowlist of importable libraries/components so submissions render without a live package resolver |
| C3 | Submitted code must render without a build step at submission time (no `npm install` per submission) |

### Item & versioning

| ID | Issue |
|----|-------|
| I1 | Items are identified by UUID, with a name and a goal/prompt/idea string |
| I2 | Version is `major.minor`, starts at `0.0`. A decision of `accepted` stamps the just-reviewed batch as `(major+1).0` and resets the running minor counter. A decision of `direction` or `refused` leaves the batch at its submitted `major.minor`, and the *next* batch increments `minor`. |
| I3 | One MCP submission = one batch = one review round = one version number |

### Transport (MCP)

| ID | Issue |
|----|-------|
| T1 | An MCP tool to submit a batch: item metadata + N numbered examples |
| T2 | An MCP tool that blocks (with timeout) until a decision is recorded for that batch, then returns it |
| T3 | Day 1: `stdio` transport, server and Claude Code on the same machine. Future: HTTP transport if this ever moves onto the homelab/mesh — not in scope now. |

### Storage

| ID | Issue |
|----|-------|
| S1 | Items table |
| S2 | Batches (submissions/versions) table |
| S3 | Examples table, one row per numbered example in a batch |
| S4 | Decisions table, one row per batch: status, comment, selected example number, screenshot |

### Core API

| ID | Issue |
|----|-------|
| A1 | All Core API routes are versioned via URL prefix (`/api/v1/...`) so the HTTP contract between the Core API and the MCP adapter can evolve later without silently breaking whichever adapter build happens to already be running |

### Rendering / review UI

| ID | Issue |
|----|-------|
| R1 | Gallery view per pending batch, all examples rendered live |
| R2 | A broken example must not take down the whole review page (error boundary per example) |
| R3 | Decision controls: Accept / Direction (comment) / Refused (comment), example picker |
| R4 | Screenshot of the decided example captured at decision time, stored with the decision |

---

## Decision: component format

**Claude Code generates React-style functional components (JSX/TSX), single
default export, no required props.**

Full reasoning is in `research.md`. Short version: it's what Claude is most
reliably fluent in, it's the same pattern Anthropic's own equivalent
feature already uses for the identical problem ("Claude generates a UI
candidate, a human looks at it"), and a single-default-export functional
component is the smallest, most well-defined "what does a valid submission
look like" surface — which matters once submissions are validated and
rendered automatically instead of read by a human in an editor.

This also settles the host app: it should be React, not Svelte. Not because
cross-framework rendering is impossible, but because matching languages
end-to-end unlocks rendering submissions with an off-the-shelf live-preview
library (`react-live`) instead of a hand-built iframe/sandbox bridge. See
`research.md` §1–2.

SolidJS was also considered, since it also uses JSX, and rejected. Solid's
reactivity model (props are getters and silently lose reactivity if
destructured, signals are accessor functions rather than values, components
execute once) creates a bug class that's specifically bad for unattended
generation: a component can render correctly on first paint and then
silently stop updating, which is exactly the kind of failure a quick visual
review won't catch. There's also no maintained `react-live` equivalent for
Solid to build the gallery on. Full comparison in `research.md` §9.

---

## Decision: storage engine

**SQLite, not Mongo or a Postgres server.**

The original spec asked for "MongoDB or equivalent PostgreSQL document db."
The actual requirement underneath that is "flexible enough to hold a JSX
blob plus loose metadata per example" — not specifically those two engines.
A SQLite file with a JSON column on the examples table gives the same
flexibility with zero services to run, which is the same reasoning already
applied to Forgejo in the Obsidian-vault-sync project: single user, low
traffic, SQLite avoids an entire class of ops problems for no real cost. If
this bench ever becomes multi-user or moves onto the homeserver alongside
other Postgres-backed services, migrating off SQLite later is a contained,
well-understood step — not a Day-1 concern.

**This is an explicit override point.** If you want the Postgres/Mongo
experience for its own sake, say so and the plan changes; nothing else in
the architecture depends on which one you pick.

---

## Open question to confirm: what does "refused" do to versioning?

The spec defines version bumps clearly for `accepted`, and implies
`direction` doesn't bump the major version. It doesn't say what `refused`
does. Two reasonable options:

- **A (assumed below, default):** `refused` behaves like `direction` for
  versioning — it's just "not accepted," so the item stays in the same
  minor-increment cycle. The only difference between `direction` and
  `refused` is the comment attached, which Claude Code reads to decide
  whether to tweak the existing direction or start over completely.
- **B:** `refused` resets the item back toward `major.0` of the current
  major (discarding this cycle's revision history), or archives the item
  entirely.

Going with **A** unless you say otherwise — simpler, reversible, doesn't
destroy history, and is a one-line change later if you want B.

---

## Explicitly out of scope (Day 1)

- Authentication, multiple reviewers, public exposure
- Arbitrary npm imports in submitted components — fixed allowlist only
- HTTP/remote MCP transport, hosting on the homeserver
- Editing examples in the browser (this is a review bench, not a code editor)
- Notifications when a decision is ready
- More than one screenshot per decision
