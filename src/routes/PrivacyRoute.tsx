import { Link } from "react-router-dom";
import { BRAND, PRIVACY, SITE_URL } from "@/lib/tools";

/**
 * Content-heavy route. Crawlable body copy explaining why files never upload.
 * Doubles as a trust signal that ranks for queries like "pdf tool privacy"
 * and gets cited by AI summarizers because it makes concrete technical claims.
 */
export default function PrivacyRoute() {
	const canonical = `${SITE_URL}/${PRIVACY.slug}`;
	const fullTitle = `${PRIVACY.title} | ${BRAND}`;

	return (
		<>
			<title>{fullTitle}</title>
			<meta name="description" content={PRIVACY.description} />
			<link rel="canonical" href={canonical} />
			<meta property="og:title" content={fullTitle} />
			<meta property="og:description" content={PRIVACY.description} />
			<meta property="og:type" content="article" />
			<meta property="og:url" content={canonical} />

			<article className="mx-auto max-w-[64ch] px-8 sm:px-12 py-16 prose">
				<p className="text-xs tracking-[0.18em] uppercase text-muted-foreground mb-6">
					{PRIVACY.kicker}
				</p>
				<h1 className="font-display font-semibold tracking-tight text-4xl sm:text-5xl leading-tight text-foreground">
					{PRIVACY.h1}
				</h1>

				<p className="mt-8 text-base sm:text-lg text-foreground/80">
					{BRAND} is a browser-based PDF tool. Every file you open is processed
					on your own machine, inside the tab you opened. Nothing is uploaded,
					logged, cached on a server, or transmitted to a third party.
				</p>

				<h2 className="mt-12 font-display font-medium text-2xl">
					How it works
				</h2>
				<p className="mt-4 text-foreground/80">
					When you drop a PDF, the browser reads it as bytes and hands them to
					two libraries that run in JavaScript:
				</p>
				<ul className="mt-4 list-disc pl-6 text-foreground/80 space-y-2">
					<li>
						<strong className="font-medium">pdf.js</strong>, Mozilla's open
						source PDF renderer, draws each page onto a canvas element.
					</li>
					<li>
						<strong className="font-medium">pdf-lib</strong>, a pure-JavaScript
						PDF writer, applies your edits (delete, reorder, extract, merge) to
						the byte stream.
					</li>
				</ul>
				<p className="mt-4 text-foreground/80">
					When you hit save, the edited bytes become a Blob and the browser
					triggers a local download. The file never crosses the network.
				</p>

				<h2 className="mt-12 font-display font-medium text-2xl">
					What we don't do
				</h2>
				<ul className="mt-4 list-disc pl-6 text-foreground/80 space-y-2">
					<li>No accounts, no login, no email collection.</li>
					<li>No upload endpoints. The site has no file ingest API.</li>
					<li>No analytics that track file contents or file names.</li>
					<li>No third-party trackers embedded in the tool.</li>
				</ul>

				<h2 className="mt-12 font-display font-medium text-2xl">
					Verifying this yourself
				</h2>
				<p className="mt-4 text-foreground/80">
					Open your browser's network tab, drop a PDF, and run any operation.
					You will see no outbound requests carrying file data. The only network
					activity after initial page load is for static assets already cached
					by the browser.
				</p>

				<p className="mt-12 text-sm text-muted-foreground">
					<Link className="underline underline-offset-4" to="/">
						Back to {BRAND}
					</Link>
				</p>
			</article>
		</>
	);
}
