/**
 * Single source of truth for SEO-visible routes.
 *
 * Consumed by:
 *   - src/App.tsx       → router
 *   - src/routes/Tool.tsx → per-tool page shell
 *   - scripts/prerender.ts → static HTML + sitemap emission
 *
 * Adding a tool: append here, ensure the "intent" is handled in DragAndDrop/PDFViewer.
 */

export type ToolIntent = "view" | "merge" | "extract" | "delete" | "reorder";

export type FAQ = {
	q: string;
	a: string;
};

export type Tool = {
	/** URL path, no leading "/". Also used as the dist/<slug>/index.html folder. */
	slug: string;
	/** Window title template piece. Final title: `${title} | Quire`. */
	title: string;
	/** Meta description, under 160 chars, answers "what does this page do". */
	description: string;
	/** H1 copy on the landing. Short, keyword-forward. */
	h1: string;
	/** Kicker line above H1 (small-caps, tracking). Tool-specific framing. */
	kicker: string;
	/** Sub-copy below H1. Two sentences max. */
	blurb: string;
	/** Which action to prime when a file is loaded. */
	intent: ToolIntent;
	/** Sitemap priority, 0.1 – 1.0. */
	priority: number;
	/** Questions emitted as FAQPage JSON-LD. AI summarizers cite these verbatim. */
	faqs: FAQ[];
};

/** Site-wide questions every tool route inherits. Keep short and concrete. */
const SHARED_FAQS: FAQ[] = [
	{
		q: "Are my files uploaded to a server?",
		a: "No. Quire processes every PDF in your browser using pdf.js and pdf-lib. The site has no file ingest API, no analytics that read file contents, and no third-party trackers.",
	},
	{
		q: "Do I need an account?",
		a: "No. There is no sign-up, no login, and no email collection. Open the site and drop a file.",
	},
	{
		q: "Is there a file size limit?",
		a: "Quire does not impose one. The practical limit is your device's memory, because the whole PDF is held in RAM while you edit it. Hundreds of pages is routine on modern hardware.",
	},
	{
		q: "Does it work offline?",
		a: "Yes, after the first visit. Quire is a static site, so once your browser has cached the JavaScript bundle, later visits work with no network.",
	},
];

export const BRAND = "Quire";
export const SITE_URL = "https://quire-pdf.netlify.app";

/** Home route (slug "") plus tool routes. Order = sitemap order. */
export const TOOLS: Tool[] = [
	{
		slug: "",
		title: "Free PDF Tools, Private, Browser-Based",
		description:
			"Merge, split, extract, and reorder PDF pages in your browser. No uploads, no accounts, no limits. Your files never leave your device.",
		h1: "Open a PDF. Do the thing.",
		kicker: "Local · Browser · No upload",
		blurb:
			"Drop a file anywhere on this surface, or choose one from your drive. Everything stays on your machine.",
		intent: "view",
		priority: 1.0,
		faqs: [
			{
				q: "What can Quire do with a PDF?",
				a: "Quire can merge multiple PDFs, extract any single page as its own file, delete pages you no longer need, reorder pages, and view PDFs with keyboard navigation. All edits are reversible with undo, and nothing is saved until you download.",
			},
			...SHARED_FAQS,
		],
	},
	{
		slug: "merge-pdf",
		title: "Merge PDF Files, Free and Private",
		description:
			"Combine PDFs in your browser. No uploads, no watermarks, no file size limits. Drop two files, get one merged PDF back.",
		h1: "Merge PDFs without uploading them.",
		kicker: "Merge · Local · Unlimited",
		blurb:
			"Open your first PDF, then add more. Everything happens in your browser: no server, no account, no trace.",
		intent: "merge",
		priority: 0.9,
		faqs: [
			{
				q: "How do I merge two PDF files into one?",
				a: "Open the first PDF by dropping it onto Quire or pressing Cmd+O. Then click the Merge button in the toolbar and pick the second file. Quire appends the second file's pages to the end and you download the combined PDF.",
			},
			{
				q: "How many PDFs can I merge at once?",
				a: "There is no hard limit. You can add PDFs one at a time using the Merge button, and each append is a separate undoable step, so you can review the result after each merge.",
			},
			{
				q: "Will merging add a watermark?",
				a: "No. Quire never adds watermarks, banners, or metadata to your output. The merged PDF contains only the pages from your inputs.",
			},
			...SHARED_FAQS,
		],
	},
	{
		slug: "extract-pdf-pages",
		title: "Extract PDF Pages, Free and Private",
		description:
			"Pull any page out of a PDF as its own file. Runs entirely in your browser, no upload, no watermark, no size cap.",
		h1: "Extract pages from a PDF.",
		kicker: "Extract · Local · Unlimited",
		blurb:
			"Open a PDF, pick a page, save it as a new file. Nothing touches a server.",
		intent: "extract",
		priority: 0.8,
		faqs: [
			{
				q: "How do I extract a single page from a PDF?",
				a: "Open the PDF, navigate to the page you want with the arrow keys or page rail, then click Extract in the toolbar. Quire creates a new single-page PDF and downloads it immediately.",
			},
			{
				q: "Does extracting a page modify the original file?",
				a: "No. Your original file on disk is untouched. Quire reads it into memory, creates a new document containing only the page you picked, and offers that new document as a download.",
			},
			{
				q: "Can I extract a range of pages?",
				a: "The current release extracts one page at a time. To split out a range, extract each page and merge them afterward, or use the Delete action in reverse by deleting everything you do not want and saving the remainder.",
			},
			...SHARED_FAQS,
		],
	},
	{
		slug: "delete-pdf-pages",
		title: "Delete Pages from a PDF, Free and Private",
		description:
			"Remove pages from a PDF without uploading it. Works in your browser with no watermark, no account, no file size limit.",
		h1: "Delete pages from a PDF.",
		kicker: "Delete · Local · Unlimited",
		blurb:
			"Open a PDF, scrub the pages you don't need, save the rest. Your file never leaves the tab.",
		intent: "delete",
		priority: 0.7,
		faqs: [
			{
				q: "How do I delete a page from a PDF?",
				a: "Open the PDF, navigate to the page you want to remove, and click the Delete action. Quire asks for confirmation, removes the page, and updates the document. Press Cmd+Z to undo if you change your mind.",
			},
			{
				q: "Can I delete multiple pages at once?",
				a: "Delete is single-page in the current release, but every delete is reversible with undo, and you can delete consecutively without re-opening the file.",
			},
			{
				q: "Is the deleted page recoverable?",
				a: "Use Cmd+Z to undo the last delete, or click Reset to revert the whole document back to the original. Once you download and overwrite the original file on disk, the deletion is permanent.",
			},
			...SHARED_FAQS,
		],
	},
	{
		slug: "reorder-pdf-pages",
		title: "Reorder PDF Pages, Free and Private",
		description:
			"Rearrange the order of pages in a PDF in your browser. No uploads, no watermark, no signup.",
		h1: "Reorder pages in a PDF.",
		kicker: "Reorder · Local · Unlimited",
		blurb:
			"Open a PDF, shuffle the pages, save the result. Everything runs on your machine.",
		intent: "reorder",
		priority: 0.6,
		faqs: [
			{
				q: "How do I move a page earlier or later in a PDF?",
				a: "Navigate to the page you want to move, then use the move-earlier or move-later buttons in the toolbar. Keyboard shortcuts are Cmd+Shift+Left and Cmd+Shift+Right. Each move is an undoable step.",
			},
			{
				q: "Can I drag pages to reorder them?",
				a: "Not yet. The current release moves pages one position at a time via buttons or keyboard. Drag-and-drop reordering in the page rail is on the roadmap.",
			},
			{
				q: "Will reordering pages damage the content?",
				a: "No. Quire uses pdf-lib to rewrite only the page index; the underlying page objects, text, images, and annotations are preserved byte-for-byte.",
			},
			...SHARED_FAQS,
		],
	},
];

export const PRIVACY: Tool = {
	slug: "privacy",
	title: "Privacy, Why Quire Never Uploads Your Files",
	description:
		"Quire processes PDFs entirely in your browser using pdf.js and pdf-lib. Files never hit a server. No accounts, no tracking, no retention.",
	h1: "Your files never leave your device.",
	kicker: "Privacy",
	blurb:
		"A short explanation of how in-browser PDF processing works, and what that means for your data.",
	intent: "view",
	priority: 0.5,
	faqs: SHARED_FAQS,
};

export const ALL_ROUTES: Tool[] = [...TOOLS, PRIVACY];

export function findToolBySlug(slug: string): Tool | undefined {
	const normalized = slug.replace(/^\/+|\/+$/g, "");
	return ALL_ROUTES.find((t) => t.slug === normalized);
}
