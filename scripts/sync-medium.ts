#!/usr/bin/env bun
/**
 * Build-time Medium sync. Every run re-fetches and overwrites every synced
 * article — no pubDate-diff skip. See content-sources.md Source B for the spec.
 *
 * Body source: for each RSS item, fetch the live post page and parse the
 * embedded `window.__APOLLO_STATE__` content model (ordered paragraphs with
 * markups — bold/italic/link/inline-code, plus code-block language). This is
 * what Medium's own page renders from. The RSS feed's `content:encoded` is
 * lossy — it drops inline `<code>` formatting entirely — so it's kept only
 * as a fallback if the live-page fetch or the embedded model is unavailable.
 *
 * Usage:
 *   bun run scripts/sync-medium.ts
 */
import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { XMLParser } from "fast-xml-parser";
import matter from "gray-matter";
import TurndownService from "turndown";
// @ts-expect-error — no types ship for the GFM plugin
import { gfm } from "turndown-plugin-gfm";

const ROOT = path.resolve(import.meta.dir, "..");
const CONTENT_DIR = path.join(ROOT, "content", "medium");
const ASSET_ROOT = path.join(ROOT, "public", "article");
const FEED_URL = "https://medium.com/feed/@firmanlestari";
const WRITER = "zeetec20";
const PAGE_FETCH_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

type RssItem = {
  title: string;
  link: string;
  pubDate: string;
  "content:encoded": string;
  category?: string | string[];
};

// Medium's internal content model, resolved out of window.__APOLLO_STATE__.
type ApolloMarkup = {
  type: string;
  start: number;
  end: number;
  href?: string | null;
};

type ApolloParagraph = {
  type: string;
  text?: string;
  markups?: ApolloMarkup[];
  codeBlockMetadata?: { lang?: string | null } | null;
  metadata?: {
    id?: string;
    originalWidth?: number;
    originalHeight?: number;
  } | null;
};

const turndown = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
  hr: "---",
  bulletListMarker: "-",
});
turndown.use(gfm);

/**
 * Best-effort language detection for code blocks. Used as a fallback when
 * Medium's own `codeBlockMetadata.lang` is missing (RSS never carries a
 * language hint at all, so this is the only option on that path).
 */
function detectLanguage(code: string): string {
  const head = code.trim().slice(0, 400);
  // ASCII / box-drawing art: keep monospaced, no syntax tokens.
  if (/[┌└├┤┬┴┼─│►▼◄▲]/.test(head)) return "text";
  // JSON-ish object: { "key": value }
  if (/^\s*\{[\s\S]*\}\s*$/.test(code) && /"[^"\\]+"\s*:/.test(head))
    return "json";
  // YAML
  if (/^\s*[A-Za-z_][\w-]*\s*:\s*\S/m.test(head) && /^---\s*$/m.test(head))
    return "yaml";
  // Bash / shell. Runs after the box-art guard above so ASCII diagrams that
  // happen to contain shell-looking words stay "text".
  if (/^#!\/(?:usr\/)?bin\/(?:bash|sh|zsh)/m.test(head)) return "bash";
  if (/^\s*\$\s+\S/m.test(head)) return "bash";
  // Shell control syntax (Medium RSS strips the lang, so these blocks would
  // otherwise fall through to "text").
  if (
    /\bif\s+\[|^\s*then\b|^\s*fi\b|^\s*done\b|^\s*esac\b|\bcase\s+.+\s+in\b|\bwhile\s+read\b|^\s*exit\s+\d/m.test(
      head,
    )
  )
    return "bash";
  // Lines starting with a common CLI command.
  if (
    /^\s*(?:git|bun|bunx|npm|npx|pnpm|yarn|cd|echo|export|source|curl|wget|sudo|apt|brew|chmod|chown|mkdir|rm|cp|mv|docker|kubectl)\s+\S/m.test(
      head,
    )
  )
    return "bash";
  // SQL
  if (/\b(SELECT|INSERT|UPDATE|DELETE|CREATE TABLE)\b/i.test(head))
    return "sql";
  // Python
  if (
    /\bdef\s+\w+\s*\(|^\s*import\s+\w+|^\s*from\s+\w+\s+import\b|print\(/m.test(
      head,
    )
  )
    return "python";
  // Go
  if (/^\s*package\s+\w+|^\s*func\s+\w+\s*\(/m.test(head)) return "go";
  // Dart
  if (/\bvoid\s+main\s*\(\s*\)\s*\{|Widget\s+build\s*\(/.test(head))
    return "dart";
  // CSS — selector { prop: value; }
  if (
    /[.#]?\w+(?:\s*[.#:][\w-]+)*\s*\{[\s\S]*?[\w-]+\s*:\s*[^;}]+;[\s\S]*?\}/m.test(
      head,
    )
  )
    return "css";
  // TypeScript / JavaScript — broad net last
  if (
    /\b(const|let|var|function|=>|async|await|interface|type|export|import|class|extends)\b/.test(
      head,
    )
  )
    return "ts";
  return "text";
}

/**
 * Force every <pre> into a fenced code block regardless of inner structure.
 * Medium often emits <pre><span>…</span></pre> without a <code> child, so the
 * default GFM `fencedCodeBlock` rule never matches and code leaks out as a
 * regular paragraph. This rule runs last and overrides. RSS-fallback path only.
 */
turndown.addRule("preBlock", {
  filter: "pre",
  replacement: (_content, node) => {
    const html = (node as HTMLElement).innerHTML ?? "";
    const text = html
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|li|h[1-6])>\s*<\1[^>]*>/gi, "\n")
      .replace(/<\/(p|div|li|h[1-6])>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/^\n+|\n+$/g, "");
    const lang = detectLanguage(text);
    return `\n\n\`\`\`${lang}\n${text}\n\`\`\`\n\n`;
  },
});

function slugFromLink(link: string): string {
  // strip query + fragment first, then trailing slash, then take last segment
  const noQuery = link.split("?")[0].split("#")[0];
  const tail = noQuery.replace(/\/+$/, "").split("/").pop() ?? "";
  // strip Medium's trailing -<8-12 char hex hash>
  return tail.replace(/-[0-9a-f]{6,12}$/i, "");
}

function formatDate(rfc2822: string): string {
  const d = new Date(rfc2822);
  if (Number.isNaN(d.getTime())) return rfc2822;
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = d.getUTCFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

function unwrap<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function plainText(html: string): string {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extFromContentType(ct: string | null, url: string): string {
  if (ct?.includes("png")) return "png";
  if (ct?.includes("gif")) return "gif";
  if (ct?.includes("webp")) return "webp";
  if (ct?.includes("jpeg")) return "jpg";
  const m = url.match(/\.(png|jpe?g|gif|webp)(?:\?|$)/i);
  if (m) return m[1].toLowerCase() === "jpeg" ? "jpg" : m[1].toLowerCase();
  return "jpg";
}

async function downloadImage(url: string, dest: string): Promise<boolean> {
  if (await Bun.file(dest).exists()) return true;
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) {
    console.warn(
      `  ! image download failed (${res.status}): ${url} → skipping`,
    );
    return false;
  }
  const buf = new Uint8Array(await res.arrayBuffer());
  await writeFile(dest, buf);
  return true;
}

function extractImageUrls(html: string): string[] {
  const urls: string[] = [];
  for (const match of html.matchAll(/<img[^>]+src=["']([^"']+)["'][^>]*>/g)) {
    const src = match[1];
    // Skip Medium's 1x1 view-tracking pixel that trails content:encoded.
    // Left in, it becomes a bogus img-N.jpg linked at the end of the body.
    if (/medium\.com\/_\/stat|\/_\/stat\b/.test(src)) continue;
    urls.push(src);
  }
  return urls;
}

// ---------------------------------------------------------------------------
// Apollo-state path (primary): fetch the live post page, pull the embedded
// content model, build markdown directly from it — no HTML/turndown involved.
// ---------------------------------------------------------------------------

async function fetchPostPage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "user-agent": PAGE_FETCH_UA },
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

function extractApolloState(html: string): Record<string, any> | null {
  const m = html.match(
    /window\.__APOLLO_STATE__\s*=\s*(\{[\s\S]*?\})\s*;?\s*<\/script>/,
  );
  if (!m) return null;
  try {
    return JSON.parse(m[1]);
  } catch {
    return null;
  }
}

/** Resolve `Post:*`.content(...).bodyModel.paragraphs refs into paragraph objects, in order. */
function resolveParagraphs(
  state: Record<string, any>,
): ApolloParagraph[] | null {
  const postKey = Object.keys(state).find((k) => k.startsWith("Post:"));
  if (!postKey) return null;
  const post = state[postKey];
  // The GraphQL arg string in the field key can vary; match by prefix.
  const contentKey = Object.keys(post ?? {}).find((k) =>
    k.startsWith("content("),
  );
  if (!contentKey) return null;
  const refs = post[contentKey]?.bodyModel?.paragraphs;
  if (!Array.isArray(refs) || refs.length === 0) return null;
  const paragraphs: ApolloParagraph[] = [];
  for (const r of refs) {
    const ref = r?.__ref;
    if (!ref || !state[ref]) return null;
    paragraphs.push(state[ref]);
  }
  return paragraphs;
}

function normalizeTitle(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Medium's content model repeats the post title as the first paragraph(s) of
 * the body — a heading, sometimes followed by a bold-only paragraph
 * restating it. Drop those (mirrors the old RSS path's STRIP_LEADING rules)
 * so the frontmatter title isn't duplicated in the rendered body.
 */
function stripDuplicateTitleParagraphs(
  paragraphs: ApolloParagraph[],
  title: string,
): ApolloParagraph[] {
  const target = normalizeTitle(title);
  const result = [...paragraphs];
  // Walk past leading IMG paragraphs without removing them (they carry the
  // thumbnail, handled separately) — only strip heading/bold paragraphs that
  // duplicate the title, stopping at the first paragraph that's neither.
  let i = 0;
  while (i < result.length) {
    const p = result[i];
    if (p.type === "IMG") {
      i++;
      continue;
    }
    const text = (p.text ?? "").trim();
    const isHeading = /^H[1-4]$/.test(p.type);
    const isBoldOnly =
      p.type === "P" &&
      p.markups?.length === 1 &&
      p.markups[0].type === "STRONG" &&
      p.markups[0].start === 0 &&
      p.markups[0].end === text.length;
    if ((isHeading || isBoldOnly) && normalizeTitle(text) === target) {
      result.splice(i, 1);
      continue;
    }
    break;
  }
  return result;
}

/**
 * Wrap markup spans (CODE/STRONG/EM/A) into markdown syntax. Splices from the
 * end of the string backward so earlier offsets stay valid as we go.
 * ponytail: no overlap handling, add interval-tree merge if a future article
 * has nested markups (none observed in any sampled article).
 */
function applyMarkups(text: string, markups: ApolloMarkup[] | undefined): string {
  if (!markups || markups.length === 0) return text;
  const sorted = [...markups].sort((a, b) => b.start - a.start);
  let out = text;
  for (const m of sorted) {
    const before = out.slice(0, m.start);
    const inner = out.slice(m.start, m.end);
    const after = out.slice(m.end);
    let wrapped: string;
    switch (m.type) {
      case "CODE":
        wrapped = `\`${inner}\``;
        break;
      case "STRONG":
        wrapped = `**${inner}**`;
        break;
      case "EM":
        wrapped = `*${inner}*`;
        break;
      case "A":
        wrapped = m.href ? `[${inner}](${m.href})` : inner;
        break;
      default:
        wrapped = inner;
    }
    out = before + wrapped + after;
  }
  return out;
}

/**
 * Download every IMG paragraph's image. First one becomes the thumbnail and
 * is dropped from the body (mirrors the old RSS-path behavior); the rest are
 * kept as a paragraph → local-path map for buildMarkdownFromParagraphs to
 * inline in place.
 */
async function downloadParagraphImages(
  paragraphs: ApolloParagraph[],
  slug: string,
  assetDir: string,
): Promise<{ thumbnail: string; localPathByParagraph: Map<ApolloParagraph, string> }> {
  const imgParagraphs = paragraphs.filter((p) => p.type === "IMG");
  const localPathByParagraph = new Map<ApolloParagraph, string>();
  let thumbnail = "";
  for (let i = 0; i < imgParagraphs.length; i++) {
    const p = imgParagraphs[i];
    const meta = p.metadata;
    if (!meta?.id) continue;
    const width = Math.min(meta.originalWidth ?? 1400, 1400);
    const url = `https://miro.medium.com/v2/resize:fit:${width}/${meta.id}`;
    const probe = await fetch(url, { method: "HEAD" }).catch(() => null);
    const ct = probe?.headers.get("content-type") ?? null;
    const ext = extFromContentType(ct, url);
    const name = i === 0 ? `thumbnail.${ext}` : `img-${i}.${ext}`;
    const dest = path.join(assetDir, name);
    const ok = await downloadImage(url, dest);
    if (!ok) continue;
    const localPath = `/article/${slug}/${name}`;
    if (i === 0) thumbnail = localPath;
    else localPathByParagraph.set(p, localPath);
  }
  return { thumbnail, localPathByParagraph };
}

function buildMarkdownFromParagraphs(
  paragraphs: ApolloParagraph[],
  localPathByParagraph: Map<ApolloParagraph, string>,
): string {
  const lines: string[] = [];
  let olCounter = 0;
  for (const p of paragraphs) {
    const text = applyMarkups(p.text ?? "", p.markups);
    switch (p.type) {
      case "IMG": {
        olCounter = 0;
        const localPath = localPathByParagraph.get(p);
        if (localPath) lines.push(`![](${localPath})`);
        break;
      }
      case "H1":
      case "H2":
      case "H3":
      case "H4": {
        olCounter = 0;
        const level = Number(p.type[1]);
        lines.push(`${"#".repeat(level)} ${text}`);
        break;
      }
      case "PRE": {
        olCounter = 0;
        const codeText = p.text ?? "";
        // Box-drawing ASCII diagrams wins over Medium's own stored language —
        // authors often leave a diagram block's language selector on
        // whatever was last used (seen: "sql", "graphql" on tree/flow art).
        const lang = /[┌└├┤┬┴┼─│►▼◄▲]/.test(codeText)
          ? "text"
          : p.codeBlockMetadata?.lang || detectLanguage(codeText);
        lines.push(`\`\`\`${lang}\n${codeText}\n\`\`\``);
        break;
      }
      case "BQ":
      case "PQ":
        olCounter = 0;
        lines.push(`> ${text}`);
        break;
      case "ULI":
        olCounter = 0;
        lines.push(`- ${text}`);
        break;
      case "OLI":
        olCounter += 1;
        lines.push(`${olCounter}. ${text}`);
        break;
      case "P":
        olCounter = 0;
        lines.push(text);
        break;
      default:
        // ponytail: fallback-as-paragraph ceiling, add a real case if this warns
        olCounter = 0;
        console.warn(
          `  ! unhandled paragraph type "${p.type}", rendering as plain text`,
        );
        lines.push(text);
    }
  }
  return lines.join("\n\n").trim();
}

type SyncedBody = { markdown: string; thumbnail: string; description: string };

async function buildFromApolloState(
  item: RssItem,
  slug: string,
  assetDir: string,
): Promise<SyncedBody | null> {
  const html = await fetchPostPage(item.link);
  if (!html) {
    console.warn(`  ! could not fetch live page, falling back to RSS`);
    return null;
  }
  const state = extractApolloState(html);
  if (!state) {
    console.warn(`  ! no __APOLLO_STATE__ found, falling back to RSS`);
    return null;
  }
  const rawParagraphs = resolveParagraphs(state);
  if (!rawParagraphs) {
    console.warn(`  ! could not resolve paragraph model, falling back to RSS`);
    return null;
  }
  const paragraphs = stripDuplicateTitleParagraphs(rawParagraphs, item.title);
  if (paragraphs.length === 0) return null;

  const { thumbnail, localPathByParagraph } = await downloadParagraphImages(
    paragraphs,
    slug,
    assetDir,
  );
  const markdown = buildMarkdownFromParagraphs(paragraphs, localPathByParagraph);
  if (markdown.length === 0) return null;

  const description = paragraphs
    .filter((p) => p.type === "P")
    .map((p) => p.text ?? "")
    .join(" ")
    .slice(0, 200);

  return { markdown, thumbnail, description };
}

// ---------------------------------------------------------------------------
// RSS + turndown path (fallback): today's original behavior, unchanged.
// ---------------------------------------------------------------------------

async function buildFromRss(
  item: RssItem,
  slug: string,
  assetDir: string,
): Promise<SyncedBody> {
  let body = item["content:encoded"];
  // Drop Medium's trailing 1x1 view-tracking pixel <img> before anything else,
  // or turndown renders it as a remote ![](…/_/stat?…) at the end of the body.
  body = body.replace(/<img[^>]+src=["'][^"']*\/_\/stat[^"']*["'][^>]*>/g, "");
  const imgUrls = extractImageUrls(body);

  let thumbnail = "";

  // 1) Promote first image to thumbnail and strip it from body.
  if (imgUrls.length > 0) {
    const firstUrl = imgUrls[0];
    const probe = await fetch(firstUrl, { method: "HEAD" }).catch(() => null);
    const ct = probe?.headers.get("content-type") ?? null;
    const ext = extFromContentType(ct, firstUrl);
    const name = `thumbnail.${ext}`;
    const dest = path.join(assetDir, name);
    const ok = await downloadImage(firstUrl, dest);
    if (ok) thumbnail = `/article/${slug}/${name}`;

    // Remove the <img> tag for firstUrl from body (and any wrapping <figure>),
    // so the header <ArticleThumbnail> isn't duplicated by the body markdown.
    const escaped = firstUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    body = body
      .replace(
        new RegExp(
          `<figure[^>]*>\\s*<img[^>]+src=["']${escaped}["'][^>]*>[\\s\\S]*?</figure>`,
          "g",
        ),
        "",
      )
      .replace(new RegExp(`<img[^>]+src=["']${escaped}["'][^>]*>`, "g"), "");
  }

  // 1b) Strip leading Medium boilerplate: photo credit + duplicate title
  //     repeated as heading or bold paragraph. Iterate until no more matches
  //     at the very top of the body.
  const STRIP_LEADING: RegExp[] = [
    /^\s*<figure[\s\S]*?<\/figure>/i,
    /^\s*<p[^>]*>\s*Photo by[\s\S]*?<\/p>/i,
    /^\s*<h[1-6][^>]*>[\s\S]*?<\/h[1-6]>/i,
    /^\s*<p[^>]*>\s*<strong[^>]*>[\s\S]*?<\/strong>\s*<\/p>/i,
  ];
  {
    let changed = true;
    while (changed) {
      changed = false;
      for (const re of STRIP_LEADING) {
        const next = body.replace(re, "");
        if (next !== body) {
          body = next;
          changed = true;
        }
      }
    }
  }

  // 2) Localise the remaining image URLs in the body.
  for (let i = 1; i < imgUrls.length; i++) {
    const url = imgUrls[i];
    const probe = await fetch(url, { method: "HEAD" }).catch(() => null);
    const ct = probe?.headers.get("content-type") ?? null;
    const ext = extFromContentType(ct, url);
    const name = `img-${i}.${ext}`;
    const dest = path.join(assetDir, name);
    const ok = await downloadImage(url, dest);
    if (!ok) continue;
    body = body.split(url).join(`/article/${slug}/${name}`);
  }

  // HTML → Markdown
  const markdown = turndown.turndown(body).trim();
  const description = plainText(body).slice(0, 200);

  return { markdown, thumbnail, description };
}

async function processItem(item: RssItem) {
  const slug = slugFromLink(item.link);
  console.error(`\n→ ${slug}`);

  const assetDir = path.join(ASSET_ROOT, slug);
  const mdPath = path.join(CONTENT_DIR, `${slug}.md`);
  const newDate = formatDate(item.pubDate);

  await mkdir(assetDir, { recursive: true });

  const synced =
    (await buildFromApolloState(item, slug, assetDir)) ??
    (await buildFromRss(item, slug, assetDir));

  if (synced.markdown.length === 0) {
    console.warn(`  ! empty markdown body, skipping`);
    return;
  }

  const tags = unwrap(item.category);

  const frontmatter = {
    title: item.title,
    description: synced.description,
    thumbnail: synced.thumbnail || "",
    createdAt: newDate,
    writer: WRITER,
    tag: tags,
    source: "medium",
    sourceUrl: item.link,
  };

  const fileContent = matter.stringify(`${synced.markdown}\n`, frontmatter);
  await writeFile(mdPath, fileContent);
  console.error(`  ✓ wrote ${mdPath}`);
  await stat(mdPath);
}

async function main() {
  await mkdir(CONTENT_DIR, { recursive: true });
  await mkdir(ASSET_ROOT, { recursive: true });

  console.error(`Fetching ${FEED_URL} …`);
  const res = await fetch(FEED_URL);
  if (!res.ok) {
    console.error(`Feed fetch failed: ${res.status} ${res.statusText}`);
    process.exit(1);
  }
  const xml = await res.text();
  const parser = new XMLParser({ ignoreAttributes: false });
  const data = parser.parse(xml);
  const items = unwrap(data?.rss?.channel?.item) as RssItem[];
  console.error(`Found ${items.length} items.`);
  for (const item of items) {
    await processItem(item);
  }
  console.error(`\nDone.`);
}

await main();
