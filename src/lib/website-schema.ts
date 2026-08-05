/**
 * schema.org WebSite JSON-LD. Emitted site-wide via the root route's
 * `head().meta` using TanStack's `script:ld+json` key (same pipeline as
 * `personSchema`). Models the site itself and links its author to the Person
 * node by `@id`, so search engines resolve one canonical entity graph.
 */
const SITE_URL = "https://fiirman.my.id";

export const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": `${SITE_URL}/#website`,
  name: "Firman Lestari",
  url: SITE_URL,
  description:
    "Firman Justisio Lestari is a curious person who became a software engineer, with interests far beyond tech and always exploring nerdy ideas and random deep dives.",
  inLanguage: "en",
  author: { "@id": `${SITE_URL}/#person` },
} as const;
