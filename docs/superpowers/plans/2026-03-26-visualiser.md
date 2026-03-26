# Visualiser Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Bun + SvelteKit SPA that displays Claude design recommendation visualisations, with a registry-driven per-project route system, futuristic dark red/gold aesthetic, and GSAP animations.

**Architecture:** SvelteKit in SPA mode with file-based routing. A central `registry.ts` maps project slugs to lazy-loaded Svelte components + JSON configs. An `api/client.ts` stub abstracts all data access so the backend can be swapped later without touching consumers.

**Tech Stack:** Bun, SvelteKit, TypeScript, shadcn-svelte, GSAP, Vitest, `@testing-library/svelte`

---

## File Map

| File                                                     | Responsibility                                                                |
| -------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `svelte.config.js`                                       | SPA mode adapter config                                                       |
| `src/app.css`                                            | CSS custom properties (design tokens), global grid background                 |
| `src/lib/types/index.ts`                                 | All TypeScript interfaces: `Project`, `ProjectMeta`, `Section`, `ApiResponse` |
| `src/lib/api/client.ts`                                  | `listProjects()`, `getProject(slug)` — backed by registry/JSON now            |
| `src/lib/projects/registry.ts`                           | Slug → `{ title, tags, status, component(), config() }` map                   |
| `src/lib/projects/design-system/config.json`             | First project data                                                            |
| `src/lib/projects/design-system/Visualiser.svelte`       | First project visualisation component                                         |
| `src/lib/stores/carousel.ts`                             | Active carousel index, prev/next helpers                                      |
| `src/lib/animations.ts`                                  | All GSAP timeline factory functions                                           |
| `src/lib/components/layout/Sidebar.svelte`               | Icon rail, hover-expand, active glow                                          |
| `src/lib/components/layout/TopBar.svelte`                | Project name label + gold status badge                                        |
| `src/lib/components/layout/GridBackground.svelte`        | Reusable grid underlay                                                        |
| `src/lib/components/visualisations/ColourPalette.svelte` | Colour swatch grid section                                                    |
| `src/lib/components/visualisations/TypeScale.svelte`     | Typography scale display section                                              |
| `src/routes/+layout.svelte`                              | Root layout: grid background, GSAP plugin registration                        |
| `src/routes/+page.svelte`                                | Landing page: sigil hero + vertical carousel                                  |
| `src/routes/projects/[slug]/+page.svelte`                | Dynamic project page: sidebar + topbar + Visualiser                           |

---

## Task 1: Scaffold the project

**Files:**

- Create: `svelte.config.js` (modify after scaffold)
- Create: `src/app.html`
- Create: `vite.config.ts`

- [ ] **Step 1: Scaffold SvelteKit with Bun**

```bash
cd /home/labor-client18/workspace/projects/claude-custom-visualiser
bun create svelte@latest .
```

When the interactive prompts appear, select: **Skeleton project**, **TypeScript**, and say no to Prettier, ESLint, Playwright, and Vitest (we configure Vitest manually in a later step).

- [ ] **Step 2: Install dependencies**

```bash
bun install
bun add gsap
bun add -d vitest @vitest/ui jsdom @testing-library/svelte @testing-library/jest-dom @sveltejs/kit
```

- [ ] **Step 3: Install shadcn-svelte**

```bash
bunx shadcn-svelte@latest init
```

Accept defaults. This creates `components.json` and adds `tailwindcss`, `bits-ui`, `clsx`, `tailwind-merge` etc.

- [ ] **Step 4: Configure SPA mode in `svelte.config.js`**

```js
import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		adapter: adapter({ fallback: 'index.html' })
	}
};

export default config;
```

- [ ] **Step 5: Disable SSR in root layout**

Create `src/routes/+layout.ts`:

```ts
export const ssr = false;
export const prerender = false;
```

- [ ] **Step 6: Configure Vitest in `vite.config.ts`**

```ts
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [sveltekit()],
	test: {
		include: ['src/**/*.{test,spec}.ts'],
		environment: 'jsdom',
		setupFiles: ['src/test-setup.ts']
	}
});
```

- [ ] **Step 7: Create test setup file**

Create `src/test-setup.ts`:

```ts
import '@testing-library/jest-dom';
```

- [ ] **Step 8: Verify dev server starts**

```bash
bun run dev
```

Expected: dev server running at `http://localhost:5173`, no errors.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "chore: scaffold SvelteKit SPA with Bun, GSAP, shadcn-svelte, Vitest"
```

---

## Task 2: Design tokens and global styles

**Files:**

- Modify: `src/app.css`
- Modify: `src/app.html`

- [ ] **Step 1: Write the failing test for token presence**

Create `src/lib/styles.test.ts`:

```ts
import { describe, it, expect } from 'vitest';

describe('CSS design tokens', () => {
	it('defines expected token names', async () => {
		// These are the token names we commit to — if they change, this test catches it
		const expectedTokens = [
			'--color-bg',
			'--color-surface',
			'--color-border',
			'--color-red',
			'--color-gold',
			'--color-text',
			'--color-muted',
			'--color-ghost'
		];
		// Read the actual CSS file
		const fs = await import('fs');
		const css = fs.readFileSync('src/app.css', 'utf-8');
		for (const token of expectedTokens) {
			expect(css).toContain(token);
		}
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bun run vitest run src/lib/styles.test.ts
```

Expected: FAIL — tokens not defined yet.

- [ ] **Step 3: Write `src/app.css`**

```css
@import 'tailwindcss/base';
@import 'tailwindcss/components';
@import 'tailwindcss/utilities';

/* ── Design Tokens ── */
:root {
	--color-bg: #070707;
	--color-surface: #0a0a0a;
	--color-border: #1a1a1a;
	--color-red: #821400;
	--color-gold: #e6b820;
	--color-text: #e8e8e8;
	--color-muted: #666666;
	--color-ghost: #333333;

	/* shadcn-svelte token overrides (HSL format required) */
	--background: 4 3% 3%;
	--foreground: 0 0% 91%;
	--card: 0 0% 4%;
	--card-foreground: 0 0% 91%;
	--popover: 0 0% 4%;
	--popover-foreground: 0 0% 91%;
	--primary: 10 100% 25%;
	--primary-foreground: 0 0% 91%;
	--secondary: 0 0% 7%;
	--secondary-foreground: 0 0% 91%;
	--muted: 0 0% 7%;
	--muted-foreground: 0 0% 40%;
	--accent: 43 79% 50%;
	--accent-foreground: 0 0% 7%;
	--border: 0 0% 10%;
	--input: 0 0% 10%;
	--ring: 10 100% 25%;
	--radius: 0.25rem;
}

/* ── Base resets ── */
*,
*::before,
*::after {
	box-sizing: border-box;
}

html,
body {
	height: 100%;
	margin: 0;
	padding: 0;
	background: var(--color-bg);
	color: var(--color-text);
	font-family: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', ui-monospace, monospace;
}

/* ── Glow utilities ── */
.glow-red {
	box-shadow: 0 0 8px rgba(130, 20, 0, 0.5);
}
.glow-red-strong {
	box-shadow:
		0 0 16px rgba(130, 20, 0, 0.7),
		0 0 32px rgba(130, 20, 0, 0.3);
}
.glow-gold {
	box-shadow:
		0 0 8px #e6b820,
		0 0 16px rgba(230, 184, 32, 0.4);
}
.text-glow-red {
	text-shadow: 0 0 8px rgba(130, 20, 0, 0.9);
}
.text-glow-gold {
	text-shadow:
		0 0 8px #e6b820,
		0 0 16px rgba(230, 184, 32, 0.4);
}
```

- [ ] **Step 4: Add monospace font to `src/app.html`**

Add inside `<head>`:

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link
	href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700;900&display=swap"
	rel="stylesheet"
/>
```

- [ ] **Step 5: Run test to verify it passes**

```bash
bun run vitest run src/lib/styles.test.ts
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/app.css src/app.html src/lib/styles.test.ts
git commit -m "feat: design tokens and global styles"
```

---

## Task 3: TypeScript types

**Files:**

- Create: `src/lib/types/index.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/types/types.test.ts`:

```ts
import { describe, it, expectTypeOf } from 'vitest';
import type { Project, ProjectMeta, Section } from './index';

describe('types', () => {
	it('Project has required fields', () => {
		const p: Project = {
			slug: 'test',
			title: 'Test',
			description: 'desc',
			tags: ['A'],
			status: 'new',
			sections: []
		};
		expectTypeOf(p.slug).toBeString();
		expectTypeOf(p.sections).toBeArray();
	});

	it('Section has type and data fields', () => {
		const s: Section = { type: 'colour-palette', data: {} };
		expectTypeOf(s.type).toBeString();
	});

	it('ProjectMeta does not include sections', () => {
		expectTypeOf<ProjectMeta>().not.toHaveProperty('sections');
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bun run vitest run src/lib/types/types.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write `src/lib/types/index.ts`**

```ts
export type ProjectStatus = 'new' | 'updated' | 'stable';

export interface Section {
	type: string;
	data: Record<string, unknown>;
}

export interface ProjectMeta {
	slug: string;
	title: string;
	description: string;
	tags: string[];
	status: ProjectStatus;
	/** Lazy-load the Visualiser component */
	component: () => Promise<{ default: unknown }>;
	/** Lazy-load the config JSON */
	config: () => Promise<Project>;
}

export interface Project {
	slug: string;
	title: string;
	description: string;
	tags: string[];
	status: ProjectStatus;
	sections: Section[];
}

export interface ApiResponse<T> {
	data: T;
	error?: string;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
bun run vitest run src/lib/types/types.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/types/
git commit -m "feat: TypeScript interfaces for Project, Section, ProjectMeta"
```

---

## Task 4: Registry

**Files:**

- Create: `src/lib/projects/registry.ts`
- Create: `src/lib/projects/design-system/config.json`

- [ ] **Step 1: Write the failing test**

Create `src/lib/projects/registry.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { registry, getRegistryList } from './registry';

describe('registry', () => {
	it('has at least one entry', () => {
		expect(Object.keys(registry).length).toBeGreaterThan(0);
	});

	it('design-system entry exists', () => {
		expect(registry['design-system']).toBeDefined();
	});

	it('design-system entry has required fields', () => {
		const entry = registry['design-system'];
		expect(entry.title).toBe('Design System');
		expect(entry.tags).toContain('COLOR');
		expect(typeof entry.component).toBe('function');
		expect(typeof entry.config).toBe('function');
	});

	it('getRegistryList returns ordered array', () => {
		const list = getRegistryList();
		expect(Array.isArray(list)).toBe(true);
		expect(list[0].slug).toBeDefined();
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bun run vitest run src/lib/projects/registry.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create `src/lib/projects/design-system/config.json`**

```json
{
	"slug": "design-system",
	"title": "Design System",
	"description": "Color palette, typography scale, and spacing tokens for a design recommendation.",
	"tags": ["COLOR", "TYPE", "TOKENS"],
	"status": "new",
	"sections": [
		{
			"type": "colour-palette",
			"data": {
				"swatches": [
					{ "name": "Background", "hex": "#070707", "token": "--color-bg" },
					{ "name": "Surface", "hex": "#0a0a0a", "token": "--color-surface" },
					{ "name": "Red", "hex": "#821400", "token": "--color-red", "glow": true },
					{ "name": "Gold", "hex": "#e6b820", "token": "--color-gold", "glow": true },
					{ "name": "Text", "hex": "#e8e8e8", "token": "--color-text" },
					{ "name": "Muted", "hex": "#666666", "token": "--color-muted" }
				]
			}
		},
		{
			"type": "type-scale",
			"data": {
				"fontFamily": "JetBrains Mono",
				"steps": [
					{
						"name": "xs",
						"size": "10px",
						"tracking": "3px",
						"weight": 400,
						"sample": "SYSTEM LABEL"
					},
					{
						"name": "sm",
						"size": "12px",
						"tracking": "2px",
						"weight": 400,
						"sample": "Navigation item"
					},
					{
						"name": "base",
						"size": "14px",
						"tracking": "1px",
						"weight": 400,
						"sample": "Body copy reads here"
					},
					{
						"name": "lg",
						"size": "18px",
						"tracking": "2px",
						"weight": 700,
						"sample": "Card Title"
					},
					{
						"name": "xl",
						"size": "24px",
						"tracking": "3px",
						"weight": 900,
						"sample": "SECTION HEADING"
					},
					{
						"name": "2xl",
						"size": "36px",
						"tracking": "4px",
						"weight": 900,
						"sample": "VISUALISER"
					}
				]
			}
		}
	]
}
```

- [ ] **Step 4: Write `src/lib/projects/registry.ts`**

```ts
import type { ProjectMeta } from '$lib/types';

export const registry: Record<string, Omit<ProjectMeta, 'slug'> & { slug: string }> = {
	'design-system': {
		slug: 'design-system',
		title: 'Design System',
		description: 'Color palette, typography scale, and spacing tokens.',
		tags: ['COLOR', 'TYPE', 'TOKENS'],
		status: 'new',
		component: () => import('./design-system/Visualiser.svelte'),
		config: () => import('./design-system/config.json')
	}
};

/** Returns registry entries as an ordered array, preserving insertion order. */
export function getRegistryList(): ProjectMeta[] {
	return Object.values(registry) as ProjectMeta[];
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
bun run vitest run src/lib/projects/registry.test.ts
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/projects/
git commit -m "feat: project registry and design-system config"
```

---

## Task 5: API client

**Files:**

- Create: `src/lib/api/client.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/api/client.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { listProjects, getProject } from './client';

describe('api/client', () => {
	it('listProjects returns array with at least one entry', async () => {
		const projects = await listProjects();
		expect(Array.isArray(projects)).toBe(true);
		expect(projects.length).toBeGreaterThan(0);
	});

	it('listProjects entries have slug and title', async () => {
		const [first] = await listProjects();
		expect(first.slug).toBeDefined();
		expect(first.title).toBeDefined();
	});

	it('getProject returns project by slug', async () => {
		const project = await getProject('design-system');
		expect(project.slug).toBe('design-system');
		expect(project.sections).toBeDefined();
	});

	it('getProject throws for unknown slug', async () => {
		await expect(getProject('nonexistent')).rejects.toThrow();
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bun run vitest run src/lib/api/client.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write `src/lib/api/client.ts`**

```ts
import { getRegistryList, registry } from '$lib/projects/registry';
import type { Project, ProjectMeta } from '$lib/types';

/**
 * Returns all registered projects as metadata (no sections).
 * FUTURE: replace body with fetch('/api/projects')
 */
export async function listProjects(): Promise<ProjectMeta[]> {
	return getRegistryList();
}

/**
 * Returns a single project with full section data.
 * FUTURE: replace body with fetch(`/api/projects/${slug}`)
 */
export async function getProject(slug: string): Promise<Project> {
	const entry = registry[slug];
	if (!entry) throw new Error(`Project not found: ${slug}`);
	const config = await entry.config();
	return config as unknown as Project;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
bun run vitest run src/lib/api/client.test.ts
```

Expected: PASS

- [ ] **Step 5: Run all tests**

```bash
bun run vitest run
```

Expected: All pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/api/
git commit -m "feat: API client stub backed by registry"
```

---

## Task 6: Carousel store

**Files:**

- Create: `src/lib/stores/carousel.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/stores/carousel.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { createCarouselStore } from './carousel';

describe('carouselStore', () => {
	let store: ReturnType<typeof createCarouselStore>;

	beforeEach(() => {
		store = createCarouselStore(4); // 4 items
	});

	it('starts at index 0', () => {
		expect(get(store).activeIndex).toBe(0);
	});

	it('next() advances index', () => {
		store.next();
		expect(get(store).activeIndex).toBe(1);
	});

	it('prev() decrements index', () => {
		store.next();
		store.prev();
		expect(get(store).activeIndex).toBe(0);
	});

	it('does not go below 0', () => {
		store.prev();
		expect(get(store).activeIndex).toBe(0);
	});

	it('does not exceed total - 1', () => {
		store.next();
		store.next();
		store.next();
		store.next();
		expect(get(store).activeIndex).toBe(3);
	});

	it('setIndex() jumps to index', () => {
		store.setIndex(2);
		expect(get(store).activeIndex).toBe(2);
	});

	it('prevIndex and nextIndex are correct', () => {
		store.setIndex(1);
		const state = get(store);
		expect(state.prevIndex).toBe(0);
		expect(state.nextIndex).toBe(2);
	});

	it('prevIndex is null at start', () => {
		expect(get(store).prevIndex).toBeNull();
	});

	it('nextIndex is null at end', () => {
		store.setIndex(3);
		expect(get(store).nextIndex).toBeNull();
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bun run vitest run src/lib/stores/carousel.test.ts
```

Expected: FAIL

- [ ] **Step 3: Write `src/lib/stores/carousel.ts`**

```ts
import { writable, derived } from 'svelte/store';

interface CarouselState {
	activeIndex: number;
	total: number;
	prevIndex: number | null;
	nextIndex: number | null;
}

export function createCarouselStore(total: number) {
	const index = writable(0);

	const state = derived(
		index,
		($i): CarouselState => ({
			activeIndex: $i,
			total,
			prevIndex: $i > 0 ? $i - 1 : null,
			nextIndex: $i < total - 1 ? $i + 1 : null
		})
	);

	return {
		subscribe: state.subscribe,
		next: () => index.update((i) => Math.min(i + 1, total - 1)),
		prev: () => index.update((i) => Math.max(i - 1, 0)),
		setIndex: (i: number) => index.set(Math.max(0, Math.min(i, total - 1)))
	};
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
bun run vitest run src/lib/stores/carousel.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/stores/
git commit -m "feat: carousel store with prev/next/setIndex"
```

---

## Task 7: GSAP animation definitions

**Files:**

- Create: `src/lib/animations.ts`

- [ ] **Step 1: Write `src/lib/animations.ts`**

No unit tests here — these are GSAP imperative calls, verified visually. Write the file directly.

```ts
import { gsap } from 'gsap';

/**
 * Landing page entry: sigil blooms, wordmark tracks in, divider slides, cards stagger up.
 * Call once on landing page mount.
 */
export function animateLandingEntry(refs: {
	sigil: Element;
	wordmark: Element;
	divider: Element;
	cards: Element[];
}) {
	const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

	tl.fromTo(
		refs.sigil,
		{ opacity: 0, scale: 0.6, rotate: 45 },
		{ opacity: 1, scale: 1, rotate: 45, duration: 0.8 }
	)
		.fromTo(
			refs.wordmark,
			{ opacity: 0, letterSpacing: '24px' },
			{ opacity: 1, letterSpacing: '8px', duration: 0.6 },
			'-=0.3'
		)
		.fromTo(
			refs.divider,
			{ scaleY: 0, transformOrigin: 'top center' },
			{ scaleY: 1, duration: 0.5 },
			'-=0.2'
		)
		.fromTo(
			refs.cards,
			{ opacity: 0, y: 24 },
			{ opacity: 1, y: 0, duration: 0.4, stagger: 0.08 },
			'-=0.2'
		);

	return tl;
}

/**
 * Carousel transition: expands active card, compresses others.
 * Call on every index change.
 */
export function animateCarouselChange(refs: { activeCard: Element; ghostCards: Element[] }) {
	const tl = gsap.timeline({ defaults: { ease: 'power2.inOut', duration: 0.35 } });

	tl.to(refs.activeCard, { opacity: 1, y: 0 }).to(refs.ghostCards, { opacity: 0.35, y: 0 }, '<');

	return tl;
}

/**
 * Project page entry: sidebar slides in from left, content fades+translates up.
 * Call on project route mount.
 */
export function animateProjectEntry(refs: { sidebar: Element; topbar: Element; content: Element }) {
	const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

	tl.fromTo(refs.sidebar, { x: -48, opacity: 0 }, { x: 0, opacity: 1, duration: 0.5 })
		.fromTo(refs.topbar, { opacity: 0 }, { opacity: 1, duration: 0.3 }, '-=0.2')
		.fromTo(refs.content, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.5 }, '-=0.15');

	return tl;
}

/**
 * Project page exit: reverse of entry.
 * Call before navigating away from a project route.
 */
export function animateProjectExit(refs: { sidebar: Element; topbar: Element; content: Element }) {
	const tl = gsap.timeline({ defaults: { ease: 'power2.in' } });

	tl.to(refs.content, { opacity: 0, y: -12, duration: 0.25 })
		.to(refs.topbar, { opacity: 0, duration: 0.2 }, '-=0.1')
		.to(refs.sidebar, { x: -48, opacity: 0, duration: 0.3 }, '-=0.1');

	return tl;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/animations.ts
git commit -m "feat: GSAP animation timeline definitions"
```

---

## Task 8: Global layout and grid background

**Files:**

- Create: `src/lib/components/layout/GridBackground.svelte`
- Modify: `src/routes/+layout.svelte`

- [ ] **Step 1: Write `src/lib/components/layout/GridBackground.svelte`**

```svelte
<div class="grid-bg" aria-hidden="true"></div>

<style>
	.grid-bg {
		position: fixed;
		inset: 0;
		pointer-events: none;
		z-index: 0;
		background-image:
			repeating-linear-gradient(
				0deg,
				transparent,
				transparent 31px,
				rgba(130, 20, 0, 0.05) 31px,
				rgba(130, 20, 0, 0.05) 32px
			),
			repeating-linear-gradient(
				90deg,
				transparent,
				transparent 31px,
				rgba(130, 20, 0, 0.05) 31px,
				rgba(130, 20, 0, 0.05) 32px
			);
	}
</style>
```

- [ ] **Step 2: Write `src/routes/+layout.svelte`**

```svelte
<script lang="ts">
	import '../app.css';
	import GridBackground from '$lib/components/layout/GridBackground.svelte';
</script>

<GridBackground />

<div class="layout-root">
	<slot />
</div>

<style>
	.layout-root {
		position: relative;
		z-index: 1;
		min-height: 100vh;
	}
</style>
```

- [ ] **Step 3: Start dev server and verify grid renders**

```bash
bun run dev
```

Open `http://localhost:5173`. Expected: dark background with faint red grid lines visible.

- [ ] **Step 4: Commit**

```bash
git add src/lib/components/layout/GridBackground.svelte src/routes/+layout.svelte
git commit -m "feat: global layout with grid background"
```

---

## Task 9: Sidebar and TopBar components

**Files:**

- Create: `src/lib/components/layout/Sidebar.svelte`
- Create: `src/lib/components/layout/TopBar.svelte`

- [ ] **Step 1: Write `src/lib/components/layout/Sidebar.svelte`**

```svelte
<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import type { ProjectMeta } from '$lib/types';

	export let projects: ProjectMeta[];

	$: activeSlug = $page.params.slug;
</script>

<nav class="sidebar" bind:this={sidebarEl}>
	<div class="sidebar-logo">◈</div>

	{#each projects as project, i}
		{@const isActive = project.slug === activeSlug}
		<button
			class="sidebar-item"
			class:active={isActive}
			on:click={() => goto(`/projects/${project.slug}`)}
			title={project.title}
		>
			<span class="item-num">
				{String(i + 1).padStart(2, '0')}
			</span>
			<span class="item-label">{project.title}</span>
		</button>
	{/each}
</nav>

<style>
	.sidebar {
		position: fixed;
		top: 0;
		left: 0;
		bottom: 0;
		width: 48px;
		background: var(--color-surface);
		border-right: 1px solid rgba(130, 20, 0, 0.35);
		box-shadow: 2px 0 20px rgba(130, 20, 0, 0.08);
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 16px 0;
		gap: 8px;
		transition: width 0.25s ease;
		overflow: hidden;
		z-index: 100;
	}

	.sidebar:hover {
		width: 180px;
	}

	.sidebar-logo {
		font-size: 16px;
		color: var(--color-red);
		text-shadow: 0 0 10px rgba(130, 20, 0, 0.9);
		margin-bottom: 12px;
		flex-shrink: 0;
	}

	.sidebar-item {
		all: unset;
		cursor: pointer;
		display: flex;
		align-items: center;
		gap: 10px;
		width: 100%;
		padding: 8px 12px;
		border: 1px solid transparent;
		border-radius: 2px;
		transition:
			border-color 0.2s,
			box-shadow 0.2s;
		white-space: nowrap;
	}

	.sidebar-item:hover {
		border-color: rgba(130, 20, 0, 0.4);
		box-shadow: 0 0 8px rgba(130, 20, 0, 0.2);
	}

	.sidebar-item.active {
		border-color: rgba(130, 20, 0, 0.6);
		box-shadow: 0 0 12px rgba(130, 20, 0, 0.3);
	}

	.item-num {
		font-size: 10px;
		color: var(--color-red);
		text-shadow: 0 0 6px rgba(130, 20, 0, 0.8);
		letter-spacing: 1px;
		flex-shrink: 0;
		min-width: 20px;
		font-weight: 700;
	}

	.active .item-num {
		text-shadow: 0 0 10px rgba(130, 20, 0, 1);
	}

	.item-label {
		font-size: 10px;
		color: var(--color-muted);
		letter-spacing: 2px;
		text-transform: uppercase;
		opacity: 0;
		transition: opacity 0.15s ease 0.05s;
	}

	.sidebar:hover .item-label {
		opacity: 1;
	}

	.active .item-label {
		color: var(--color-text);
	}
</style>
```

- [ ] **Step 2: Write `src/lib/components/layout/TopBar.svelte`**

```svelte
<script lang="ts">
	import type { ProjectStatus } from '$lib/types';

	export let title: string;
	export let status: ProjectStatus;
</script>

<header class="topbar">
	<span class="topbar-title">◈ {title.toUpperCase()}</span>
	<span class="topbar-status" class:status-new={status === 'new'}>
		{#if status === 'new'}◆ NEW{:else if status === 'updated'}◆ UPDATED{:else}◆{/if}
	</span>
</header>

<style>
	.topbar {
		height: 40px;
		border-bottom: 1px solid var(--color-border);
		display: flex;
		align-items: center;
		padding: 0 20px;
		gap: 12px;
	}

	.topbar-title {
		font-size: 10px;
		letter-spacing: 3px;
		color: var(--color-red);
		text-shadow: 0 0 8px rgba(130, 20, 0, 0.8);
	}

	.topbar-status {
		margin-left: auto;
		font-size: 9px;
		letter-spacing: 2px;
		color: var(--color-ghost);
	}

	.status-new {
		color: var(--color-gold);
		text-shadow:
			0 0 8px #e6b820,
			0 0 16px rgba(230, 184, 32, 0.4);
	}
</style>
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/components/layout/
git commit -m "feat: Sidebar and TopBar layout components"
```

---

## Task 10: Landing page

**Files:**

- Modify: `src/routes/+page.svelte`

- [ ] **Step 1: Write `src/routes/+page.svelte`**

```svelte
<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { listProjects } from '$lib/api/client';
	import { createCarouselStore } from '$lib/stores/carousel';
	import { animateLandingEntry, animateCarouselChange } from '$lib/animations';
	import type { ProjectMeta } from '$lib/types';

	let projects: ProjectMeta[] = [];
	let carousel = createCarouselStore(0);

	// DOM refs
	let sigilEl: HTMLElement;
	let wordmarkEl: HTMLElement;
	let dividerEl: HTMLElement;
	let cardEls: HTMLElement[] = [];

	onMount(async () => {
		projects = await listProjects();
		carousel = createCarouselStore(projects.length);

		// Wait one tick for DOM to update
		await new Promise((r) => setTimeout(r, 0));

		animateLandingEntry({
			sigil: sigilEl,
			wordmark: wordmarkEl,
			divider: dividerEl,
			cards: cardEls
		});
	});

	function handleKey(e: KeyboardEvent) {
		if (e.key === 'ArrowDown') {
			e.preventDefault();
			carousel.next();
		}
		if (e.key === 'ArrowUp') {
			e.preventDefault();
			carousel.prev();
		}
	}

	function handleWheel(e: WheelEvent) {
		e.preventDefault();
		e.deltaY > 0 ? carousel.next() : carousel.prev();
	}

	function enterProject(slug: string) {
		goto(`/projects/${slug}`);
	}

	$: activeIndex = $carousel.activeIndex;
	$: prevIndex = $carousel.prevIndex;
	$: nextIndex = $carousel.nextIndex;
</script>

<svelte:window on:keydown={handleKey} />

<main class="landing">
	<!-- ── Hero ── -->
	<section class="hero">
		<div class="hero-bloom" aria-hidden="true"></div>

		<div class="hero-eyebrow">◈ CLAUDE</div>

		<div class="sigil-wrap" bind:this={sigilEl}>
			<div class="sigil">◈</div>
		</div>

		<h1 class="wordmark" bind:this={wordmarkEl}>VISUALISER</h1>

		<div class="hero-divider" bind:this={dividerEl}></div>

		<p class="hero-sub">BY CLAUDE</p>
	</section>

	<!-- ── Carousel ── -->
	<section
		class="carousel-region"
		on:wheel={handleWheel}
		role="region"
		aria-label="Project carousel"
	>
		{#each projects as project, i}
			{@const isActive = i === activeIndex}
			{@const isPrev = i === prevIndex}
			{@const isNext = i === nextIndex}
			{@const visible = isActive || isPrev || isNext}

			{#if visible}
				<div
					class="project-card"
					class:card-active={isActive}
					class:card-ghost={!isActive}
					bind:this={cardEls[i]}
					on:click={() => isActive && enterProject(project.slug)}
					role={isActive ? 'button' : 'presentation'}
					tabindex={isActive ? 0 : -1}
					on:keydown={(e) => e.key === 'Enter' && isActive && enterProject(project.slug)}
				>
					{#if isActive}
						<div class="card-num">
							<span>{String(i + 1).padStart(2, '0')} ▸</span>
							{#if project.status === 'new'}<span class="gold-badge">◆</span>{/if}
						</div>
						<div class="card-title">{project.title}</div>
						<div class="card-desc">{project.description}</div>
						<div class="card-tags">
							{#each project.tags as tag}
								<span class="tag">{tag}</span>
							{/each}
							{#if project.status === 'new'}
								<span class="tag tag-gold">◆ NEW</span>
							{/if}
						</div>
					{:else}
						<span class="ghost-num">{String(i + 1).padStart(2, '0')}</span>
						<span class="ghost-title">{project.title.toUpperCase()}</span>
					{/if}
				</div>
			{/if}
		{/each}
	</section>
</main>

<style>
	.landing {
		display: flex;
		height: 100vh;
		overflow: hidden;
	}

	/* ── Hero ── */
	.hero {
		width: 42%;
		border-right: 1px solid rgba(130, 20, 0, 0.45);
		box-shadow: 4px 0 32px rgba(130, 20, 0, 0.1);
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 40px 32px;
		position: relative;
	}

	.hero-bloom {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		width: 340px;
		height: 340px;
		background: radial-gradient(circle, rgba(130, 20, 0, 0.18), transparent 65%);
		pointer-events: none;
	}

	.hero-eyebrow {
		position: relative;
		z-index: 1;
		font-size: 10px;
		letter-spacing: 4px;
		color: var(--color-red);
		text-shadow: 0 0 10px rgba(130, 20, 0, 1);
		margin-bottom: 24px;
	}

	.sigil-wrap {
		position: relative;
		z-index: 1;
		margin-bottom: 20px;
	}

	.sigil {
		width: 72px;
		height: 72px;
		border: 1px solid rgba(130, 20, 0, 0.75);
		box-shadow:
			0 0 20px rgba(130, 20, 0, 0.5),
			inset 0 0 20px rgba(130, 20, 0, 0.1);
		display: flex;
		align-items: center;
		justify-content: center;
		transform: rotate(45deg);
		font-size: 28px;
		color: var(--color-red);
		text-shadow: 0 0 16px rgba(130, 20, 0, 1);
	}

	.wordmark {
		position: relative;
		z-index: 1;
		font-size: clamp(20px, 3vw, 28px);
		font-weight: 900;
		letter-spacing: 8px;
		color: var(--color-text);
		text-shadow: 0 0 24px rgba(130, 20, 0, 0.35);
		margin: 0;
	}

	.hero-divider {
		position: relative;
		z-index: 1;
		height: 1px;
		width: 55%;
		background: var(--color-red);
		box-shadow:
			0 0 8px rgba(130, 20, 0, 0.8),
			0 0 16px rgba(130, 20, 0, 0.3);
		margin: 16px 0;
	}

	.hero-sub {
		position: relative;
		z-index: 1;
		font-size: 9px;
		letter-spacing: 4px;
		color: var(--color-ghost);
		margin: 0;
	}

	/* ── Carousel ── */
	.carousel-region {
		flex: 1;
		display: flex;
		flex-direction: column;
		justify-content: center;
		padding: 32px 24px;
		gap: 10px;
		overflow: hidden;
	}

	.project-card {
		border-radius: 3px;
		border: 1px solid var(--color-border);
		transition:
			border-color 0.2s,
			box-shadow 0.2s;
	}

	.card-active {
		padding: 18px 20px;
		border-color: rgba(130, 20, 0, 0.55);
		background: rgba(130, 20, 0, 0.07);
		box-shadow: 0 0 18px rgba(130, 20, 0, 0.18);
		cursor: pointer;
	}

	.card-active:hover {
		border-color: rgba(130, 20, 0, 0.8);
		box-shadow: 0 0 24px rgba(130, 20, 0, 0.28);
	}

	.card-ghost {
		padding: 12px 20px;
		opacity: 0.35;
		display: flex;
		align-items: center;
		gap: 14px;
	}

	.card-num {
		font-size: 11px;
		color: var(--color-red);
		text-shadow: 0 0 8px rgba(130, 20, 0, 0.9);
		letter-spacing: 2px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 10px;
	}

	.gold-badge {
		color: var(--color-gold);
		text-shadow:
			0 0 8px #e6b820,
			0 0 16px rgba(230, 184, 32, 0.4);
		font-size: 14px;
	}

	.card-title {
		font-size: 18px;
		font-weight: 900;
		color: var(--color-text);
		letter-spacing: 3px;
		margin-bottom: 8px;
	}

	.card-desc {
		font-size: 11px;
		color: var(--color-muted);
		line-height: 1.8;
		margin-bottom: 12px;
	}

	.card-tags {
		display: flex;
		gap: 6px;
		flex-wrap: wrap;
	}

	.tag {
		padding: 3px 8px;
		border: 1px solid rgba(130, 20, 0, 0.5);
		font-size: 8px;
		color: var(--color-red);
		letter-spacing: 1px;
		text-shadow: 0 0 4px rgba(130, 20, 0, 0.5);
	}

	.tag-gold {
		border-color: rgba(230, 184, 32, 0.5);
		color: var(--color-gold);
		text-shadow: 0 0 6px rgba(230, 184, 32, 0.5);
	}

	.ghost-num {
		font-size: 12px;
		font-weight: 700;
		color: var(--color-ghost);
		min-width: 24px;
	}

	.ghost-title {
		font-size: 13px;
		color: var(--color-ghost);
		font-weight: 600;
		letter-spacing: 2px;
	}
</style>
```

- [ ] **Step 2: Verify landing page in browser**

```bash
bun run dev
```

Open `http://localhost:5173`. Expected:

- Dark background with red grid
- Left hero panel with sigil + VISUALISER
- Right carousel with design-system card active, no adjacent cards (only 1 project)
- Arrow keys navigate (no-op with 1 project)
- Entry animations play on load

- [ ] **Step 3: Commit**

```bash
git add src/routes/+page.svelte
git commit -m "feat: landing page with sigil hero and vertical carousel"
```

---

## Task 11: Project page

**Files:**

- Create: `src/routes/projects/[slug]/+page.svelte`

- [ ] **Step 1: Write `src/routes/projects/[slug]/+page.svelte`**

```svelte
<script lang="ts">
	import { onMount } from 'svelte';
	import { goto, beforeNavigate } from '$app/navigation';
	import { page } from '$app/stores';
	import { listProjects, getProject } from '$lib/api/client';
	import { registry } from '$lib/projects/registry';
	import { animateProjectEntry, animateProjectExit } from '$lib/animations';
	import Sidebar from '$lib/components/layout/Sidebar.svelte';
	import TopBar from '$lib/components/layout/TopBar.svelte';
	import type { Project, ProjectMeta } from '$lib/types';

	let projects: ProjectMeta[] = [];
	let project: Project | null = null;
	let VisualisationComponent: unknown = null;

	// DOM refs
	let sidebarEl: HTMLElement;
	let topbarEl: HTMLElement;
	let contentEl: HTMLElement;

	$: slug = $page.params.slug;

	onMount(async () => {
		[projects, project] = await Promise.all([listProjects(), getProject(slug)]);

		const entry = registry[slug];
		if (entry) {
			const mod = await entry.component();
			VisualisationComponent = (mod as { default: unknown }).default;
		}

		await new Promise((r) => setTimeout(r, 0));

		animateProjectEntry({
			sidebar: sidebarEl,
			topbar: topbarEl,
			content: contentEl
		});
	});

	let isExiting = false;

	beforeNavigate(({ cancel, to }) => {
		// Guard against re-entry when goto() fires after animation completes
		if (isExiting) return;
		if (!sidebarEl || !topbarEl || !contentEl) return;

		const dest = to?.url.pathname;
		if (!dest) return;

		cancel();
		isExiting = true;

		animateProjectExit({
			sidebar: sidebarEl,
			topbar: topbarEl,
			content: contentEl
		}).then(() => goto(dest));
	});
</script>

<div class="project-shell">
	<div bind:this={sidebarEl}>
		<Sidebar {projects} />
	</div>

	<div class="project-main" style="margin-left: 48px;">
		<div bind:this={topbarEl}>
			{#if project}
				<TopBar title={project.title} status={project.status} />
			{/if}
		</div>

		<div class="project-content" bind:this={contentEl}>
			{#if VisualisationComponent && project}
				<svelte:component this={VisualisationComponent} {project} />
			{:else}
				<div class="loading">
					<span>▸ loading...</span>
				</div>
			{/if}
		</div>
	</div>
</div>

<style>
	.project-shell {
		display: flex;
		min-height: 100vh;
	}

	.project-main {
		flex: 1;
		display: flex;
		flex-direction: column;
	}

	.project-content {
		flex: 1;
		padding: 32px;
	}

	.loading {
		font-size: 11px;
		color: var(--color-ghost);
		letter-spacing: 2px;
		padding: 40px;
	}
</style>
```

- [ ] **Step 2: Verify project page in browser**

Navigate to `http://localhost:5173/projects/design-system`. Expected:

- Sidebar slides in from left with numbered icon
- Topbar shows "◈ DESIGN SYSTEM" + gold "◆ NEW"
- Content area renders (empty until Visualiser is built)
- Back-navigate to `/` works

- [ ] **Step 3: Commit**

```bash
git add src/routes/projects/
git commit -m "feat: dynamic project route with sidebar and GSAP entry"
```

---

## Task 12: Visualisation components

**Files:**

- Create: `src/lib/components/visualisations/ColourPalette.svelte`
- Create: `src/lib/components/visualisations/TypeScale.svelte`
- Create: `src/lib/projects/design-system/Visualiser.svelte`

- [ ] **Step 1: Write `src/lib/components/visualisations/ColourPalette.svelte`**

```svelte
<script lang="ts">
	interface Swatch {
		name: string;
		hex: string;
		token: string;
		glow?: boolean;
	}

	export let swatches: Swatch[];
</script>

<section class="colour-palette">
	<div class="section-label">◈ COLOR PALETTE</div>
	<div class="swatches">
		{#each swatches as swatch}
			<div class="swatch" class:glow={swatch.glow}>
				<div
					class="swatch-color"
					style="background: {swatch.hex}; {swatch.glow
						? `box-shadow: 0 0 12px ${swatch.hex}55`
						: ''}"
				></div>
				<div class="swatch-info">
					<span class="swatch-name">{swatch.name}</span>
					<span class="swatch-hex">{swatch.hex}</span>
					<span class="swatch-token">{swatch.token}</span>
				</div>
			</div>
		{/each}
	</div>
</section>

<style>
	.colour-palette {
		margin-bottom: 48px;
	}

	.section-label {
		font-size: 9px;
		letter-spacing: 3px;
		color: var(--color-red);
		text-shadow: 0 0 6px rgba(130, 20, 0, 0.7);
		margin-bottom: 20px;
	}

	.swatches {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
		gap: 12px;
	}

	.swatch {
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: 3px;
		overflow: hidden;
		transition: border-color 0.2s;
	}

	.swatch:hover {
		border-color: rgba(130, 20, 0, 0.4);
	}

	.swatch-color {
		height: 64px;
	}

	.swatch-info {
		padding: 10px 12px;
		display: flex;
		flex-direction: column;
		gap: 3px;
	}

	.swatch-name {
		font-size: 11px;
		color: var(--color-text);
		letter-spacing: 1px;
	}
	.swatch-hex {
		font-size: 10px;
		color: var(--color-muted);
	}
	.swatch-token {
		font-size: 9px;
		color: var(--color-ghost);
		letter-spacing: 1px;
	}
</style>
```

- [ ] **Step 2: Write `src/lib/components/visualisations/TypeScale.svelte`**

```svelte
<script lang="ts">
	interface TypeStep {
		name: string;
		size: string;
		tracking: string;
		weight: number;
		sample: string;
	}

	export let fontFamily: string;
	export let steps: TypeStep[];
</script>

<section class="type-scale">
	<div class="section-label">◈ TYPE SCALE — {fontFamily}</div>
	<div class="steps">
		{#each steps as step}
			<div class="step">
				<div class="step-meta">
					<span class="step-name">{step.name}</span>
					<span class="step-size">{step.size}</span>
					<span class="step-track">+{step.tracking}</span>
					<span class="step-weight">{step.weight}</span>
				</div>
				<div
					class="step-sample"
					style="font-size: {step.size}; letter-spacing: {step.tracking}; font-weight: {step.weight}"
				>
					{step.sample}
				</div>
			</div>
		{/each}
	</div>
</section>

<style>
	.type-scale {
		margin-bottom: 48px;
	}

	.section-label {
		font-size: 9px;
		letter-spacing: 3px;
		color: var(--color-red);
		text-shadow: 0 0 6px rgba(130, 20, 0, 0.7);
		margin-bottom: 20px;
	}

	.steps {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.step {
		display: flex;
		align-items: baseline;
		gap: 24px;
		padding: 14px 0;
		border-bottom: 1px solid var(--color-border);
	}

	.step:last-child {
		border-bottom: none;
	}

	.step-meta {
		display: flex;
		gap: 12px;
		align-items: center;
		min-width: 160px;
		flex-shrink: 0;
	}

	.step-name {
		font-size: 9px;
		color: var(--color-red);
		letter-spacing: 2px;
		min-width: 28px;
	}
	.step-size {
		font-size: 9px;
		color: var(--color-muted);
		min-width: 36px;
	}
	.step-track {
		font-size: 9px;
		color: var(--color-ghost);
		min-width: 36px;
	}
	.step-weight {
		font-size: 9px;
		color: var(--color-ghost);
	}

	.step-sample {
		color: var(--color-text);
		flex: 1;
	}
</style>
```

- [ ] **Step 3: Write `src/lib/projects/design-system/Visualiser.svelte`**

```svelte
<script lang="ts">
	import ColourPalette from '$lib/components/visualisations/ColourPalette.svelte';
	import TypeScale from '$lib/components/visualisations/TypeScale.svelte';
	import type { Project, Section } from '$lib/types';

	export let project: Project;

	function getSectionData(type: string): Section['data'] | undefined {
		return project.sections.find((s) => s.type === type)?.data;
	}

	$: colourData = getSectionData('colour-palette') as { swatches: any[] } | undefined;
	$: typeData = getSectionData('type-scale') as { fontFamily: string; steps: any[] } | undefined;
</script>

<div class="visualiser">
	{#if colourData}
		<ColourPalette swatches={colourData.swatches} />
	{/if}

	{#if typeData}
		<TypeScale fontFamily={typeData.fontFamily} steps={typeData.steps} />
	{/if}
</div>

<style>
	.visualiser {
		max-width: 900px;
	}
</style>
```

- [ ] **Step 4: Verify full project page in browser**

Navigate to `http://localhost:5173/projects/design-system`. Expected:

- Colour palette swatches render with correct colours
- Red and Gold swatches have a faint glow
- Type scale renders all 6 steps with correct sizes and weights
- Full monospace font throughout

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/visualisations/ src/lib/projects/design-system/Visualiser.svelte
git commit -m "feat: ColourPalette and TypeScale visualisation components + design-system Visualiser"
```

---

## Task 13: Final wiring and smoke test

- [ ] **Step 1: Run all tests**

```bash
bun run vitest run
```

Expected: All pass (types, registry, API client, carousel store, styles).

- [ ] **Step 2: Build for production**

```bash
bun run build
```

Expected: Clean build, no errors, output in `build/`.

- [ ] **Step 3: Preview production build**

```bash
bun run preview
```

Open the preview URL. Verify:

- Landing page loads, grid visible, entry animations play
- Arrow keys navigate carousel (single project = no movement, expected)
- Click card or press Enter enters project
- Sidebar slides in, project content renders
- Sidebar hover expands to show project name
- All fonts and colours correct

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete Visualiser MVP — landing, project routes, design-system visualisation"
```

---

## Adding a New Project (Reference)

1. Create `src/lib/projects/[slug]/config.json` following the data shape in the spec
2. Create `src/lib/projects/[slug]/Visualiser.svelte`
3. Add one entry to `src/lib/projects/registry.ts`
4. That's it — the route, sidebar, and carousel update automatically

## Adding a New Visualisation Type

1. Create `src/lib/components/visualisations/[TypeName].svelte`
2. Define its `data` contract in a comment at the top of the file
3. Import and use it in the relevant `Visualiser.svelte`
4. Reference by `type` string in `config.json`
