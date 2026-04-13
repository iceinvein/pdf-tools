/**
 * Postbuild SEO prerender.
 *
 * For each route in ALL_ROUTES we emit dist/<slug>/index.html (or dist/index.html
 * for the home route) containing:
 *   - the route-specific <title>, <meta>, <link rel=canonical>
 *   - a static hero fragment (kicker + H1 + blurb + CTA) inside <div id="root">
 *
 * This gives each URL crawlable, keyword-rich HTML. On the client, React's
 * createRoot swaps the root contents with the interactive app. We render with
 * createRoot (not hydrateRoot) so there is no hydration mismatch to worry about.
 *
 * Also writes dist/sitemap.xml and dist/robots.txt.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import {
	ALL_ROUTES,
	BRAND,
	PRIVACY,
	SITE_URL,
	type Tool,
} from "../src/lib/tools";

const DIST = new URL("../dist/", import.meta.url).pathname;
const INDEX_TEMPLATE_PATH = join(DIST, "index.html");

function escapeHtml(s: string): string {
	return s
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

/** The hero fragment for a tool route. Mirrors DragAndDrop's landing layout. */
function toolHero(tool: Tool): string {
	const kicker = escapeHtml(tool.kicker);
	const h1 = escapeHtml(tool.h1);
	const blurb = escapeHtml(tool.blurb);
	return `<div class="fixed inset-0 flex flex-col bg-background text-foreground">
  <header class="flex items-center justify-between px-8 sm:px-12 pt-8 sm:pt-10">
    <span class="wordmark text-sm text-foreground/80 select-none">quire<span class="text-primary">·</span>pdf</span>
  </header>
  <main class="flex-1 flex flex-col justify-center px-8 sm:px-16 lg:px-24 max-w-[72ch]">
    <p class="text-xs tracking-[0.18em] uppercase text-muted-foreground mb-6">${kicker}</p>
    <h1 class="font-display font-semibold tracking-tight leading-[0.95] text-foreground" style="font-size:clamp(2.5rem,7vw,5.25rem)">${h1}</h1>
    <p class="mt-8 text-base sm:text-lg text-foreground/70 max-w-[48ch]">${blurb}</p>
  </main>
</div>`;
}

/** The content-heavy hero for the privacy article. */
function privacyHero(): string {
	const kicker = escapeHtml(PRIVACY.kicker);
	const h1 = escapeHtml(PRIVACY.h1);
	return `<article class="mx-auto max-w-[64ch] px-8 sm:px-12 py-16 prose">
  <p class="text-xs tracking-[0.18em] uppercase text-muted-foreground mb-6">${kicker}</p>
  <h1 class="font-display font-semibold tracking-tight text-4xl sm:text-5xl leading-tight text-foreground">${h1}</h1>
  <p class="mt-8 text-base sm:text-lg text-foreground/80">${BRAND} is a browser-based PDF tool. Every file you open is processed on your own machine, inside the tab you opened. Nothing is uploaded, logged, cached on a server, or transmitted to a third party.</p>
  <h2 class="mt-12 font-display font-medium text-2xl">How it works</h2>
  <p class="mt-4 text-foreground/80">When you drop a PDF, the browser reads it as bytes and hands them to two libraries that run in JavaScript: pdf.js (Mozilla's open source PDF renderer) draws each page onto a canvas, and pdf-lib (a pure-JavaScript PDF writer) applies your edits to the byte stream.</p>
  <h2 class="mt-12 font-display font-medium text-2xl">What we don't do</h2>
  <ul class="mt-4 list-disc pl-6 text-foreground/80 space-y-2">
    <li>No accounts, no login, no email collection.</li>
    <li>No upload endpoints. The site has no file ingest API.</li>
    <li>No analytics that track file contents or file names.</li>
    <li>No third-party trackers embedded in the tool.</li>
  </ul>
</article>`;
}

function heroFor(tool: Tool): string {
	return tool.slug === PRIVACY.slug ? privacyHero() : toolHero(tool);
}

/**
 * FAQPage JSON-LD block. Inlined per-route so AI summarizers
 * (Perplexity, ChatGPT, Google AI Overview) can cite Q/A pairs.
 * We JSON.stringify so embedded quotes are escaped correctly; no extra
 * HTML escaping needed because <script> is CDATA-ish, but we still guard
 * against a stray </script> sequence per WHATWG spec.
 */
function faqJsonLd(tool: Tool): string {
	if (tool.faqs.length === 0) return "";
	const schema = {
		"@context": "https://schema.org",
		"@type": "FAQPage",
		mainEntity: tool.faqs.map(({ q, a }) => ({
			"@type": "Question",
			name: q,
			acceptedAnswer: {
				"@type": "Answer",
				text: a,
			},
		})),
	};
	const json = JSON.stringify(schema).replace(/<\/(script)/gi, "<\\/$1");
	return `<script type="application/ld+json">${json}</script>`;
}

async function prerenderRoute(template: string, tool: Tool): Promise<void> {
	const canonical =
		tool.slug === "" ? SITE_URL : `${SITE_URL}/${tool.slug}`;
	const fullTitle = `${tool.title} | ${BRAND}`;

	// Replace the entire <title> and description block. The template's <head>
	// already has JSON-LD and favicon, which we keep.
	let html = template;

	// Swap title
	html = html.replace(
		/<title>[\s\S]*?<\/title>/,
		`<title>${escapeHtml(fullTitle)}</title>`,
	);

	// Swap default description
	html = html.replace(
		/<meta name="description"[^>]*>/,
		`<meta name="description" content="${escapeHtml(tool.description)}">`,
	);

	// Strip template defaults that vary per-route BEFORE injecting the replacements.
	// The og:image, og:image:*, twitter:card, and twitter:image tags are site-wide
	// constants, so we leave them in place.
	html = html.replace(/<meta property="og:title"[^>]*>\s*/, "");
	html = html.replace(/<meta property="og:description"[^>]*>\s*/, "");

	// Inject the rest of the route-specific meta just before </head>.
	const extraMeta = [
		`<link rel="canonical" href="${canonical}">`,
		`<meta property="og:title" content="${escapeHtml(fullTitle)}">`,
		`<meta property="og:description" content="${escapeHtml(tool.description)}">`,
		`<meta property="og:url" content="${canonical}">`,
		`<meta name="twitter:title" content="${escapeHtml(fullTitle)}">`,
		`<meta name="twitter:description" content="${escapeHtml(tool.description)}">`,
		faqJsonLd(tool),
	]
		.filter(Boolean)
		.join("\n    ");
	html = html.replace("</head>", `    ${extraMeta}\n  </head>`);

	// Inject the hero into the root div. Keep <div id="root"> so React mounts.
	html = html.replace(
		/<div id="root"><\/div>/,
		`<div id="root">${heroFor(tool)}</div>`,
	);

	const outPath =
		tool.slug === ""
			? join(DIST, "index.html")
			: join(DIST, tool.slug, "index.html");
	await mkdir(dirname(outPath), { recursive: true });
	await writeFile(outPath, html, "utf8");
	console.log(`  wrote ${outPath.replace(DIST, "dist/")}`);
}

async function writeSitemap(): Promise<void> {
	const now = new Date().toISOString().slice(0, 10);
	const urls = ALL_ROUTES.map((tool) => {
		const loc = tool.slug === "" ? SITE_URL : `${SITE_URL}/${tool.slug}`;
		return `  <url>
    <loc>${loc}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>${tool.priority.toFixed(1)}</priority>
  </url>`;
	}).join("\n");
	const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
	await writeFile(join(DIST, "sitemap.xml"), xml, "utf8");
	console.log("  wrote dist/sitemap.xml");
}

async function writeRobots(): Promise<void> {
	const txt = `User-agent: *
Allow: /

Sitemap: ${SITE_URL}/sitemap.xml
`;
	await writeFile(join(DIST, "robots.txt"), txt, "utf8");
	console.log("  wrote dist/robots.txt");
}

async function main(): Promise<void> {
	console.log("Prerendering routes...");
	const template = await readFile(INDEX_TEMPLATE_PATH, "utf8");
	for (const tool of ALL_ROUTES) {
		await prerenderRoute(template, tool);
	}
	await writeSitemap();
	await writeRobots();
	console.log("Done.");
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
