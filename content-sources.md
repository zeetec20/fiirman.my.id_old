# Content Sources — Ingestion

Two paths feed `/content`. Both write **normalized frontmatter** (see `content-schema.md`) so the renderer is source-agnostic.

```
/content
├── github/<slug>.md         ← one-shot manual import (run once, then forget)
└── medium/<slug>.md         ← sync:medium (cron, daily)

/public/article/<slug>/      ← article assets (both sources)
```

---

## Source A — GitHub repo (one-shot import, no script)

**Origin:** `https://github.com/zeetec20/zeetec20.github.io` (branch `master`)

- Markdown: `articles/<slug>.md`
- Assets: `article/<slug>/*` (images)

**Why one-shot:** The source repo is being decommissioned in favor of this portfolio. Once these articles land in `/content/github/`, the upstream will not change again. No script, no cron, no MCP, no automation — a documented manual procedure run once.

**Procedure (execute once, then never again):**

```bash
# 1. Shallow clone the source repo to a scratch directory.
git clone --depth=1 https://github.com/zeetec20/zeetec20.github.io.git /tmp/zeetec20-src

# 2. Copy markdown into /content/github/.
mkdir -p content/github
cp /tmp/zeetec20-src/articles/*.md content/github/

# 3. Copy article assets into /public/article/.
mkdir -p public/article
cp -R /tmp/zeetec20-src/article/* public/article/

# 4. Append `source: github` to each article's frontmatter.
#    Done by hand (5 files) or via a one-line sed — your call.
#    The other fields already match the normalized shape.

# 5. Sanity check.
ls content/github/   # should list 5 .md files
ls public/article/   # should list 5 sub-folders

# 6. Verify with `bun run typecheck` once the Zod loader exists.

# 7. Delete the scratch tree.
rm -rf /tmp/zeetec20-src
```

After step 7, the articles live permanently in this repo. The upstream is no longer relevant.

**No `bun run sync:github`. No GitHub MCP. No PAT. No GitHub Actions workflow for this source.**

---

## Source B — Medium

**Origin (post list):** `https://medium.com/feed/@firmanlestari` (RSS 2.0)

- Returns latest ~10 posts as RSS 2.0 XML.
- Each item contains: `<title>`, `<link>`, `<pubDate>`, `<category>` (multiple), `<content:encoded>` (full HTML body).
- RSS supplies the post list (title/link/pubDate/tags) for every sync. **It does not supply the reliable body** — see below.

**Origin (post body, primary):** the live post page at `<link>`.

Medium's RSS `content:encoded` is lossy: it drops inline `<code>` formatting entirely (confirmed — 0 `<code>` tags across a full feed fetch, vs. 9 `<pre>` block-code tags). The live post page embeds `window.__APOLLO_STATE__`, Medium's own structured content model, which has what RSS is missing: ordered `Paragraph` nodes with `markups` (`CODE`, `STRONG`, `EM`, `A`) and, for code blocks, the actual `codeBlockMetadata.lang` Medium stored (no heuristic needed). This is the primary body source.

**Script:** `scripts/sync-medium.ts`

**Deps:** `fast-xml-parser`, `turndown`, `turndown-plugin-gfm`, `gray-matter`. All dev deps — script runs at build/cron time, never in the Worker.

**Pipeline per item:**

1. Fetch RSS, parse with `fast-xml-parser`, for each `<item>`:
   - `link` → strip Medium's trailing `-<8char-hash>` → `slug`.
   - `pubDate` (`Wed, 15 Mar 2023 10:23:11 GMT`) → `DD-MM-YYYY`.
   - `category[]` → `tag[]`.
2. **Body — primary path:** `fetch(link)` with a browser UA, extract `window.__APOLLO_STATE__`, resolve `Post:*.content(...).bodyModel.paragraphs` (ordered refs) into paragraph objects. Build markdown directly from the paragraph model:
   - `P`/`H1`-`H4`/`BQ`/`PQ`/`OLI`/`ULI` → matching markdown block, with `markups` applied as backticks/bold/italic/links.
   - `PRE` → fenced block; language = `codeBlockMetadata.lang`, except box-drawing ASCII diagrams always force `text` regardless of the stored lang (Medium authors often leave a diagram's language selector on whatever was last used).
   - `IMG` → not inlined as text; handled by the image pass below. First `IMG` paragraph → thumbnail (dropped from body); rest → inline `![]()` at their local path.
   - Leading heading/bold paragraphs that just repeat the post title are dropped (Medium's model duplicates the title into the body).
   - Any paragraph type not listed above renders as plain text with a `console.warn` naming the type, so a new Medium block type is visible in sync logs rather than silently mangled.
3. **Body — fallback path:** if the page fetch fails, `__APOLLO_STATE__` isn't found, or the paragraph model can't be resolved, fall back to the original approach — convert `<content:encoded>` HTML → Markdown via `turndown` (GFM plugin enabled), preserving `<pre>`/`<blockquote>`/lists/headings/inline `<code>`, stripping Medium-injected tracking spans and boilerplate. This keeps sync from hard-failing if Medium changes the page's internal field names; it just loses inline-code fidelity for that one article until the primary path resolves again on the next run.
4. Image handling (primary path): each `IMG` paragraph's URL is built as `https://miro.medium.com/v2/resize:fit:<width>/<metadata.id>` from the paragraph's own metadata. Fallback path: images are extracted by regex from the RSS HTML instead. Either way — first image → `public/article/<slug>/thumbnail.<ext>`, rest → `img-<N>.<ext>` (Content-Type-derived extension). Why download: Medium hot-linking is unreliable, breaks offline, and CDN URLs rotate.
5. Build normalized frontmatter (see `content-schema.md`) and write `content/medium/<slug>.md` via `gray-matter`. Every run re-fetches and overwrites all synced articles — no pubDate-diff skip currently implemented.

**Trigger options:**

| Trigger | When |
|---|---|
| Manual: `bun run sync:medium` | Always available, local testing |
| **GitHub Actions cron daily** (recommended) | `.github/workflows/sync-medium.yml`. Runs `bun run sync:medium`, commits diff to `main` if any. Push triggers Cloudflare Workers deploy via Wrangler GitHub Action. |
| Pre-build hook | Optional: chain in `build` script. Rejected as default — slows deploys, fails build on Medium downtime. |

**Worker-side runtime fetch is explicitly rejected.** Reasons:
- Cold-start latency from blocking RSS fetch.
- Medium rate-limits on Worker IPs.
- Image hot-linking breaks.
- No streaming benefit — articles are static.

**Auth:** none. Public RSS feed; live post pages are the author's own public (non-paywalled) posts, fetched unauthenticated.

**Limitation:** RSS caps at the latest ~10 posts. For backfill of older posts:
- Use Medium account export (Settings → Account → Download your information).
- Convert HTML to Markdown manually, drop in `content/medium/<slug>.md` with `source: medium` + correct `createdAt`.
- One-time operation, no recurring script needed.

---

## GitHub Actions workflow (sketch)

`.github/workflows/sync-medium.yml`:

```yaml
name: sync-medium
on:
  schedule:
    - cron: "0 6 * * *"  # 06:00 UTC daily
  workflow_dispatch:
jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: bun install --frozen-lockfile
      - run: bun run sync:medium
      - name: Commit changes
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add content/medium public/article
          if git diff --cached --quiet; then
            echo "No new posts"
            exit 0
          fi
          git commit -m "chore(content): sync Medium"
          git push
```

CF Workers deploy runs on push to `main` via a separate workflow (out of scope here).

---

## Failure modes + handling

| Failure | Behavior |
|---|---|
| RSS fetch 5xx | Script exits non-zero, workflow fails, no commit. Next cron retries. |
| Image download fails | Log warning, skip that image, continue. Article still publishes without that image (renderer must handle missing `src`). |
| HTML → MD produces empty body | Skip item, log warning. Don't write a file. |
| Frontmatter validation fails (Zod) | Skip item, log warning. |
| GitHub commit fails (no diff) | Workflow exits 0 — that's the "no new posts" case. |

No silent failures — every skip logs to stdout and shows in Actions output.
