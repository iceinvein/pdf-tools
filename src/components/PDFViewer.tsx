import {
	AlertTriangle,
	ArrowLeftToLine,
	ArrowRightToLine,
	ChevronLeft,
	ChevronRight,
	Download,
	FileDown,
	FilePlus,
	Loader2,
	RotateCcw,
	Trash2,
	Undo2,
	X,
	ZoomIn,
	ZoomOut,
} from "lucide-react";
import { PDFDocument } from "pdf-lib";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import * as pdfjs from "pdfjs-dist";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ModeToggle } from "@/components/mode-toggle";
import { Button } from "@/components/ui/button";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

type PDFViewerProps = {
	file: File;
	onClose: () => void;
};

/** Snapshot saved on the undo stack before each mutation. */
type HistoryEntry = {
	bytes: Uint8Array;
	pageNum: number;
	label: string;
};

export default function PDFViewer({ file, onClose }: PDFViewerProps) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const renderTaskRef = useRef<RenderTask | null>(null);
	const pageInputRef = useRef<HTMLInputElement>(null);
	const thumbRailRef = useRef<HTMLElement>(null);

	const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
	const [pageNum, setPageNum] = useState(1);
	const [totalPages, setTotalPages] = useState(0);
	const [isModified, setIsModified] = useState(false);
	const [currentPdfBytes, setCurrentPdfBytes] = useState<Uint8Array | null>(
		null,
	);
	const [isLoading, setIsLoading] = useState(true);
	const [loadError, setLoadError] = useState<string | null>(null);
	const [mutating, setMutating] = useState<null | "delete" | "merge" | "move">(
		null,
	);
	const [confirmingDelete, setConfirmingDelete] = useState(false);
	const [confirmingClose, setConfirmingClose] = useState(false);
	const [editingPage, setEditingPage] = useState(false);
	const [scale, setScale] = useState(1.5);
	const [pendingMerge, setPendingMerge] = useState<{
		file: File;
		pageCount: number;
	} | null>(null);
	const [history, setHistory] = useState<HistoryEntry[]>([]);

	const confirmDeleteTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
		null,
	);
	const confirmCloseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
		null,
	);

	// --- PDF loading ---

	const loadPDF = useCallback(async (fileOrBytes: File | Uint8Array) => {
		setIsLoading(true);
		setLoadError(null);
		try {
			let bytes: Uint8Array;
			if (fileOrBytes instanceof File) {
				const arrayBuffer = await fileOrBytes.arrayBuffer();
				bytes = new Uint8Array(arrayBuffer);
			} else {
				bytes = fileOrBytes;
			}

			const bytesCopy = new Uint8Array(bytes);
			setCurrentPdfBytes(bytesCopy);

			const loadingTask = pdfjs.getDocument(bytes);
			const pdf = await loadingTask.promise;
			setPdfDoc(pdf);
			setTotalPages(pdf.numPages);
		} catch (error) {
			console.error("Error loading PDF:", error);
			setLoadError(
				"Could not load this PDF. The file may be corrupted or password-protected.",
			);
		} finally {
			setIsLoading(false);
		}
	}, []);

	const renderPage = useCallback(
		async (pdf: PDFDocumentProxy | null, pageNumber: number) => {
			if (!pdf) return;

			if (renderTaskRef.current) {
				renderTaskRef.current.cancel();
				renderTaskRef.current = null;
			}

			try {
				const page = await pdf.getPage(pageNumber);
				const canvas = canvasRef.current;
				if (!canvas) return;

				const context = canvas.getContext("2d");
				if (!context) return;

				const viewport = page.getViewport({ scale });
				canvas.height = viewport.height;
				canvas.width = viewport.width;

				renderTaskRef.current = page.render({
					canvasContext: context,
					viewport,
					canvas,
				});
				await renderTaskRef.current.promise;
				renderTaskRef.current = null;
			} catch (error) {
				if (
					(error as { name?: string })?.name === "RenderingCancelledException"
				)
					return;
				console.error("Error rendering page:", error);
				toast.error("Could not render this page.");
			}
		},
		[scale],
	);

	const zoomIn = useCallback(() => setScale((s) => Math.min(4, s + 0.25)), []);
	const zoomOut = useCallback(
		() => setScale((s) => Math.max(0.5, s - 0.25)),
		[],
	);

	useEffect(() => {
		if (pdfDoc && pageNum) renderPage(pdfDoc, pageNum);
	}, [pdfDoc, pageNum, renderPage]);

	// Auto-center the active chip horizontally in the rail. We compute scrollLeft
	// directly rather than calling scrollIntoView, which would walk up scrollable
	// ancestors and drag the page along for the ride.
	// biome-ignore lint/correctness/useExhaustiveDependencies: pageNum is the intended trigger
	useEffect(() => {
		const rail = thumbRailRef.current;
		if (!rail) return;
		const active = rail.querySelector<HTMLButtonElement>(
			'[aria-current="page"]',
		);
		if (!active) return;
		const target =
			active.offsetLeft + active.offsetWidth / 2 - rail.clientWidth / 2;
		rail.scrollTo({
			left: Math.max(0, target),
			behavior: "smooth",
		});
	}, [pageNum]);

	const changePage = useCallback(
		(delta: number) => {
			setPageNum((prev) => {
				const next = prev + delta;
				return next > 0 && next <= totalPages ? next : prev;
			});
		},
		[totalPages],
	);

	const gotoPage = (pageNumber: number) => setPageNum(pageNumber);

	// --- Undo stack ---

	const pushHistory = useCallback(
		(label: string) => {
			if (!currentPdfBytes) return;
			setHistory((h) => [
				...h,
				{ bytes: new Uint8Array(currentPdfBytes), pageNum, label },
			]);
		},
		[currentPdfBytes, pageNum],
	);

	const undo = useCallback(async () => {
		if (history.length === 0) return;
		const entry = history[history.length - 1];
		setHistory((h) => h.slice(0, -1));
		await loadPDF(entry.bytes);
		setPageNum(entry.pageNum);
		// Remain modified if we still have history or have prior edits; treat a full
		// unwind as "back to original".
		setIsModified(history.length > 1);
		toast.success(`Undid: ${entry.label}`);
	}, [history, loadPDF]);

	// --- Close with unsaved-changes guard ---

	const handleClose = () => {
		if (!isModified) {
			onClose();
			return;
		}
		setConfirmingClose(true);
		confirmCloseTimeoutRef.current = setTimeout(
			() => setConfirmingClose(false),
			10000,
		);
	};

	const confirmClose = () => {
		setConfirmingClose(false);
		if (confirmCloseTimeoutRef.current)
			clearTimeout(confirmCloseTimeoutRef.current);
		onClose();
	};

	const cancelClose = () => {
		setConfirmingClose(false);
		if (confirmCloseTimeoutRef.current)
			clearTimeout(confirmCloseTimeoutRef.current);
	};

	useEffect(() => {
		if (!isModified) return;
		const handler = (e: BeforeUnloadEvent) => {
			e.preventDefault();
		};
		window.addEventListener("beforeunload", handler);
		return () => window.removeEventListener("beforeunload", handler);
	}, [isModified]);

	// --- Delete with inline confirmation ---

	const requestDelete = () => {
		if (!pdfDoc || totalPages <= 1) return;
		setConfirmingDelete(true);
		confirmDeleteTimeoutRef.current = setTimeout(
			() => setConfirmingDelete(false),
			10000,
		);
	};

	const cancelDelete = () => {
		setConfirmingDelete(false);
		if (confirmDeleteTimeoutRef.current)
			clearTimeout(confirmDeleteTimeoutRef.current);
	};

	const confirmDelete = async () => {
		if (confirmDeleteTimeoutRef.current)
			clearTimeout(confirmDeleteTimeoutRef.current);
		if (!pdfDoc || totalPages <= 1 || !currentPdfBytes) return;

		setMutating("delete");
		try {
			pushHistory(`delete page ${pageNum}`);
			const pdfLibDoc = await PDFDocument.load(currentPdfBytes);
			const deletedPage = pageNum;
			pdfLibDoc.removePage(deletedPage - 1);
			const modifiedPdfBytes = await pdfLibDoc.save();
			setIsModified(true);

			const newPageNum = deletedPage > 1 ? deletedPage - 1 : 1;
			await loadPDF(modifiedPdfBytes);
			setPageNum(newPageNum);
			toast.success(`Page ${deletedPage} deleted.`);
		} catch (error) {
			console.error("Error deleting page:", error);
			toast.error("Could not delete this page.");
		} finally {
			setMutating(null);
			setConfirmingDelete(false);
		}
	};

	// --- Page number input ---

	const startEditingPage = () => {
		setEditingPage(true);
		requestAnimationFrame(() => {
			pageInputRef.current?.select();
		});
	};

	const commitPageEdit = (value: string) => {
		setEditingPage(false);
		const n = Number.parseInt(value, 10);
		if (!Number.isNaN(n) && n >= 1 && n <= totalPages) {
			setPageNum(n);
		}
	};

	// --- Extract ---

	const extractCurrentPage = async () => {
		if (!pdfDoc || !currentPdfBytes) return;

		try {
			const pdfLibDoc = await PDFDocument.load(currentPdfBytes);
			const newPdf = await PDFDocument.create();
			const [copiedPage] = await newPdf.copyPages(pdfLibDoc, [pageNum - 1]);
			newPdf.addPage(copiedPage);

			const pdfBytes = await newPdf.save();
			const blob = new Blob([new Uint8Array(pdfBytes)], {
				type: "application/pdf",
			});
			const url = URL.createObjectURL(blob);

			const link = document.createElement("a");
			link.href = url;
			link.download = `page_${pageNum}_${file.name}`;
			link.click();
			URL.revokeObjectURL(url);
			toast.success(`Page ${pageNum} extracted.`);
		} catch (error) {
			console.error("Error extracting page:", error);
			toast.error("Could not extract this page.");
		}
	};

	// --- Merge ---

	const handleMergePDF = async () => {
		const input = document.createElement("input");
		input.type = "file";
		input.accept = ".pdf";
		input.onchange = async (e) => {
			const mergeFile = (e.target as HTMLInputElement).files?.[0];
			if (!mergeFile) return;

			try {
				const mergeArrayBuffer = await mergeFile.arrayBuffer();
				const mergePdfDoc = await PDFDocument.load(mergeArrayBuffer);
				setPendingMerge({
					file: mergeFile,
					pageCount: mergePdfDoc.getPageCount(),
				});
			} catch (error) {
				console.error("Error reading merge file:", error);
				toast.error("Could not read this PDF.");
			}
		};
		input.click();
	};

	const confirmMerge = async () => {
		if (!pendingMerge || !currentPdfBytes) return;
		const { file: mergeFile, pageCount } = pendingMerge;

		setMutating("merge");
		try {
			pushHistory(`merge ${pageCount} pages from ${mergeFile.name}`);
			const pdfLibDoc = await PDFDocument.load(currentPdfBytes);
			const mergeArrayBuffer = await mergeFile.arrayBuffer();
			const mergePdfDoc = await PDFDocument.load(mergeArrayBuffer);

			const copiedPages = await pdfLibDoc.copyPages(
				mergePdfDoc,
				mergePdfDoc.getPageIndices(),
			);
			for (const page of copiedPages) {
				pdfLibDoc.addPage(page);
			}

			const mergedPdfBytes = await pdfLibDoc.save();
			setIsModified(true);
			await loadPDF(mergedPdfBytes);
			toast.success(
				`Merged ${mergePdfDoc.getPageCount()} pages from ${mergeFile.name}.`,
			);
		} catch (error) {
			console.error("Error merging PDFs:", error);
			toast.error("Could not merge these PDFs.");
		} finally {
			setMutating(null);
			setPendingMerge(null);
		}
	};

	const cancelMerge = () => setPendingMerge(null);

	// --- Reorder ---

	const movePage = useCallback(
		async (direction: -1 | 1) => {
			const targetIndex = pageNum - 1 + direction;
			if (!currentPdfBytes || targetIndex < 0 || targetIndex >= totalPages)
				return;

			setMutating("move");
			try {
				pushHistory(
					`move page ${pageNum} ${direction === -1 ? "earlier" : "later"}`,
				);
				const pdfLibDoc = await PDFDocument.load(currentPdfBytes);
				const pages = pdfLibDoc.getPages();

				const newPdf = await PDFDocument.create();
				const indices = Array.from({ length: pages.length }, (_, i) => i);
				[indices[pageNum - 1], indices[targetIndex]] = [
					indices[targetIndex],
					indices[pageNum - 1],
				];

				const copiedPages = await newPdf.copyPages(pdfLibDoc, indices);
				for (const page of copiedPages) {
					newPdf.addPage(page);
				}

				const modifiedPdfBytes = await newPdf.save();
				setIsModified(true);
				await loadPDF(modifiedPdfBytes);
				setPageNum(pageNum + direction);
				toast.success(`Page moved ${direction === -1 ? "earlier" : "later"}.`);
			} catch (error) {
				console.error("Error moving page:", error);
				toast.error("Could not move this page.");
			} finally {
				setMutating(null);
			}
		},
		[currentPdfBytes, pageNum, totalPages, pushHistory, loadPDF],
	);

	// --- Download / Reset ---

	const downloadPDF = useCallback(async () => {
		if (!currentPdfBytes) return;
		const blob = new Blob([new Uint8Array(currentPdfBytes)], {
			type: "application/pdf",
		});
		const url = URL.createObjectURL(blob);
		const link = document.createElement("a");
		link.href = url;
		link.download = file.name;
		link.click();
		URL.revokeObjectURL(url);
		toast.success("PDF downloaded.");
	}, [currentPdfBytes, file.name]);

	const resetPDF = useCallback(() => {
		setIsModified(false);
		setHistory([]);
		setConfirmingDelete(false);
		setConfirmingClose(false);
		loadPDF(file);
		setPageNum(1);
		toast.success("Restored original PDF.");
	}, [file, loadPDF]);

	// --- Load on mount ---

	useEffect(() => {
		loadPDF(file);
	}, [file, loadPDF]);

	// --- Keyboard shortcuts ---

	useEffect(() => {
		const handleKey = (e: KeyboardEvent) => {
			if (e.target instanceof HTMLInputElement) return;
			switch (e.key) {
				case "ArrowLeft":
					if ((e.metaKey || e.ctrlKey) && e.shiftKey) {
						e.preventDefault();
						movePage(-1);
					} else {
						changePage(-1);
					}
					break;
				case "ArrowRight":
					if ((e.metaKey || e.ctrlKey) && e.shiftKey) {
						e.preventDefault();
						movePage(1);
					} else {
						changePage(1);
					}
					break;
				case "Home":
					if (totalPages > 0) setPageNum(1);
					break;
				case "End":
					if (totalPages > 0) setPageNum(totalPages);
					break;
				case "=":
				case "+":
					if (e.metaKey || e.ctrlKey) {
						e.preventDefault();
						zoomIn();
					}
					break;
				case "-":
					if (e.metaKey || e.ctrlKey) {
						e.preventDefault();
						zoomOut();
					}
					break;
				case "s":
					if (e.metaKey || e.ctrlKey) {
						e.preventDefault();
						downloadPDF();
					}
					break;
				case "z":
					if (e.metaKey || e.ctrlKey) {
						e.preventDefault();
						undo();
					}
					break;
				case "Escape":
					if (confirmingDelete) {
						setConfirmingDelete(false);
						if (confirmDeleteTimeoutRef.current)
							clearTimeout(confirmDeleteTimeoutRef.current);
					}
					if (confirmingClose) {
						setConfirmingClose(false);
						if (confirmCloseTimeoutRef.current)
							clearTimeout(confirmCloseTimeoutRef.current);
					}
					if (pendingMerge) setPendingMerge(null);
					break;
			}
		};
		window.addEventListener("keydown", handleKey);
		return () => window.removeEventListener("keydown", handleKey);
	}, [
		changePage,
		movePage,
		zoomIn,
		zoomOut,
		downloadPDF,
		undo,
		totalPages,
		confirmingDelete,
		confirmingClose,
		pendingMerge,
	]);

	const zoomPercent = Math.round(scale * 100);
	const canUndo = history.length > 0;

	return (
		<div className="flex-1 min-h-0 flex flex-col w-full max-w-[88rem] mx-auto px-4 sm:px-6 pt-3 pb-4 gap-3">
			{/* Header strip: file identity + theme + close */}
			<header className="flex items-center gap-3 min-w-0">
				<span
					className="font-display font-medium text-base sm:text-lg truncate min-w-0 flex-1"
					title={file.name}
				>
					{file.name}
					{isModified && (
						<span
							className="text-primary ml-1 select-none"
							title="Unsaved changes"
							aria-hidden="true"
						>
							•
						</span>
					)}
					{isModified && <span className="sr-only">Unsaved changes</span>}
				</span>
				<ModeToggle />
				{!confirmingClose ? (
					<Button
						variant="ghost"
						size="sm"
						onClick={handleClose}
						title="Close file"
						aria-label="Close file"
					>
						<X className="h-4 w-4" />
					</Button>
				) : (
					<div
						className="flex items-center gap-1 px-2 h-8 rounded-md bg-destructive/10"
						role="alert"
					>
						<span className="text-destructive text-xs font-medium whitespace-nowrap">
							Unsaved changes
						</span>
						<Button
							variant="ghost"
							size="sm"
							onClick={downloadPDF}
							className="h-7 px-2 text-xs font-medium"
							title="Save changes before closing"
						>
							Save
						</Button>
						<Button
							variant="ghost"
							size="sm"
							onClick={confirmClose}
							className="h-7 px-2 text-xs text-destructive hover:bg-destructive/20"
							title="Discard changes and close"
						>
							Discard
						</Button>
						<Button
							variant="ghost"
							size="sm"
							onClick={cancelClose}
							className="h-7 px-2 text-xs text-muted-foreground hover:bg-muted"
							title="Cancel"
						>
							Cancel
						</Button>
					</div>
				)}
			</header>

			{/* Toolbar: two zones (nav left, actions right). Wraps on narrow screens. */}
			<div
				className="flex flex-wrap items-center gap-y-2 gap-x-1 px-1 py-1 border rounded-lg bg-card"
				role="toolbar"
				aria-label="PDF toolbar"
			>
				{/* Zone A — navigation */}
				<div className="flex items-center gap-0.5">
					<Button
						variant="ghost"
						size="sm"
						onClick={() => changePage(-1)}
						disabled={pageNum <= 1}
						title="Previous page (←)"
						aria-label="Previous page"
					>
						<ChevronLeft className="h-4 w-4" />
					</Button>

					{!editingPage ? (
						<button
							type="button"
							onClick={startEditingPage}
							className="h-8 text-sm tabular-nums text-muted-foreground min-w-[4.5rem] text-center hover:text-foreground hover:bg-muted rounded px-1 transition-colors cursor-text font-display"
							title="Click to jump to a page"
							aria-live="polite"
						>
							{pageNum} / {totalPages}
						</button>
					) : (
						<input
							ref={pageInputRef}
							type="number"
							min={1}
							max={totalPages}
							defaultValue={pageNum}
							aria-label="Jump to page"
							className="w-16 h-8 text-sm tabular-nums text-center bg-muted border border-input rounded px-1 font-display"
							onKeyDown={(e) => {
								if (e.key === "Enter") commitPageEdit(e.currentTarget.value);
								if (e.key === "Escape") setEditingPage(false);
							}}
							onBlur={(e) => commitPageEdit(e.currentTarget.value)}
						/>
					)}

					<Button
						variant="ghost"
						size="sm"
						onClick={() => changePage(1)}
						disabled={pageNum >= totalPages}
						title="Next page (→)"
						aria-label="Next page"
					>
						<ChevronRight className="h-4 w-4" />
					</Button>
				</div>

				<div className="w-px h-5 bg-border mx-1" />

				{/* Reorder — moves the current page within the document. Paired with the
				    page indicator because it operates on position, not document content. */}
				<div className="flex items-center gap-0.5">
					<Button
						variant="ghost"
						size="sm"
						onClick={() => movePage(-1)}
						disabled={totalPages <= 1 || pageNum <= 1 || mutating !== null}
						title="Move this page earlier (⌘⇧←)"
						aria-label="Move current page earlier"
					>
						<ArrowLeftToLine className="h-4 w-4" />
					</Button>
					<Button
						variant="ghost"
						size="sm"
						onClick={() => movePage(1)}
						disabled={
							totalPages <= 1 || pageNum >= totalPages || mutating !== null
						}
						title="Move this page later (⌘⇧→)"
						aria-label="Move current page later"
					>
						<ArrowRightToLine className="h-4 w-4" />
					</Button>
				</div>

				<div className="w-px h-5 bg-border mx-1" />

				<div className="flex items-center gap-0.5">
					<Button
						variant="ghost"
						size="sm"
						onClick={zoomOut}
						title="Zoom out (⌘−)"
						aria-label="Zoom out"
					>
						<ZoomOut className="h-4 w-4" />
					</Button>
					<span className="text-xs tabular-nums text-muted-foreground min-w-[3.5ch] text-center font-display">
						{zoomPercent}%
					</span>
					<Button
						variant="ghost"
						size="sm"
						onClick={zoomIn}
						title="Zoom in (⌘+)"
						aria-label="Zoom in"
					>
						<ZoomIn className="h-4 w-4" />
					</Button>
				</div>

				{/* Spacer pushes actions to the right on wide screens, wraps on narrow */}
				<div className="flex-1 min-w-0" />

				{/* Zone B — actions */}
				<div className="flex items-center gap-0.5">
					<Button
						variant="ghost"
						size="sm"
						onClick={handleMergePDF}
						title="Merge another PDF into this one"
						aria-label="Merge PDF"
					>
						<FilePlus className="h-4 w-4" />
						<span className="hidden md:inline">Merge</span>
					</Button>
					<Button
						variant="ghost"
						size="sm"
						onClick={extractCurrentPage}
						disabled={!pdfDoc}
						title="Extract current page to a new PDF"
						aria-label="Extract current page"
					>
						<FileDown className="h-4 w-4" />
						<span className="hidden md:inline">Extract</span>
					</Button>

					{!confirmingDelete ? (
						<Button
							variant="ghost"
							size="sm"
							onClick={requestDelete}
							disabled={totalPages <= 1}
							title="Delete current page"
							aria-label="Delete current page"
							className="text-destructive hover:text-destructive hover:bg-destructive/10"
						>
							<Trash2 className="h-4 w-4" />
							<span className="hidden md:inline">Delete</span>
						</Button>
					) : (
						<div
							className="flex items-center gap-1 px-2 h-8 rounded-md bg-destructive/10"
							role="alert"
						>
							<span className="text-destructive text-xs font-medium whitespace-nowrap">
								Delete page {pageNum}?
							</span>
							<Button
								variant="ghost"
								size="sm"
								onClick={confirmDelete}
								disabled={mutating === "delete"}
								className="h-7 px-2 text-xs font-medium text-destructive hover:bg-destructive/20"
								title="Confirm delete"
							>
								{mutating === "delete" ? (
									<Loader2 className="h-3 w-3 animate-spin" />
								) : (
									"Delete"
								)}
							</Button>
							<Button
								variant="ghost"
								size="sm"
								onClick={cancelDelete}
								disabled={mutating === "delete"}
								className="h-7 px-2 text-xs text-muted-foreground hover:bg-muted"
								title="Cancel"
							>
								Cancel
							</Button>
						</div>
					)}

					<Button
						variant="ghost"
						size="sm"
						onClick={undo}
						disabled={!canUndo}
						title={
							canUndo
								? `Undo (⌘Z) — ${history[history.length - 1].label}`
								: "Nothing to undo"
						}
						aria-label="Undo"
					>
						<Undo2 className="h-4 w-4" />
					</Button>

					<Button
						variant={isModified ? "default" : "ghost"}
						size="sm"
						onClick={downloadPDF}
						title="Download PDF (⌘S)"
						aria-label="Download PDF"
					>
						<Download className="h-4 w-4" />
						<span className="hidden md:inline">Save</span>
					</Button>

					{isModified && (
						<Button
							variant="ghost"
							size="sm"
							onClick={resetPDF}
							title="Revert to original file"
							aria-label="Reset to original"
						>
							<RotateCcw className="h-4 w-4" />
						</Button>
					)}
				</div>

				{/* Merge confirmation — stretches across the toolbar when active */}
				{pendingMerge && (
					<div
						className="flex items-center gap-1 px-2 h-8 rounded-md bg-primary/5 w-full"
						role="alert"
					>
						<span className="text-xs font-medium whitespace-nowrap flex-1 truncate">
							Merge {pendingMerge.pageCount} pages from{" "}
							<span className="text-foreground">{pendingMerge.file.name}</span>?
						</span>
						<Button
							variant="ghost"
							size="sm"
							onClick={confirmMerge}
							disabled={mutating === "merge"}
							className="h-7 px-2 text-xs font-medium"
							title="Confirm merge"
						>
							{mutating === "merge" ? (
								<Loader2 className="h-3 w-3 animate-spin" />
							) : (
								"Merge"
							)}
						</Button>
						<Button
							variant="ghost"
							size="sm"
							onClick={cancelMerge}
							disabled={mutating === "merge"}
							className="h-7 px-2 text-xs text-muted-foreground hover:bg-muted"
							title="Cancel"
						>
							Cancel
						</Button>
					</div>
				)}
			</div>

			{/* Canvas workspace — paper on desk */}
			<div className="relative flex-1 min-h-0 overflow-auto rounded-lg bg-paper-workspace">
				{isLoading && !loadError && (
					<div className="absolute inset-0 flex flex-col items-center justify-center bg-background/60 z-10 gap-3 backdrop-blur-sm">
						<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
						<p className="text-sm text-muted-foreground font-display">
							Loading {file.name}
						</p>
					</div>
				)}

				{loadError && (
					<div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-6 text-center">
						<AlertTriangle className="h-8 w-8 text-destructive" />
						<div>
							<p className="font-display text-base font-medium">
								This file couldn't be opened.
							</p>
							<p className="text-sm text-muted-foreground mt-1 max-w-sm">
								{loadError}
							</p>
						</div>
						<div className="flex gap-2">
							<Button variant="outline" size="sm" onClick={() => loadPDF(file)}>
								Try again
							</Button>
							<Button variant="ghost" size="sm" onClick={onClose}>
								Choose another file
							</Button>
						</div>
					</div>
				)}

				<div className="min-w-fit min-h-fit flex items-center justify-center p-6 sm:p-10">
					<canvas
						ref={canvasRef}
						className="paper-shadow bg-paper rounded-[2px]"
					/>
				</div>
			</div>

			{/* Page rail — always shown for multi-page docs, virtualized by native scroll */}
			{totalPages > 1 && (
				<nav
					ref={thumbRailRef}
					className="flex items-center gap-1 overflow-x-auto px-1 pb-1 scrollbar-thin"
					aria-label="Page navigation"
				>
					{Array.from({ length: totalPages }, (_, i) => {
						const n = i + 1;
						const active = pageNum === n;
						return (
							<button
								type="button"
								key={`page-${n}`}
								onClick={() => gotoPage(n)}
								className={`h-8 min-w-9 shrink-0 rounded-md text-xs tabular-nums font-display transition-colors ${
									active
										? "bg-primary text-primary-foreground"
										: "text-muted-foreground hover:bg-muted hover:text-foreground"
								}`}
								aria-label={`Go to page ${n}`}
								aria-current={active ? "page" : undefined}
							>
								{n}
							</button>
						);
					})}
				</nav>
			)}
		</div>
	);
}
