import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useRef, useState } from "react";

/* GithubActivity is below the fold and fetches the GitHub API.
   Lazy-load to keep its bundle + network call off the critical path. */
const GithubActivity = lazy(() =>
  import("../components/github-activity").then((m) => ({
    default: m.GithubActivity,
  })),
);
import { Fleuron } from "../components/fleuron";
import { Kicker } from "../components/kicker";
import { PortraitFrame } from "../components/portrait-frame";
import { RubricLink } from "../components/rubric-link";
import { RuleDouble, RuleHair } from "../components/rules";
import { Card, CardContent } from "../components/ui/card";
import { getBioHtml } from "../lib/bio";

/* Self-hosted webp copies of the GitHub avatar (u/47957217) — converted
   once via sharp. Local + webp: no third-party origin on the LCP path,
   passes modern-image-formats, cacheable with our immutable headers.
   240px is twice the displayed CSS size (~120px); 480 covers DPR=2. */
const AVATAR_URL = "/images/author/avatar-240.webp";
const AVATAR_SRCSET =
  "/images/author/avatar-240.webp 1x, /images/author/avatar-480.webp 2x";

/**
 * Spotify embed — currently a public classical playlist as placeholder.
 * Swap the track / playlist ID below to a personal favorite.
 *
 *   Track:    https://open.spotify.com/embed/track/<TRACK_ID>
 *   Playlist: https://open.spotify.com/embed/playlist/<PLAYLIST_ID>
 *   Album:    https://open.spotify.com/embed/album/<ALBUM_ID>
 */
const SPOTIFY_EMBED_URL =
  "https://open.spotify.com/embed/track/60LWmlDdZ2482qQziKsCjF?utm_source=generator&theme=0";
const SPOTIFY_LABEL = "From the author's desk";
const SPOTIFY_EMBED_HEIGHT = 152;

const SITE_URL = "https://fiirman.my.id";
const PAGE_TITLE = "The Author — Firman Justisio Lestari";
const PAGE_DESCRIPTION =
  "A short notice from the desk: who I am, what I work on, and what plays while I write.";

export const Route = createFileRoute("/about")({
  component: About,
  loader: () => ({
    sanitizedBioMarkup: getBioHtml(),
  }),
  head: () => ({
    meta: [
      { title: PAGE_TITLE },
      { name: "description", content: PAGE_DESCRIPTION },
      { property: "og:title", content: PAGE_TITLE },
      { property: "og:description", content: PAGE_DESCRIPTION },
      { property: "og:url", content: `${SITE_URL}/about` },
    ],
    links: [
      { rel: "canonical", href: `${SITE_URL}/about` },
      /* Avatar is the LCP element. Preload must match the <img> src/srcset
         exactly or the browser fetches both URLs. We ship 240 1x / 480 2x;
         imageSrcSet on the preload lets the browser pick the right one
         based on DPR before the <img> tag is parsed. */
      {
        rel: "preload",
        as: "image",
        href: AVATAR_URL,
        imageSrcSet: AVATAR_SRCSET,
        fetchPriority: "high",
      },
    ],
  }),
});

function About() {
  const { sanitizedBioMarkup } = Route.useLoaderData();

  return (
    <section className="py-8">
      {/* Header — portrait + heading + dek */}
      <header className="grid md:grid-cols-12 gap-10 items-center mb-12">
        <div className="md:col-span-4 max-w-2xs sm:max-w-xs md:max-w-none mx-auto md:mx-0 w-full">
          <PortraitFrame
            accent="rubric"
            seal={{ text: "FIRMAN LESTARI · ZEETEC20", monogram: "FL" }}
          >
            <img
              src={AVATAR_URL}
              srcSet={AVATAR_SRCSET}
              alt="Firman Justisio Lestari"
              width={400}
              height={400}
              loading="eager"
              fetchPriority="high"
              decoding="async"
              className="w-full aspect-square object-cover block thumbnail-engraved"
            />
          </PortraitFrame>
          <p className="small-caps text-xs text-fg-muted mt-4 text-center tracking-wider">
            Firman Justisio Lestari · ZEETEC20 · Compositor of these pages
          </p>
        </div>
        <div className="md:col-span-8">
          <Kicker>The Author</Kicker>
          <h1 className="font-serif-display text-4xl md:text-5xl leading-tight mt-3">
            A short notice from the desk.
          </h1>
          <p className="font-serif-display italic text-fg-muted text-xl mt-4 leading-snug">
            Firman Justisio Lestari is a curious person who became a software engineer, with interests far
            beyond tech and always exploring nerdy ideas and random deep dives.
          </p>
        </div>
      </header>

      <RuleDouble className="my-10" />

      {/* Bio body — sourced from content/bio.md */}
      <div
        className="prose-article has-drop-cap"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: build-time, rehype-sanitize'd markdown output (see markdownToHtml)
        dangerouslySetInnerHTML={{ __html: sanitizedBioMarkup }}
      />

      <RuleDouble className="my-12" />

      {/* From the Phonograph — Spotify embed */}
      <section className="max-w-prose mx-auto">
        <div className="text-center mb-6">
          <div className="text-rubric flex justify-center mb-2">
            <Fleuron variant="flourish" />
          </div>
          <Kicker>From the Phonograph</Kicker>
          <h2 className="font-serif-display text-2xl mt-2">
            What plays while the desk is at work.
          </h2>
          <p className="small-caps text-xs text-fg-muted tracking-wider mt-3">
            Now spinning · {SPOTIFY_LABEL}
          </p>
        </div>
        <Card className="rounded-sm border-rule ring-0 bg-bg-aged/60 py-0 gap-0 overflow-hidden">
          <CardContent className="p-1">
            <SpotifyEmbed />
          </CardContent>
        </Card>
      </section>

      <RuleDouble className="my-12" />

      {/* A Year in Keystrokes — GitHub activity */}
      <header className="text-center mb-6">
        <Kicker>From the Ledger</Kicker>
        <h2 className="font-serif-display text-2xl mt-2">
          A year in keystrokes.
        </h2>
      </header>
      <LazyOnVisible minHeight={140}>
        <Suspense fallback={null}>
          <GithubActivity className="max-w-page mx-auto px-2" />
        </Suspense>
      </LazyOnVisible>

      <RuleHair className="my-12 max-w-prose mx-auto" />

      {/* Closing CTA */}
      <div className="text-center pb-4">
        <p className="font-serif-display italic text-fg-muted text-lg mb-3">
          Correspondence is welcomed at the foot of any folio.
        </p>
        <RubricLink to="/articles" className="small-caps text-xs">
          Read the archive →
        </RubricLink>
      </div>
    </section>
  );
}

/**
 * Renders `children` only after the placeholder scrolls into view. Reserves
 * `minHeight` while empty so there's no layout shift when children mount.
 */
function LazyOnVisible({
  children,
  minHeight,
  rootMargin = "200px",
}: {
  children: React.ReactNode;
  minHeight: number;
  rootMargin?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (visible) return;
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver !== "function") {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setVisible(true);
            io.disconnect();
            return;
          }
        }
      },
      { rootMargin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [visible, rootMargin]);

  return (
    <div ref={ref} style={{ minHeight }}>
      {visible ? children : null}
    </div>
  );
}

function SpotifyEmbed() {
  return (
    <LazyOnVisible minHeight={SPOTIFY_EMBED_HEIGHT}>
      <iframe
        title={`Spotify · ${SPOTIFY_LABEL}`}
        src={SPOTIFY_EMBED_URL}
        width="100%"
        height={SPOTIFY_EMBED_HEIGHT}
        loading="lazy"
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
        /* Minimal sandbox: scripts for the player, popups so "open in
           Spotify" can launch. Deliberately NO allow-same-origin — pairing
           it with allow-scripts lets a frame escape its own sandbox. */
        sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox allow-presentation"
        className="block w-full border-0"
      />
    </LazyOnVisible>
  );
}
