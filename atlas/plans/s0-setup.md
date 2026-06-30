# Stage 0 — Setup

**Goal:** SvelteKit scaffold gone. Both packages bootstrapped, tooling configured, PostgreSQL running. No app logic yet.

---

## 0.1 Commit the wipe

The old SvelteKit files are already removed from the working tree. Stage the deletions and commit:

```bash
git add -A
git commit -m "chore: wipe SvelteKit scaffold"
```

## 0.2 Repo layout

```
/                  ← repo root
  compose.yaml     ← Podman Compose: PostgreSQL
  .env.example     ← committed; documents required env vars
  web/             ← Review UI (Vite + React + TS + Tailwind 4 + Shadcn)
  server/          ← Core API + MCP adapter (Bun + ElysiaJS + Prisma + TS)
  atlas/           ← project docs (already exists)
  CLAUDE.md        ← (already exists)
```

## 0.3 PostgreSQL via Podman Compose

Create `compose.yaml` at the repo root:

```yaml
services:
  db:
    image: postgres:17-alpine
    environment:
      POSTGRES_DB: bench
      POSTGRES_USER: bench
      POSTGRES_PASSWORD: bench
    ports:
      - '5432:5432'
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:
```

Start it:

```bash
podman compose up -d
podman compose ps   # verify db is healthy
```

Create `.env.example` (commit this):

```
DATABASE_URL=postgresql://bench:bench@localhost:5432/bench
```

Create `server/.env` (do **not** commit — add to `.gitignore`):

```
DATABASE_URL=postgresql://bench:bench@localhost:5432/bench
```

## 0.4 Scaffold /server

```bash
mkdir server && cd server
bun init -y
bun add elysia @prisma/client
bun add -D prisma @types/bun eslint @typescript-eslint/eslint-plugin @typescript-eslint/parser prettier
```

`server/tsconfig.json`:

```json
{
  "compilerOptions": {
    "strict": true,
    "moduleResolution": "bundler",
    "target": "ESNext",
    "module": "ESNext",
    "lib": ["ESNext"],
    "types": ["bun-types"],
    "outDir": "dist"
  },
  "include": ["src"]
}
```

Initialise Prisma:

```bash
bunx prisma init --datasource-provider postgresql
```

This creates `server/prisma/schema.prisma` and reads `DATABASE_URL` from `server/.env`.

`server/.prettierrc`:

```json
{ "singleQuote": true, "semi": false, "printWidth": 100, "trailingComma": "all" }
```

`server/eslint.config.js`:

```js
import tseslint from '@typescript-eslint/eslint-plugin'
import tsParser from '@typescript-eslint/parser'

export default [
  {
    files: ['src/**/*.ts'],
    languageOptions: { parser: tsParser },
    plugins: { '@typescript-eslint': tseslint },
    rules: { ...tseslint.configs['recommended'].rules },
  },
]
```

`server/package.json` scripts:

```json
{
  "scripts": {
    "dev": "bun run src/index.ts",
    "test": "bun test",
    "lint": "eslint .",
    "format": "prettier --write ."
  }
}
```

Create a placeholder `server/src/index.ts`:

```ts
console.log('server placeholder')
```

## 0.5 Scaffold /web

```bash
bun create vite@latest web -- --template react-ts
cd web
bun install
bun add tailwindcss @tailwindcss/vite
bun add react-live html-to-image lucide-react
bun add -D eslint @typescript-eslint/eslint-plugin @typescript-eslint/parser prettier eslint-plugin-react-hooks
```

Wire Tailwind into `web/vite.config.ts`:

```ts
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
})
```

### Shadcn

```bash
bunx shadcn@latest init
```

When prompted: TypeScript yes, style Default, base colour Neutral, CSS variables yes. Follow the Tailwind v4 prompts from the CLI — shadcn@latest detects v4 automatically.

### Theming

Create `web/src/styles/theme.css`:

```css
@import 'tailwindcss';

@theme {
  --color-accent: oklch(32% 0.11 18); /* dark red, warm-neutral */
  --color-accent-fg: oklch(97% 0.01 18); /* near-white text on accent */
  --color-gold: oklch(74% 0.16 62); /* gold base */
  --color-gold-glow: oklch(82% 0.2 62); /* gold with glow, for borders/shadows */
}
```

Import it in `web/src/main.tsx` (replace any existing global import):

```tsx
import './styles/theme.css'
```

Dark mode default — add `class="dark"` to `<html>` in `web/index.html`.

`web/.prettierrc` — identical to `server/.prettierrc`.

`web/eslint.config.js` — same shape as server's, with `eslint-plugin-react-hooks` added:

```js
import tseslint from '@typescript-eslint/eslint-plugin'
import tsParser from '@typescript-eslint/parser'
import reactHooks from 'eslint-plugin-react-hooks'

export default [
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: { parser: tsParser },
    plugins: { '@typescript-eslint': tseslint, 'react-hooks': reactHooks },
    rules: {
      ...tseslint.configs['recommended'].rules,
      ...reactHooks.configs.recommended.rules,
    },
  },
]
```

`web/package.json` scripts — add:

```json
{
  "scripts": {
    "lint": "eslint .",
    "format": "prettier --write ."
  }
}
```

## Stage 0 success condition

- `podman compose ps` — `db` service shows healthy
- `cd web && bun run dev` — browser shows a React page in the correct dark theme (dark red + gold tokens visible in Shadcn components if any are rendered)
- `cd server && bunx prisma generate` — exits 0 (Prisma client generated)
- `cd server && bun run src/index.ts` — prints placeholder, exits 0
- `cd server && bun run lint` and `cd web && bun run lint` — no errors
