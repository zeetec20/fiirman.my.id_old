import { createFileRoute, notFound } from "@tanstack/react-router";
import { useEffect } from "react";
import { ArticleBody } from "../components/article-body";
import { ArticleThumbnail } from "../components/article-thumbnail";
import { Byline } from "../components/byline";
import { Kicker } from "../components/kicker";
import { RuleDouble } from "../components/rules";
import { ArticleProgress } from "../components/article-progress";
import { BackToTop } from "../components/back-to-top";
import { Comments } from "../components/comments";
import { Button } from "../components/ui/button";
import { fetchArticleBody } from "../lib/article-body";
import { getArticleMeta, thumbnailSrcSet, thumbnailUrl } from "../lib/articles";
import { estimateReadingMinutes } from "../lib/reading";
import { trackAnalytic } from "../lib/track-analytic";

export const Route = createFileRoute("/articles/$slug")({
	component: ArticlePage,
	loader: async ({ params }) => {
		const meta = getArticleMeta(params.slug);
		if (!meta) throw notFound();
		const body = await fetchArticleBody({ data: params.slug });
		if (body === null) throw notFound();
		return {
			article: { ...meta, body },
			minutes: estimateReadingMinutes(body),
		};
	},
	head: ({ loaderData }) => {
		const article = loaderData?.article;
		if (!article) return {};
		const SITE_URL = "https://fiirman.my.id";
		const url = `${SITE_URL}/articles/${article.slug}`;
		const meta = [
			{ title: `${article.title} — Firman Lestari` },
			{ name: "description", content: article.description },
			{ property: "og:type", content: "article" },
			{ property: "og:title", content: article.title },
			{ property: "og:description", content: article.description },
			{ property: "og:url", content: url },
		];
		if (article.thumbnail) {
			meta.push({
				property: "og:image",
				content: `${SITE_URL}${thumbnailUrl(article.thumbnail)}`,
			});
		}
		const links: Array<Record<string, string>> = [
			{ rel: "canonical", href: url },
		];
		if (article.thumbnail) {
			links.push({
				rel: "preload",
				as: "image",
				href: thumbnailUrl(article.thumbnail),
				imageSrcSet: thumbnailSrcSet(article.thumbnail),
				imageSizes: "(max-width: 768px) calc(100vw - 2rem), 720px",
				fetchPriority: "high",
			});
		}
		return { meta, links };
	},
	notFoundComponent: () => (
		<section className="py-20 text-center">
			<h1 className="font-serif-display text-3xl">Not found</h1>
			<p className="font-serif text-fg-muted mt-2">
				No article lives at that address.
			</p>
		</section>
	),
});

function ArticlePage() {
	const { article, minutes } = Route.useLoaderData();
	const tagLine = article.tag.join(" · ").toUpperCase();

	useEffect(() => {
		/* Defer to idle — analytics is fire-and-forget, never block hydration. */
		const path = window.location.pathname;
		const hasIdle =
			typeof (window as Window & { requestIdleCallback?: unknown })
				.requestIdleCallback === "function";
		const id = hasIdle
			? window.requestIdleCallback(() => trackAnalytic(path), { timeout: 2000 })
			: window.setTimeout(() => trackAnalytic(path), 200);
		return () => {
			if (hasIdle) window.cancelIdleCallback(id as number);
			else window.clearTimeout(id as number);
		};
	}, [article.slug]);

	return (
		<article className="py-8">
			<ArticleProgress />
			<BackToTop />
			<header className="text-center max-w-3xl mx-auto">
				{tagLine ? <Kicker>{tagLine}</Kicker> : null}
				<h1 className="font-serif-display leading-[1.05] mt-3 text-3xl md:text-4xl lg:text-5xl xl:text-headline">
					{article.title}
				</h1>
				<div className="mt-4 flex flex-col items-center gap-2">
					<Byline writer={article.writer} date={article.createdAt} />
					<span className="small-caps text-xs text-fg-muted">
						{minutes} MIN READ
					</span>
				</div>
			</header>

			<div className="mt-10 max-w-3xl mx-auto">
				<ArticleThumbnail src={article.thumbnail} alt={article.title} carved />
			</div>

			<RuleDouble className="my-10 max-w-prose mx-auto" />

			<ArticleBody sanitizedMarkup={article.body} />

			<RuleDouble className="my-12 max-w-prose mx-auto" />

			<section className="max-w-prose mx-auto text-center">
				{article.source === "github" ? (
					<>
						<h2 className="small-caps text-sm text-fg-muted mb-6">
							Reader Comments
						</h2>
						<Comments />
					</>
				) : (
					<>
						<h2 className="small-caps text-sm text-fg-muted mb-3">
							Originally on Medium
						</h2>
						{article.sourceUrl ? (
							<Button
								asChild
								variant="link"
								className="font-serif text-rubric border-b border-current hover:border-transparent rounded-none p-0 h-auto no-underline hover:no-underline transition-[border-color] duration-[120ms]"
							>
								<a
									href={article.sourceUrl}
									target="_blank"
									rel="noopener noreferrer"
								>
									Read on Medium and continue the discussion &rarr;
								</a>
							</Button>
						) : (
							<p className="font-serif text-fg-muted">
								Comments live on the original publication.
							</p>
						)}
					</>
				)}
			</section>
		</article>
	);
}
