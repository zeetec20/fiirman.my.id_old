/**
 * schema.org Person JSON-LD. Emitted site-wide via the root route's
 * `head().meta` using TanStack's `script:ld+json` key, which serializes
 * and HTML-escapes the object into a <script type="application/ld+json">.
 *
 * `name` is the legal full name; `alternateName` claims the shorter byline
 * + handle so search engines associate every form with one entity.
 */
const SITE_URL = "https://fiirman.my.id";

export const personSchema = {
  "@context": "https://schema.org",
  "@type": "Person",
  "@id": `${SITE_URL}/#person`,
  name: "Firman Justisio Lestari",
  alternateName: ["Firman Lestari", "ZEETEC20"],
  url: SITE_URL,
  image: "https://avatars.githubusercontent.com/u/47957217?size=480",
  jobTitle: "Software Engineer",
  description:
    "Firman Justisio Lestari is a curious person who became a software engineer, with interests far beyond tech and always exploring nerdy ideas and random deep dives.",
  sameAs: [
    "https://github.com/zeetec20",
    "https://www.linkedin.com/in/firmanlestari",
    "https://firmanlestari.vercel.app",
    "https://www.facebook.com/firman.lestari.12",
  ],
} as const;
