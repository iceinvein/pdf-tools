import {
	type ChangeEvent,
	type DragEvent,
	useEffect,
	useRef,
	useState,
} from "react";
import { toast } from "sonner";
import { ModeToggle } from "@/components/mode-toggle";
import { Button } from "@/components/ui/button";

type DragAndDropProps = {
	onFileSelect: (file: File) => void;
};

export default function DragAndDrop({ onFileSelect }: DragAndDropProps) {
	const [isDragging, setIsDragging] = useState(false);
	const inputRef = useRef<HTMLInputElement>(null);

	const handleFile = (file: File) => {
		if (file.type === "application/pdf") {
			onFileSelect(file);
		} else {
			toast.error("Only PDF files are supported.");
		}
	};

	const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
		event.preventDefault();
		setIsDragging(true);
	};

	const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
		event.preventDefault();
		// Only clear when leaving the root — dragleave fires on child bounds too.
		if (event.currentTarget.contains(event.relatedTarget as Node)) return;
		setIsDragging(false);
	};

	const handleDrop = (event: DragEvent<HTMLDivElement>) => {
		event.preventDefault();
		setIsDragging(false);
		const file = event.dataTransfer.files[0];
		if (file) handleFile(file);
	};

	const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0];
		if (file) handleFile(file);
	};

	// ⌘O / Ctrl+O opens the file picker. Consistent with a workshop-tool muscle memory.
	useEffect(() => {
		const handler = (e: KeyboardEvent) => {
			if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "o") {
				e.preventDefault();
				inputRef.current?.click();
			}
		};
		window.addEventListener("keydown", handler);
		return () => window.removeEventListener("keydown", handler);
	}, []);

	const modKey =
		typeof navigator !== "undefined" &&
		/Mac|iPhone|iPad/i.test(navigator.userAgent)
			? "⌘"
			: "Ctrl";

	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: whole-viewport drop region
		<div
			className={`fixed inset-0 flex flex-col bg-background text-foreground transition-colors ${
				isDragging ? "dropping" : ""
			}`}
			onDragOver={handleDragOver}
			onDragLeave={handleDragLeave}
			onDrop={handleDrop}
		>
			{/* Decorative ruler ticks — workshop-tool signal, not a drop zone */}
			<div
				aria-hidden="true"
				className="rule-ticks-h absolute top-8 left-12 right-12 h-1.5 pointer-events-none"
			/>
			<div
				aria-hidden="true"
				className="rule-ticks-v absolute top-12 bottom-12 left-8 w-1.5 pointer-events-none"
			/>

			{/* Top strip: wordmark + theme toggle */}
			<header className="flex items-center justify-between px-8 sm:px-12 pt-8 sm:pt-10">
				<span className="wordmark text-sm text-foreground/80 select-none">
					pdf<span className="text-primary">·</span>tools
				</span>
				<ModeToggle />
			</header>

			{/* Hero — left-aligned, confident typography, generous whitespace */}
			<main className="flex-1 flex flex-col justify-center px-8 sm:px-16 lg:px-24 max-w-[72ch]">
				<p className="text-xs tracking-[0.18em] uppercase text-muted-foreground mb-6">
					Local · Browser · No upload
				</p>
				<h1
					className="font-display font-semibold tracking-tight leading-[0.95] text-foreground"
					style={{ fontSize: "clamp(2.5rem, 7vw, 5.25rem)" }}
				>
					Open a&nbsp;PDF.
					<br />
					<span className="text-muted-foreground">Do the thing.</span>
				</h1>
				<p className="mt-8 text-base sm:text-lg text-foreground/70 max-w-[48ch]">
					Drop a file anywhere on this surface, or choose one from your drive.
					Everything stays on your machine.
				</p>

				<div className="mt-10 flex flex-wrap items-center gap-4">
					<Button
						variant="default"
						size="lg"
						onClick={() => inputRef.current?.click()}
					>
						Choose a file
					</Button>
					<span className="text-sm text-muted-foreground">
						or press{" "}
						<kbd className="px-1.5 py-0.5 rounded border border-border bg-card font-display text-xs tabular-nums">
							{modKey} O
						</kbd>
					</span>
				</div>

				<input
					ref={inputRef}
					type="file"
					accept=".pdf"
					className="hidden"
					onChange={handleFileChange}
				/>
			</main>

			{/* Bottom-left tool plate — confident keyboard map */}
			<footer className="px-8 sm:px-12 pb-8 sm:pb-10 flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted-foreground/90">
				<span>
					<kbd className="font-display">← →</kbd> navigate pages
				</span>
				<span>
					<kbd className="font-display">{modKey} ⇧ ←/→</kbd> reorder page
				</span>
				<span>
					<kbd className="font-display">{modKey} S</kbd> save
				</span>
				<span>
					<kbd className="font-display">{modKey} Z</kbd> undo
				</span>
				<span>
					<kbd className="font-display">Esc</kbd> cancel
				</span>
			</footer>

			{/* Drop overlay headline during drag */}
			{isDragging && (
				<div
					aria-live="polite"
					className="pointer-events-none absolute inset-0 flex items-center justify-center"
				>
					<div className="px-6 py-3 rounded-md bg-primary text-primary-foreground font-display font-medium shadow-lg">
						Release to open
					</div>
				</div>
			)}
		</div>
	);
}
