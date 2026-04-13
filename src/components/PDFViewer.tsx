import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
	ChevronLeft,
	ChevronRight,
	Download,
	EllipsisVertical,
	FileDown,
	FilePlus,
	Loader2,
	RotateCcw,
	Trash2,
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

export default function PDFViewer({ file, onClose }: PDFViewerProps) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const renderTaskRef = useRef<RenderTask | null>(null);
	const pageInputRef = useRef<HTMLInputElement>(null);

	const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
	const [pageNum, setPageNum] = useState(1);
	const [totalPages, setTotalPages] = useState(0);
	const [isModified, setIsModified] = useState(false);
	const [currentPdfBytes, setCurrentPdfBytes] = useState<Uint8Array | null>(
		null,
	);
	const [isLoading, setIsLoading] = useState(true);
	const [confirmingDelete, setConfirmingDelete] = useState(false);
	const [confirmingClose, setConfirmingClose] = useState(false);
	const [editingPage, setEditingPage] = useState(false);
	const [scale, setScale] = useState(1.5);
	const [pendingMerge, setPendingMerge] = useState<{
		file: File;
		pageCount: number;
	} | null>(null);

	const confirmDeleteTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
		null,
	);
	const confirmCloseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
		null,
	);

	// --- PDF loading ---

	const loadPDF = useCallback(async (fileOrBytes: File | Uint8Array) => {
		setIsLoading(true);
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
			toast.error(
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
		setConfirmingDelete(false);
		if (confirmDeleteTimeoutRef.current)
			clearTimeout(confirmDeleteTimeoutRef.current);
		if (!pdfDoc || totalPages <= 1 || !currentPdfBytes) return;

		try {
			const pdfLibDoc = await PDFDocument.load(currentPdfBytes);
			pdfLibDoc.removePage(pageNum - 1);
			const modifiedPdfBytes = await pdfLibDoc.save();
			setIsModified(true);

			const newPageNum = pageNum > 1 ? pageNum - 1 : 1;
			await loadPDF(modifiedPdfBytes);
			setPageNum(newPageNum);
			toast.success(`Page ${pageNum} deleted.`);
		} catch (error) {
			console.error("Error deleting page:", error);
			toast.error("Could not delete this page.");
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
		const { file: mergeFile } = pendingMerge;
		setPendingMerge(null);

		try {
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
		}
	};

	const cancelMerge = () => setPendingMerge(null);

	// --- Reorder ---

	const movePage = async (direction: -1 | 1) => {
		const targetIndex = pageNum - 1 + direction;
		if (!currentPdfBytes || targetIndex < 0 || targetIndex >= totalPages)
			return;

		try {
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
		}
	};

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
					changePage(-1);
					break;
				case "ArrowRight":
					changePage(1);
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
		zoomIn,
		zoomOut,
		downloadPDF,
		confirmingDelete,
		confirmingClose,
		pendingMerge,
	]);

	const zoomPercent = Math.round(scale * 100);

	return (
		<div className="flex flex-col items-center w-full max-w-5xl gap-3">
			{/* Toolbar */}
			<div
				className="w-full flex items-center gap-1.5 p-2 border rounded-lg bg-card overflow-x-auto"
				role="toolbar"
				aria-label="PDF toolbar"
			>
				{/* File info + close */}
				<div className="flex items-center gap-2 mr-auto min-w-0">
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
							className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-destructive/10"
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
					{!confirmingClose && (
						<span className="text-sm font-medium truncate" title={file.name}>
							{file.name}
							{isModified && (
								<span className="text-muted-foreground ml-0.5">*</span>
							)}
						</span>
					)}
				</div>

				{/* Zoom — hidden on small screens */}
				<div className="hidden sm:flex items-center gap-1">
					<Button
						variant="ghost"
						size="sm"
						onClick={zoomOut}
						title="Zoom out"
						aria-label="Zoom out"
					>
						<ZoomOut className="h-4 w-4" />
					</Button>
					<span className="text-xs tabular-nums text-muted-foreground min-w-[3.5ch] text-center">
						{zoomPercent}%
					</span>
					<Button
						variant="ghost"
						size="sm"
						onClick={zoomIn}
						title="Zoom in"
						aria-label="Zoom in"
					>
						<ZoomIn className="h-4 w-4" />
					</Button>
				</div>

				{/* Separator — hidden on small screens with zoom */}
				<div className="hidden sm:block w-px h-5 bg-border mx-0.5" />

				{/* Page nav */}
				<div className="flex items-center gap-1">
					<Button
						variant="ghost"
						size="sm"
						onClick={() => changePage(-1)}
						disabled={pageNum <= 1}
						title="Previous page"
						aria-label="Previous page"
					>
						<ChevronLeft className="h-4 w-4" />
					</Button>

					{!editingPage ? (
						<button
							type="button"
							onClick={startEditingPage}
							className="text-sm tabular-nums text-muted-foreground min-w-16 text-center hover:text-foreground hover:bg-muted rounded px-1 py-0.5 transition-colors cursor-text"
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
							className="w-14 text-sm tabular-nums text-center bg-muted border border-input rounded px-1 py-0.5 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
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
						title="Next page"
						aria-label="Next page"
					>
						<ChevronRight className="h-4 w-4" />
					</Button>
				</div>

				{/* Separator */}
				<div className="w-px h-5 bg-border mx-0.5" />

				{/* Delete — always visible */}
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
						<span className="hidden sm:inline">Delete</span>
					</Button>
				) : (
					<div
						className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-destructive/10"
						role="alert"
					>
						<span className="text-destructive text-xs font-medium whitespace-nowrap">
							Delete page {pageNum}?
						</span>
						<Button
							variant="ghost"
							size="sm"
							onClick={confirmDelete}
							className="h-7 px-2 text-xs font-medium text-destructive hover:bg-destructive/20"
							title="Confirm delete"
						>
							Delete
						</Button>
						<Button
							variant="ghost"
							size="sm"
							onClick={cancelDelete}
							className="h-7 px-2 text-xs text-muted-foreground hover:bg-muted"
							title="Cancel"
						>
							Cancel
						</Button>
					</div>
				)}

				{/* Save — always visible, promoted when modified */}
				<Button
					variant={isModified ? "default" : "ghost"}
					size="sm"
					onClick={downloadPDF}
					title="Download PDF (Cmd+S)"
					aria-label="Download PDF"
				>
					<Download className="h-4 w-4" />
					<span className="hidden sm:inline">Save</span>
				</Button>

				{/* Reset — visible in toolbar when modified */}
				{isModified && (
					<Button
						variant="ghost"
						size="sm"
						onClick={resetPDF}
						title="Undo all changes"
						aria-label="Reset to original"
					>
						<RotateCcw className="h-4 w-4" />
					</Button>
				)}

				{/* Merge confirmation — inline */}
				{pendingMerge && (
					<div
						className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-primary/5"
						role="alert"
					>
						<span className="text-xs font-medium whitespace-nowrap">
							Merge {pendingMerge.pageCount} pages from{" "}
							<span className="text-foreground">{pendingMerge.file.name}</span>?
						</span>
						<Button
							variant="ghost"
							size="sm"
							onClick={confirmMerge}
							className="h-7 px-2 text-xs font-medium"
							title="Confirm merge"
						>
							Merge
						</Button>
						<Button
							variant="ghost"
							size="sm"
							onClick={cancelMerge}
							className="h-7 px-2 text-xs text-muted-foreground hover:bg-muted"
							title="Cancel"
						>
							Cancel
						</Button>
					</div>
				)}

				{/* Theme toggle */}
				<ModeToggle />

				{/* Overflow menu — Radix DropdownMenu for a11y */}
				<DropdownMenu.Root>
					<DropdownMenu.Trigger asChild>
						<Button
							variant="ghost"
							size="sm"
							title="More actions"
							aria-label="More actions"
						>
							<EllipsisVertical className="h-4 w-4" />
						</Button>
					</DropdownMenu.Trigger>
					<DropdownMenu.Portal>
						<DropdownMenu.Content
							align="end"
							sideOffset={4}
							className="z-20 min-w-40 rounded-lg border bg-card p-1 shadow-md"
						>
							<DropdownMenu.Item
								className="flex items-center gap-2 w-full px-3 py-2 text-sm rounded-md outline-none cursor-default data-[highlighted]:bg-accent"
								onSelect={extractCurrentPage}
							>
								<FileDown className="h-4 w-4" /> Extract page
							</DropdownMenu.Item>
							{totalPages > 1 && (
								<>
									<DropdownMenu.Item
										className="flex items-center gap-2 w-full px-3 py-2 text-sm rounded-md outline-none cursor-default data-[highlighted]:bg-accent data-[disabled]:opacity-50"
										onSelect={() => movePage(-1)}
										disabled={pageNum <= 1}
									>
										<ChevronLeft className="h-4 w-4" /> Move earlier
									</DropdownMenu.Item>
									<DropdownMenu.Item
										className="flex items-center gap-2 w-full px-3 py-2 text-sm rounded-md outline-none cursor-default data-[highlighted]:bg-accent data-[disabled]:opacity-50"
										onSelect={() => movePage(1)}
										disabled={pageNum >= totalPages}
									>
										<ChevronRight className="h-4 w-4" /> Move later
									</DropdownMenu.Item>
								</>
							)}
							<DropdownMenu.Item
								className="flex items-center gap-2 w-full px-3 py-2 text-sm rounded-md outline-none cursor-default data-[highlighted]:bg-accent"
								onSelect={handleMergePDF}
							>
								<FilePlus className="h-4 w-4" /> Merge PDF
							</DropdownMenu.Item>
						</DropdownMenu.Content>
					</DropdownMenu.Portal>
				</DropdownMenu.Root>
			</div>

			{/* PDF canvas */}
			<div className="relative w-full h-[calc(100vh-180px)] overflow-auto rounded-lg border bg-muted/30">
				{isLoading && (
					<div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 z-10 gap-3">
						<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
						<p className="text-sm text-muted-foreground">Loading {file.name}</p>
					</div>
				)}
				<div className="min-w-fit min-h-fit flex items-center justify-center p-4">
					<canvas ref={canvasRef} className="shadow-sm" />
				</div>
			</div>

			{/* Page thumbnails — horizontal scroll for manageable page counts */}
			{totalPages > 1 && totalPages <= 20 && (
				<nav
					className="flex items-center gap-1 overflow-x-auto max-w-full px-1 pb-1 scrollbar-thin"
					aria-label="Page navigation"
				>
					{Array.from({ length: totalPages }, (_, i) => {
						const n = i + 1;
						return (
							<Button
								key={`page-${n}`}
								variant={pageNum === n ? "default" : "ghost"}
								size="sm"
								onClick={() => gotoPage(n)}
								className="min-w-9 h-8 text-xs tabular-nums shrink-0"
								aria-label={`Go to page ${n}`}
								aria-current={pageNum === n ? "page" : undefined}
							>
								{n}
							</Button>
						);
					})}
				</nav>
			)}

			{/* For larger documents, show a compact page indicator */}
			{totalPages > 20 && (
				<p className="text-xs text-muted-foreground">
					Click the page number above to jump to any page
				</p>
			)}
		</div>
	);
}
