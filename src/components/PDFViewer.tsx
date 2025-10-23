import { Button } from "@/components/ui/button";
import {
	ArrowUpDown,
	ChevronLeft,
	ChevronRight,
	FileDown,
	FilePlus,
	LucideArchiveRestore,
	LucideScanSearch,
	LucideZoomIn,
	LucideZoomOut,
	Trash2,
} from "lucide-react";
import { Download } from "lucide-react";
import { PDFDocument } from "pdf-lib";
import * as pdfjs from "pdfjs-dist";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PDFViewerProps {
	file: File | null;
}

export default function PDFViewer({ file }: PDFViewerProps) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const renderTaskRef = useRef<RenderTask | null>(null);

	const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
	const [pageNum, setPageNum] = useState<number>(1);
	const [totalPages, setTotalPages] = useState<number>(0);
	const [modifiedPdf, setModifiedPdf] = useState<PDFDocument | null>(null);
	const [currentPdfBytes, setCurrentPdfBytes] = useState<Uint8Array | null>(
		null,
	);
	const [pageRotations, setPageRotations] = useState<Map<number, number>>(
		new Map(),
	);

	const loadPDF = useCallback(async (fileOrBytes: File | Uint8Array) => {
		try {
			let bytes: Uint8Array;
			if (fileOrBytes instanceof File) {
				const arrayBuffer = await fileOrBytes.arrayBuffer();
				bytes = new Uint8Array(arrayBuffer);
			} else {
				bytes = fileOrBytes;
			}

			// Store a copy for pdf-lib operations (pdfjs may detach the buffer)
			const bytesCopy = new Uint8Array(bytes);
			setCurrentPdfBytes(bytesCopy);

			// Pass the original bytes to pdfjs
			const loadingTask = pdfjs.getDocument(bytes);

			const pdf = await loadingTask.promise;
			setPdfDoc(pdf);
			setTotalPages(pdf.numPages);
		} catch (error) {
			console.error("Error loading PDF:", error);
			toast.error("Error loading PDF. Please try again.");
		}
	}, []);

	const [scale, setScale] = useState(1.5);

	const renderPage = useCallback(
		async (pdf: PDFDocumentProxy | null, pageNumber: number) => {
			if (!pdf) return;

			// Cancel any ongoing render task
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

				const rotation = pageRotations.get(pageNumber) || 0;
				const viewport = page.getViewport({ scale, rotation });
				canvas.height = viewport.height;
				canvas.width = viewport.width;

				const renderContext = {
					canvasContext: context,
					viewport: viewport,
					canvas: canvas,
				};

				// Store the render task so we can cancel it if needed
				renderTaskRef.current = page.render(renderContext);
				await renderTaskRef.current.promise;
				renderTaskRef.current = null;
			} catch (error) {
				// Ignore cancellation errors
				if (
					error instanceof Error &&
					error.name === "RenderingCancelledException"
				) {
					return;
				}
				console.error("Error rendering page:", error);
				toast.error("Error rendering page. Please try again.");
			}
		},
		[scale, pageRotations],
	);

	const zoomReset = useCallback(() => {
		setScale(1.5);
	}, []);

	const zoomIn = useCallback(() => {
		setScale((prev) => prev + 0.2);
	}, []);

	const zoomOut = useCallback(() => {
		setScale((prev) => Math.max(0.5, prev - 0.2));
	}, []);

	useEffect(() => {
		if (pdfDoc && pageNum) renderPage(pdfDoc, pageNum);
	}, [pdfDoc, pageNum, renderPage]);

	const changePage = (delta: number) => {
		const newPageNum = pageNum + delta;
		if (newPageNum > 0 && newPageNum <= totalPages) {
			setPageNum(newPageNum);
			renderPage(pdfDoc, newPageNum);
		}
	};

	const gotoPage = (pageNumber: number) => {
		setPageNum(pageNumber);
		renderPage(pdfDoc, pageNumber);
	};

	const deletePage = async (pageNumber: number) => {
		if (!pdfDoc || totalPages <= 1 || !currentPdfBytes) return;

		try {
			const pdfLibDoc = await PDFDocument.load(currentPdfBytes);
			pdfLibDoc.removePage(pageNumber - 1);

			const modifiedPdfBytes = await pdfLibDoc.save();
			setModifiedPdf(pdfLibDoc);

			// Adjust current page if needed
			const newPageNum = pageNumber > 1 ? pageNumber - 1 : 1;

			await loadPDF(modifiedPdfBytes);
			setPageNum(newPageNum);
			toast.success("Page deleted successfully.");
		} catch (error) {
			console.error("Error deleting page:", error);
			toast.error("Error deleting page. Please try again.");
		}
	};

	const handleDeleteCurrentPage = () => {
		if (!pdfDoc || totalPages <= 1) return;
		deletePage(pageNum);
	};

	const extractCurrentPage = async () => {
		if (!pdfDoc || !currentPdfBytes || !file) return;

		try {
			const pdfLibDoc = await PDFDocument.load(currentPdfBytes);
			const newPdf = await PDFDocument.create();
			const [copiedPage] = await newPdf.copyPages(pdfLibDoc, [pageNum - 1]);
			newPdf.addPage(copiedPage);

			const pdfBytes = await newPdf.save();
			const blob = new Blob([new Uint8Array(pdfBytes)], { type: "application/pdf" });
			const url = URL.createObjectURL(blob);

			const link = document.createElement("a");
			link.href = url;
			link.download = `page_${pageNum}_${file.name}`;
			link.click();

			URL.revokeObjectURL(url);
			toast.success(`Page ${pageNum} extracted successfully.`);
		} catch (error) {
			console.error("Error extracting page:", error);
			toast.error("Error extracting page. Please try again.");
		}
	};

	const handleMergePDF = async () => {
		const input = document.createElement("input");
		input.type = "file";
		input.accept = ".pdf";
		input.onchange = async (e) => {
			const target = e.target as HTMLInputElement;
			const mergeFile = target.files?.[0];
			if (!mergeFile || !currentPdfBytes) return;

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
				setModifiedPdf(pdfLibDoc);

				await loadPDF(mergedPdfBytes);
				toast.success("PDFs merged successfully.");
			} catch (error) {
				console.error("Error merging PDFs:", error);
				toast.error("Error merging PDFs. Please try again.");
			}
		};
		input.click();
	};

	const movePageUp = async () => {
		if (!currentPdfBytes || pageNum <= 1) return;

		try {
			const pdfLibDoc = await PDFDocument.load(currentPdfBytes);
			const pages = pdfLibDoc.getPages();

			// Swap pages
			const currentIndex = pageNum - 1;
			const targetIndex = currentIndex - 1;

			// Create new PDF with reordered pages
			const newPdf = await PDFDocument.create();
			const indices = Array.from({ length: pages.length }, (_, i) => i);
			[indices[targetIndex], indices[currentIndex]] = [
				indices[currentIndex],
				indices[targetIndex],
			];

			const copiedPages = await newPdf.copyPages(pdfLibDoc, indices);
			for (const page of copiedPages) {
				newPdf.addPage(page);
			}

			const modifiedPdfBytes = await newPdf.save();
			setModifiedPdf(newPdf);

			await loadPDF(modifiedPdfBytes);
			setPageNum(pageNum - 1);
			toast.success("Page moved up.");
		} catch (error) {
			console.error("Error moving page up:", error);
			toast.error("Error moving page. Please try again.");
		}
	};

	const movePageDown = async () => {
		if (!currentPdfBytes || pageNum >= totalPages) return;

		try {
			const pdfLibDoc = await PDFDocument.load(currentPdfBytes);
			const pages = pdfLibDoc.getPages();

			// Swap pages
			const currentIndex = pageNum - 1;
			const targetIndex = currentIndex + 1;

			// Create new PDF with reordered pages
			const newPdf = await PDFDocument.create();
			const indices = Array.from({ length: pages.length }, (_, i) => i);
			[indices[currentIndex], indices[targetIndex]] = [
				indices[targetIndex],
				indices[currentIndex],
			];

			const copiedPages = await newPdf.copyPages(pdfLibDoc, indices);
			for (const page of copiedPages) {
				newPdf.addPage(page);
			}

			const modifiedPdfBytes = await newPdf.save();
			setModifiedPdf(newPdf);

			await loadPDF(modifiedPdfBytes);
			setPageNum(pageNum + 1);
			toast.success("Page moved down.");
		} catch (error) {
			console.error("Error moving page down:", error);
			toast.error("Error moving page. Please try again.");
		}
	};

	useEffect(() => {
		if (file) {
			loadPDF(file);
			toast.success("PDF loaded.");
		}
	}, [file, loadPDF]);

	const downloadPDF = async () => {
		if (!file || !currentPdfBytes) return;

		try {
			const blob = new Blob([new Uint8Array(currentPdfBytes)], { type: "application/pdf" });
			const url = URL.createObjectURL(blob);

			const link = document.createElement("a");
			link.href = url;
			link.download = `modified_${file.name}`;
			link.click();

			URL.revokeObjectURL(url);

			toast.success("PDF downloaded.");
		} catch (error) {
			console.error("Error downloading PDF:", error);
			toast.error("Error downloading PDF. Please try again.");
		}
	};

	const resetPDF = useCallback(() => {
		if (!file) return;
		setModifiedPdf(null);
		setPageRotations(new Map());
		loadPDF(file);
		toast.success("PDF reset.");
	}, [file, loadPDF]);

	return (
		<div className="flex flex-col items-center justify-center p-8 gap-2">
			<h2 className="text-xl font-semibold">PDF Tools</h2>

			{/* Main Toolbar */}
			<div className="w-full flex items-center justify-center gap-2 p-2 border rounded-lg bg-muted/50 flex-wrap">
				{/* Zoom Controls */}
				<div className="flex items-center gap-1 border-r pr-2">
					<Button variant="outline" size="sm" onClick={zoomIn} title="Zoom In">
						<LucideZoomIn className="h-4 w-4" />
					</Button>
					<Button
						variant="outline"
						size="sm"
						onClick={zoomOut}
						title="Zoom Out"
					>
						<LucideZoomOut className="h-4 w-4" />
					</Button>
					<Button
						variant="outline"
						size="sm"
						onClick={zoomReset}
						title="Reset Zoom"
					>
						<LucideScanSearch className="h-4 w-4" />
					</Button>
				</div>

				{/* Page Navigation */}
				<div className="flex items-center gap-1 border-r pr-2">
					<Button
						variant="outline"
						size="sm"
						onClick={() => changePage(-1)}
						disabled={pageNum === 1}
						title="Previous Page"
					>
						<ChevronLeft className="h-4 w-4" />
					</Button>
					<span className="text-sm px-2 min-w-[80px] text-center">
						{pageNum} / {totalPages}
					</span>
					<Button
						variant="outline"
						size="sm"
						onClick={() => changePage(1)}
						disabled={pageNum === totalPages}
						title="Next Page"
					>
						<ChevronRight className="h-4 w-4" />
					</Button>
				</div>

				{/* Page Manipulation */}
				<div className="flex items-center gap-1 border-r pr-2">
					<Button
						variant="outline"
						size="sm"
						onClick={extractCurrentPage}
						title="Extract Current Page"
					>
						<FileDown className="h-4 w-4" />
					</Button>
					<Button
						variant="destructive"
						size="sm"
						onClick={handleDeleteCurrentPage}
						disabled={totalPages <= 1}
						title="Delete Current Page"
					>
						<Trash2 className="h-4 w-4" />
					</Button>
				</div>

				{/* Page Reordering */}
				<div className="flex items-center gap-1 border-r pr-2">
					<Button
						variant="outline"
						size="sm"
						onClick={movePageUp}
						disabled={pageNum <= 1}
						title="Move Page Up"
					>
						<ArrowUpDown className="h-4 w-4 rotate-180" />
					</Button>
					<Button
						variant="outline"
						size="sm"
						onClick={movePageDown}
						disabled={pageNum >= totalPages}
						title="Move Page Down"
					>
						<ArrowUpDown className="h-4 w-4" />
					</Button>
				</div>

				{/* File Operations */}
				<div className="flex items-center gap-1">
					<Button
						variant="outline"
						size="sm"
						onClick={handleMergePDF}
						title="Merge with Another PDF"
					>
						<FilePlus className="h-4 w-4" />
					</Button>
					<Button
						variant="outline"
						size="sm"
						onClick={downloadPDF}
						disabled={!file}
						title="Download PDF"
					>
						<Download className="h-4 w-4" />
					</Button>
					<Button
						variant="outline"
						size="sm"
						onClick={resetPDF}
						disabled={!modifiedPdf}
						title="Reset to Original"
					>
						<LucideArchiveRestore className="h-4 w-4" />
					</Button>
				</div>
			</div>

			{/* PDF Viewer */}
			<div className="relative w-full max-w-[1190px] h-[1230px] overflow-auto border rounded-lg">
				<div className="min-w-fit min-h-fit flex items-center justify-center p-4">
					<canvas ref={canvasRef} className="rounded-lg shadow-md" />
				</div>
			</div>

			{/* Page Thumbnails/Quick Navigation */}
			{totalPages > 1 && (
				<div className="flex items-center gap-1 flex-wrap justify-center max-w-[1190px]">
					{Array.from({ length: totalPages }, (_, i) => {
						const pageNumber = i + 1;
						return (
							<Button
								key={`page-${pageNumber}`}
								variant={pageNum === pageNumber ? "default" : "outline"}
								size="sm"
								onClick={() => gotoPage(pageNumber)}
								className="min-w-[40px]"
								title={`Go to page ${pageNumber}`}
							>
								{pageNumber}
							</Button>
						);
					})}
				</div>
			)}
		</div>
	);
}
