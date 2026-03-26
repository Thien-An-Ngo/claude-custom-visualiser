# Visualiser — Design Spec
**Date:** 2026-03-26
**Status:** Approved

---

## Overview

A Bun + SvelteKit (SPA mode) application for displaying design recommendation visualisations produced by Claude. Each design project gets its own route with its own Svelte component and JSON config. The app is built for modularity and expandability, with a clear seam for a future API.

---

## Visual Identity

### Colour Palette
| Role | Token | Hex |
|------|-------|-----|
| Background | `--color-bg` | `#070707` |
| Surface | `--color-surface` | `#0a0a0a` |
| Border | `--color-border` | `#1a1a1a` |
| Red (primary) | `--color-red` | `#821400` |
| Gold (accent) | `--color-gold` | `#e6b820` |
| Text primary | `--color-text` | `#e8e8e8` |
| Text muted | `--color-muted` | `#666666` |
| Text ghost | `--color-ghost` | `#333333` |

**Rules:**
- Red (`#821400`) is used exclusively for borders, glows, scanlines, grid underlays, and structural indicators — never on body text
- Gold (`#e6b820`) is reserved for active state markers, "new" badges, and key callouts — used sparingly, never decorative
- All readable text uses `--color-text` or `--color-muted`
- No gradients anywhere
- Red elements carry a subtle `box-shadow` glow: `0 0 8px rgba(130,20,0,0.5)`
- Gold elements carry a sharp glow: `0 0 8px #e6b820, 0 0 16px rgba(230,184,32,0.4)`

### Aesthetic
- **Grid underlay:** repeating 32px horizontal + vertical lines at 5% red opacity on all pages
- **Glass panels:** content cards use `background: rgba(10,10,10,0.9)`, `border: 1px solid rgba(130,20,0,0.4)`, subtle inner shadow
- **Ambient bloom:** radial red glow behind key focal points (hero title, active elements)
- **Typography:** monospace font throughout; all caps + wide letter-spacing for labels and UI chrome
- **Futuristic HUD aesthetic:** scanlines, coordinate-style labels, system boot language

---

## Architecture

### Tech Stack
- **Runtime:** Bun
- **Framework:** SvelteKit in SPA mode (`adapter-static`, `ssr: false`)
- **Component library:** shadcn-svelte (customised to the design tokens above)
- **Animations:** GSAP (timelines for page transitions, stagger for list reveals)
- **Data:** JSON config files per project, read via a stubbed API client

### Project Structure
```
src/
├── lib/
│   ├── components/
│   │   ├── ui/                  ← shadcn-svelte components
│   │   ├── layout/              ← AppShell, Sidebar, TopBar
│   │   └── visualisations/      ← shared viz primitives (ChartFrame, etc.)
│   ├── projects/
│   │   ├── registry.ts          ← central map: slug → { component, meta }
│   │   └── [slug]/
│   │       ├── config.json      ← project data
│   │       └── Visualiser.svelte
│   ├── stores/                  ← active project, theme state
│   ├── types/                   ← Project, Section, ApiResponse interfaces
│   └── api/
│       └── client.ts            ← getProject(slug), listProjects() — JSON now, API later
├── routes/
│   ├── +layout.svelte           ← global GSAP context, grid background
│   ├── +page.svelte             ← landing page
│   └── projects/
│       └── [slug]/
│           └── +page.svelte     ← dynamic route, reads registry
static/
docs/
```

### Registry Pattern
`registry.ts` is the single source of truth for all projects:

```ts
import type { ProjectMeta } from '$lib/types';

export const registry: Record<string, ProjectMeta> = {
  'design-system': {
    title: 'Design System',
    tags: ['COLOR', 'TYPE', 'TOKENS'],
    status: 'new',
    component: () => import('./design-system/Visualiser.svelte'),
    config: () => import('./design-system/config.json'),
  },
};
```

Adding a new project = one registry entry + one folder. The dynamic route handles the rest.

### API Seam
`src/lib/api/client.ts` exposes:
```ts
export async function listProjects(): Promise<ProjectMeta[]>
export async function getProject(slug: string): Promise<Project>
```

Currently backed by the registry/JSON. When an API is ready, only this file changes.

---

## Pages

### Landing Page (`/`)
- **No sidebar**
- Full-bleed layout with grid underlay
- **Hero (left 42%):** Rotated diamond sigil (◈ rotated 45°, glowing crimson from within) above the wordmark "VISUALISER" in wide-tracked caps. "BY CLAUDE" sub-label. Crimson ambient bloom behind. Vertical red divider separates hero from carousel.
- **Carousel (right 58%):** Vertical carousel of project cards
  - Active card: expanded — shows number, title, description, tags. Red border + glow.
  - Prev/next cards: single compressed row, 35% opacity, fading into background
  - Only prev and next are visible; others hidden
  - GSAP animates expand/collapse on navigation (scroll or arrow keys)
- **Entry animation:** Sigil fades + scales in, wordmark types in letter by letter, divider slides down, carousel cards stagger up

### Project Page (`/projects/[slug]`)
- **Icon sidebar (left):** Narrow rail with numbered project icons. Expands on hover to reveal names. Active project glows red. GSAP slides sidebar in from left on route entry.
- **Topbar:** Project name (red monospace label) + gold status indicator
- **Content area:** Mounts the project's `Visualiser.svelte` component. Content fades + translates up on entry via GSAP.
- **Route transition:** Leaving reverses the entry animation.

---

## Data Shape

### `config.json` (per project)
```json
{
  "slug": "design-system",
  "title": "Design System",
  "description": "Color palette, typography scale, spacing tokens",
  "tags": ["COLOR", "TYPE", "TOKENS"],
  "status": "new",
  "sections": [
    { "type": "colour-palette", "data": {} },
    { "type": "type-scale", "data": {} }
  ]
}
```

`sections[].type` maps to a registered visualisation component in `src/lib/components/visualisations/`.

---

## Animation Strategy (GSAP)

| Trigger | Animation |
|---------|-----------|
| App load | Grid fades in, hero sigil blooms, wordmark tracks in |
| Landing carousel scroll/key | Active card expands, others compress — spring easing |
| Enter project route | Sidebar slides in left, content fades+translates up |
| Exit project route | Reverse of entry |
| Hover project card | Border brightens, faint red glow intensifies |
| Hover sidebar icon | Icon scales up, label slides in |

All timelines defined in a central `animations.ts` to keep components clean.

---

## Expandability Notes

- **New project:** Add folder under `src/lib/projects/[slug]/`, add one entry to `registry.ts`
- **New visualisation type:** Add component to `src/lib/components/visualisations/`, reference by `type` string in config
- **API integration:** Replace `client.ts` internals only — all consumers stay unchanged
- **Additional routes:** SvelteKit file-based routing — add a folder under `routes/`
