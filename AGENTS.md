# Project — firmanlestari (Portfolio)

Personal portfolio. TanStack Start on Cloudflare Workers, Bun runtime, React. Articles sourced from a GitHub repo and Medium RSS, rendered at build/SSR.

Read `design.md` and `content-schema.md` and `content-sources.md` alongside this file. They are part of the contract.

---

## Stack (locked)

| Layer | Choice | Notes |
|---|---|---|
| Runtime | Bun ≥1.2 | `bun install`, `bun run`, `bunx`. **Never `npm`/`pnpm`/`yarn`.** |
| Framework | TanStack Start (latest stable) | SSR via Nitro Cloudflare preset |
| Router | TanStack Router | File-based, fully typed, generated route tree |
| Server state | TanStack Query | |
| Styling | Tailwind CSS v4 | CSS-first config. `@theme` block in `src/styles.css`. |
| Components | shadcn/ui | **Always pull via shadcn MCP** — never paste from memory |
| Markdown | `react-markdown` + `rehype-raw` + `remark-gfm` | Articles contain inline HTML |
| Syntax highlight | Shiki via `@shikijs/rehype` | Build/SSR-time only, no client runtime |
| Animation | `framer-motion` | |
| Forms | `react-hook-form` + `@hookform/resolvers/zod` | |
| Validation | Zod | Schema is source of truth — `z.infer` for TS types |
| Icons | `lucide-react` | |
| Deploy | Cloudflare Workers via `wrangler` | |

---

## Commands

```
bun install            # install deps
bun dev                # TanStack Start dev server
bun run build          # production build
bun run preview        # local preview of built worker
bun run deploy         # wrangler deploy
bun run typecheck      # tsc --noEmit
bun run lint           # configured linter (TBD: biome vs eslint)
bun run sync:medium    # pull latest Medium posts via RSS
bun run lh             # Lighthouse CI autorun, mobile emulation (collect, assert)
bun run lh:desktop     # Lighthouse CI autorun, desktop preset (lighthouserc.desktop.json)
bun run lh:collect     # Collect Lighthouse runs against the configured URLs
bun run lh:assert      # Assert against budgets in lighthouserc.json
```

Lighthouse CI runs both mobile and desktop on every PR to `master` via `.github/workflows/lighthouse.yml`. Budgets: desktop perf ≥ 95 + LCP < 2.5 s (error); mobile perf ≥ 85 (error, warn at LCP 2.5 s — the throttled slow-4G simulation against local `wrangler dev` has a ~2 s LCP floor; production PSI-mobile scores higher); a11y = 100, BP ≥ 95, SEO = 100, CLS < 0.1, TBT < 300 ms on both.

---

## Conventions

- **Routing** — file-based under `src/routes/`. No manual route configs. Trust the generated `routeTree.gen.ts`.
- **Server functions** — only in `*.server.ts` files. Never mix server-only imports in client modules.
- **Forms** — RHF + Zod resolver. No raw `useState` for form state.
- **Env** — all env reads through a Zod-validated `src/env.ts`. No bare `process.env` / `import.meta.env` in feature code.
- **Tailwind** — design tokens from `design.md` only. No `text-[#hex]`, no arbitrary spacing values, no off-scale font sizes.
- **Components** — prefer shadcn primitives over hand-rolled. Compose with Tailwind utilities; no CSS modules.
- **Article rendering** — markdown is pre-processed at build/SSR. No client-side markdown parsing for static articles.
- **Design vocabulary** — UI vocabulary follows `design.md`: parchment + ink + rubric, hairline rules, double-rule section breaks, drop caps, fleuron ornaments. Name components in this register (`masthead`, `kicker`, `dek`, `byline`, `dateline`, `rubric-link`, `rule-hair`, `rule-double`) — **not** modern-web register (`hero banner`, `card grid`, `CTA`, `pill`). The aesthetic is newspaper × medieval × timeless; copy follows suit (sober, declarative, no marketing tone).

---

## Anti-slop rules (do these before writing code)

1. **shadcn component** → call `shadcn` MCP `get_component` for current source. Don't paste from memory.
2. **TanStack API** → call `context7` MCP `get-library-docs` with `/tanstack/start` or `/tanstack/router` before importing a hook/function.
3. **Cloudflare Workers API** → verify via `context7` or `wrangler` docs. Workers runtime ≠ Node.
4. **Never invent** a route name, hook name, or export. Verify it exists in current docs.
5. **Design tokens** → reference `design.md`. If a token is missing, add it to `design.md` first, then use it.
6. **Imagery** → place per-article thumbnails manually under `/public/images/<slug>/` (filename referenced from the article frontmatter). Never embed a remote URL in source. If an article has no thumbnail (or the referenced file is missing on disk), the renderer falls back to `/public/images/placeholder/sunflower.jpg` — do not invent paths.

---

## Don'ts

- No CSS-in-JS (`styled-components`, `emotion`).
- No Next.js patterns (`getServerSideProps`, `app/` directory conventions, `next/image`, `next/link`).
- No Node-only APIs at runtime (`fs`, `path`, `crypto.createHash`). Use Web APIs (`crypto.subtle`, `Request`, `Response`).
- No client-side markdown parsing for static article content.
- No installing a UI lib alongside shadcn (no MUI, Chakra, Mantine, Radix-direct).
- No state managers (no Redux, Zustand, Jotai) unless a concrete need is proven — TanStack Query covers server state, `useState`/`useReducer` covers UI state.

---

## Working with this project

- Read `design.md` before touching any UI.
- Read `content-schema.md` before touching article rendering.
- Read `content-sources.md` before touching sync scripts.
- Before opening a PR, invoke the `design-guard` subagent on the diff.

## Memory

Project-specific facts (decisions, deadlines, surprising constraints) belong in the auto-memory system, not here. This file is the public contract.
