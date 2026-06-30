# Research

Living knowledge base. Updated throughout the project.

---

## Table of contents

1. [Why JSX/React as Claude's generation target](#1-why-jsxreact-as-claudes-generation-target)
2. [react-live](#2-react-live)
3. [@babel/standalone (fallback)](#3-babelstandalone-fallback)
4. [Screenshot libraries: html-to-image vs html2canvas vs Playwright](#4-screenshot-libraries-html-to-image-vs-html2canvas-vs-playwright)
5. [MCP transport (stdio vs HTTP vs SSE)](#5-mcp-transport-stdio-vs-http-vs-sse)
6. [better-sqlite3](#6-better-sqlite3)
7. [Versioning state machine](#7-versioning-state-machine)
8. [Known issues and gotchas log](#8-known-issues-and-gotchas-log)
9. [React vs Solid for Claude's generation target](#9-react-vs-solid-for-claudes-generation-target)
10. [API versioning convention](#10-api-versioning-convention)

---

## 1. Why JSX/React as Claude's generation target

Two converging reasons, not one:

**Training-data fluency.** React/JSX has far more representation in the
training corpus, in both volume and recency, than Svelte — and Svelte 5's
runes syntax is recent enough that mixed old/new idioms are a real failure
mode for unattended, automated generation (nobody's there to notice and fix
it before it's rendered).

**Precedent.** "Claude generates a piece of UI, a human looks at it and
decides" is not a new problem — it's the same one Anthropic's own
equivalent feature (the interactive component preview built into claude.ai)
already solved, and it converged on exactly this shape: single-default-export
React functional components, a fixed and small allowlist of importable
libraries (an icon set, a charting library, a small UI kit) rather than
free-form npm imports, and Tailwind utility classes for styling. That
combination is the most reliable, most bounded target available for "an LLM
writes UI code that gets rendered without a human pre-screening it."

**Practical follow-on:** a single-default-export functional component with
no required props is also the easiest possible shape to validate before
rendering (one parse, one expected export, no prop-contract guessing).

---

## 2. react-live

**What it is:** A library for taking a string of JSX, transpiling it in the
browser, and rendering it live with a built-in error boundary. Originally
built by Formidable Labs for documentation playgrounds (it's what powers
live, editable code blocks on many component-library doc sites).

**Current state (checked June 2026):** Latest release is `react-live@4.1.8`.
The codebase was migrated to TypeScript at v4.0.0. The GitHub repo is marked
"Active" by the maintainers, 4.5k+ stars, real production dependents
(e.g. gluestack-ui). Recent release notes show ongoing maintenance, including
a fix that wraps the preview in an error boundary more robustly.

**Relevant API surface for this project:**
- `LiveProvider` — top-level context, takes `code` (the JSX string) and
  `scope` (an object of names available inside that code, e.g. `{ React,
  useState, Icon }`)
- `noInline` mode — code is treated as imperative; the example string must
  end with a `render(<ComponentName />)` call rather than relying on
  implicit last-expression rendering. **Recommended for this project** —
  require every submitted example to end with its own `render(...)` call.
  This removes ambiguity about which exported thing should actually be
  mounted, which matters once examples are generated unattended rather than
  written by a human who'll just fix it if it's wrong.
- `LivePreview` — renders the result
- `LiveError` — renders a transpile/runtime error message instead of a blank
  screen; render one of these per example so a broken example shows an
  inline error without taking the rest of the gallery down

**Caveat:** `react-live`'s `scope` is a fixed set of names you provide — it
does not resolve arbitrary npm imports. This is the mechanism that enforces
the fixed allowlist from `problem.md` C2; it's a feature for this use case,
not a limitation to work around.

---

## 3. @babel/standalone (fallback)

The lower-level tool `react-live` itself is built on. Officially maintained
by the Babel team, documented at babeljs.io. If `react-live`'s scope
mechanism or transpiler ever proves too restrictive (e.g. you want a
slightly different Babel preset/plugin set), dropping to `@babel/standalone`
directly plus a small custom wrapper (transpile → `new Function` with
React/ReactDOM injected → mount inside an error boundary) is a well-trodden
path — several small open-source JSX viewers use exactly this pattern. Not
needed for Day 1; noted here so the escape hatch is documented before it's
needed.

---

## 4. Screenshot libraries: html-to-image vs html2canvas vs Playwright

| | html-to-image | html2canvas | Playwright (headless) |
|---|---|---|---|
| Where it runs | Browser, client-side | Browser, client-side | Separate Node process, real browser engine |
| Maintenance | Active, TypeScript-native | Mature but slow-moving | Active (Microsoft) |
| Best for | Text/icon/SVG-heavy UI, modern CSS (flexbox/grid/vars) | Canvas/WebGL-heavy content, legacy CSS | Pixel-perfect fidelity, any CSS |
| Cost | None — just a function call | None — just a function call | A whole extra service/process to run and manage |

**Decision:** `html-to-image` for Day 1. The bench's examples are ordinary
Tailwind/React markup — exactly the case it handles best — and it avoids
standing up a headless-browser service for a feature that only needs to
produce "a quick visual reference," not a pixel-perfect archival image.
`html2canvas` remains the fallback if a specific example uses canvas/WebGL
content that `html-to-image` mishandles. Playwright is the real upgrade path
if fidelity ever matters more than convenience — not a Day-1 concern.

---

## 5. MCP transport (stdio vs HTTP vs SSE)

- **stdio** — the MCP client spawns the server as a local subprocess and
  talks over stdin/stdout. No networking, no auth. Correct choice while
  Claude Code and the bench run on the same machine.
- **HTTP (Streamable HTTP)** — the recommended transport for remote/networked
  MCP servers as of current Claude Code docs; supports OAuth natively. This
  is the upgrade path if the bench is ever hosted on the homeserver and
  reached from elsewhere (e.g. over the Headscale mesh, the same way Forgejo
  is mesh-internal-only).
- **SSE** — the original remote transport, now deprecated in favor of HTTP.
  Don't build new servers on it.

**Critical stdio gotcha:** stdio transport uses stdout as the JSON-RPC
channel. Any stray `console.log()` in the server process corrupts the
message stream and looks like a transport error rather than a logging
mistake. Log to stderr or a file, never stdout, in the MCP adapter process.

**Other stdio gotchas worth knowing up front:**
- MCP servers run in a stripped environment — shell config (`.bashrc`,
  `.zshrc`, `$PATH`) is not inherited. If the server needs an env var,
  it must be passed explicitly in the MCP config's `env` block, not assumed
  from the shell.
- Register with `claude mcp add --transport stdio <name> -- node
  path/to/mcp-server.js`, verify with `claude mcp list`, and use `/mcp`
  inside a Claude Code session to confirm both tools (`submit_examples`,
  `await_decision`) appear.

---

## 6. better-sqlite3

Synchronous Node SQLite driver — no async/await ceremony for what are, in
this project, always small, fast, local reads/writes. A good fit for a
single-user, low-concurrency tool; this is the same reasoning already
applied to Forgejo's own SQLite choice for the same kind of workload.
A JSON column (stored as `TEXT`, parsed/stringified at the application
boundary) on the examples table gives document-store-like flexibility for
any loose per-example metadata without adding a server process.

---

## 7. Versioning state machine

Pure function, no side effects, fully unit-testable in isolation from the
API/DB/UI:

```
state per item: { major: int, minor: int }   // starts { major: 0, minor: 0 }

on submit_batch(item):
    pending_version = "{major}.{minor}"
    # record batch at pending_version, no DB mutation to the counters yet

on record_decision(item, status):
    if status == "accepted":
        major += 1
        final_version = "{major}.0"
        minor = 0                      # reset for whatever comes next
    elif status in ("direction", "refused"):
        final_version = "{major}.{minor}"   # batch keeps its pending version
        minor += 1                      # next batch starts one minor higher
    return final_version
```

Worked example matching the spec exactly:

```
batch 1: submit → pending 0.0 → decision "direction" → stamped 0.0, next minor = 1
batch 2: submit → pending 0.1 → decision "direction" → stamped 0.1, next minor = 2
batch 3: submit → pending 0.2 → decision "accepted"  → stamped 1.0, major = 1, minor = 0
batch 4: submit → pending 1.0 → decision "direction" → stamped 1.0, next minor = 1
batch 5: submit → pending 1.1 → decision "accepted"  → stamped 2.0, major = 2, minor = 0
```

(`refused` follows the same branch as `direction` under the Decision A
default in `problem.md` — change one branch if you confirm Decision B
instead.)

---

## 8. Known issues and gotchas log

`[2026-06] react-live noInline ambiguity` — without `noInline` + an explicit
`render()` call per example, react-live falls back to "render the last JSX
expression," which is fragile once examples are LLM-generated rather than
hand-written. **Workaround:** require every submitted example string to end
with `render(<ComponentName />)`; document this in the MCP tool's
description/schema so Claude Code writes to the convention every time.

`[2026-06] stdio + console.log` — see §5. Logging to stdout in a stdio MCP
server corrupts the JSON-RPC stream. **Workaround:** log to stderr or a file
only.

`[2026-06] html-to-image transparent background default` — captured images
default to a transparent background if the target element doesn't set one
explicitly. **Workaround:** ensure the example's outer container has an
explicit background color before capture, or pass a background color option
to the capture call.

---

## 9. React vs Solid for Claude's generation target

Solid also compiles JSX, so it's a fair question whether it'd be a better
fit than React. Checked and rejected, for two independent reasons.

**Reactivity gotchas that fail silently.** Confirmed directly from Solid's
own docs and core-team discussion threads:
- Destructuring `props` (`const { age } = props`) silently breaks
  reactivity — `age` freezes at its initial value with no error, no warning.
  This is described by Solid's own maintainers as "the biggest gotcha" in
  the framework.
- Signals are accessor *functions* (`count()`), not values (`count`) —
  conflating the two is a one-character bug that type-checks fine in plain
  JS/JSX.
- Components execute their body exactly once; there's no React-style
  re-render to fall back on if something was written with React assumptions.
- `array.map()` / ternaries directly in JSX still technically work, but
  silently forfeit Solid's fine-grained update benefits — not a correctness
  bug, but a sign that idiomatic Solid (`<For>`, `<Show>`) wasn't used.

None of this is a transpile-time error. A component built this way can
render correctly on first paint and then silently stop reacting to state
changes — which is specifically the failure mode a quick visual design
review is least likely to catch, since the reviewer is judging the initial
render, not exercising every interaction.

**No equivalent of `react-live`.** The official Solid Playground
(`solidjs/solid-playground`) is a full REPL — editor, compiler, its own
sandbox — not an embeddable "give it a scope and a code string" component.
Nothing comparable to `react-live`'s `LiveProvider`/`scope` model exists for
Solid as a maintained package; building that would mean wrapping
`babel-preset-solid` by hand, which is exactly the kind of bespoke
infrastructure choosing React was meant to avoid.

**Conclusion:** React stays the generation target and the host framework.

---

## 10. API versioning convention

Standard practice for any HTTP API with more than one piece of software
talking to it across time, even when you control every piece: prefix every
route with `/api/v1/`. The rule for what counts as "breaking" (requires a
`v2`) versus what doesn't:

**Breaking (bump the version):**
- Removing or renaming a field in a response
- Changing a field's type or meaning (e.g. `selected_number` going from
  "0 means none" to "null means none")
- Removing a route or changing what a status code means

**Not breaking (no bump needed):**
- Adding a new optional field to a response
- Adding a new route
- Adding a new optional field to a request body

In practice, with a single consumer you also control (the MCP adapter), a
`v2` mostly buys you the ability to land a breaking change without having
to redeploy both halves of the system in lockstep — useful the moment the
MCP adapter and the Core API are two separately-built artifacts, which they
are from Stage 3 onward.
