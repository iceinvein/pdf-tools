import { Loader2 } from "lucide-react";
import { lazy, Suspense, useState } from "react";
import DragAndDrop from "@/components/DragAndDrop";
import { BRAND, SITE_URL, type Tool } from "@/lib/tools";

/**
 * The viewer pulls in pdfjs-dist (~117 kB gzipped) and pdf-lib (~55 kB gzipped),
 * neither of which is needed until the user actually drops a file. Lazy-loading
 * keeps them out of the initial critical path, so LCP on tool landing pages is
 * just HTML + fonts + the tiny React shell. The chunk arrives while the user
 * is still selecting a file, so they rarely see the Suspense fallback.
 */
const PDFViewer = lazy(() => import("@/components/PDFViewer"));

type ToolRouteProps = {
	tool: Tool;
};

/**
 * Shared shell for every tool route. Drives:
 *   - per-route <title> / <meta> (React 19 hoists these into <head>)
 *   - tool-specific landing copy (H1, kicker, blurb)
 *   - handoff into the viewer once a file is picked
 *
 * The `intent` field on Tool is plumbed through for future auto-priming
 * (merge flow opens the file picker, etc.) but not yet consumed by the viewer.
 */
export default function ToolRoute({ tool }: ToolRouteProps) {
	const [selectedFile, setSelectedFile] = useState<File | null>(null);

	const canonical = `${SITE_URL}/${tool.slug}`.replace(/\/$/, "") || SITE_URL;
	const fullTitle = `${tool.title} | ${BRAND}`;

	return (
		<>
			<title>{fullTitle}</title>
			<meta name="description" content={tool.description} />
			<link rel="canonical" href={canonical} />
			<meta property="og:title" content={fullTitle} />
			<meta property="og:description" content={tool.description} />
			<meta property="og:type" content="website" />
			<meta property="og:url" content={canonical} />
			<meta name="twitter:card" content="summary" />
			<meta name="twitter:title" content={fullTitle} />
			<meta name="twitter:description" content={tool.description} />

			{!selectedFile ? (
				<DragAndDrop
					onFileSelect={setSelectedFile}
					kicker={tool.kicker}
					h1={tool.h1}
					blurb={tool.blurb}
				/>
			) : (
				<div className="h-dvh flex flex-col bg-paper-workspace overflow-hidden">
					<Suspense
						fallback={
							<div className="flex-1 flex items-center justify-center">
								<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
							</div>
						}
					>
						<PDFViewer
							file={selectedFile}
							onClose={() => setSelectedFile(null)}
						/>
					</Suspense>
				</div>
			)}
		</>
	);
}
