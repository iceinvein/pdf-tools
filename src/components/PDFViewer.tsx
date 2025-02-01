import { useCallback, useEffect, useRef, useState } from "react";
import * as pdfjs from "pdfjs-dist";
import {
	Pagination,
	PaginationContent,
	PaginationItem,
	PaginationLink,
	PaginationNext,
	PaginationPrevious,
} from "@/components/ui/pagination";
import { Button } from "@/components/ui/button";
import {
	LucideArchiveRestore,
	LucideScanSearch,
	LucideZoomIn,
	LucideZoomOut,
	Trash2,
} from "lucide-react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { PDFDocument } from "pdf-lib";
import { Download } from "lucide-react";
import { toast } from "sonner";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PDFViewerProps {
	file: File | null;
}

export default function PDFViewer({ file }: PDFViewerProps) {
	const canvasRef = useRef<HTMLCanvasElement>(null);

	const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
	const [pageNum, setPageNum] = useState<number>(1);
	const [totalPages, setTotalPages] = useState<number>(0);
	const [modifiedPdf, setModifiedPdf] = useState<PDFDocument | null>(null);

	const loadPDF = useCallback(async (file: File) => {
		try {
			const arrayBuffer = await file.arrayBuffer();
			const loadingTask = pdfjs.getDocument(new Uint8Array(arrayBuffer));

			const pdf = await loadingTask.promise;
			setPdfDoc(pdf);
			setTotalPages(pdf.numPages);
			setPageNum(1);
			renderPage(pdf, 1);
		} catch (error) {
			toast.error("Error loading PDF. Please try again.");
		}
	}, []);

	const [scale, setScale] = useState(1.5);

	const renderPage = useCallback(
		async (pdf: PDFDocumentProxy | null, pageNumber: number) => {
			if (!pdf) return;

			try {
				const page = await pdf.getPage(pageNumber);
				const canvas = canvasRef.current;
				if (!canvas) return;

				const context = canvas.getContext("2d");
				if (!context) return;

				const viewport = page.getViewport({ scale });
				canvas.height = viewport.height;
				canvas.width = viewport.width;

				const renderContext = {
					canvasContext: context,
					viewport: viewport,
				};

				page.render(renderContext);
			} catch (error) {
				toast.error("Error loading PDF. Please try again.");
			}
		},
		[scale],
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
		if (!pdfDoc || totalPages <= 1 || !file) return;

		try {
			const arrayBuffer = await file.arrayBuffer();
			const pdfLibDoc = await PDFDocument.load(arrayBuffer);

			pdfLibDoc.removePage(pageNumber - 1);

			const modifiedPdfBytes = await pdfLibDoc.save();

			const modifiedFile = new File([modifiedPdfBytes], file.name, {
				type: "application/pdf",
			});

			setModifiedPdf(pdfLibDoc);

			loadPDF(modifiedFile);

			toast.success("Page deleted successfully.");
		} catch (error) {
			toast.error("Error deleting current page. Please try again.");
		}
	};

	const handleDeleteCurrentPage = () => {
		if (!pdfDoc || totalPages <= 1) return;
		deletePage(pageNum);
	};

	useEffect(() => {
		if (file) {
			loadPDF(file);
			toast.success("PDF loaded.");
		}
	}, [file, loadPDF]);

	const downloadPDF = async () => {
		if (!file || !pdfDoc) return;

		try {
			const pdfToDownload =
				modifiedPdf ?? (await PDFDocument.load(await file.arrayBuffer()));
			const pdfBytes = await pdfToDownload.save();

			const blob = new Blob([pdfBytes], { type: "application/pdf" });
			const url = URL.createObjectURL(blob);

			const link = document.createElement("a");
			link.href = url;
			link.download = `modified_${file.name}`;
			link.click();

			URL.revokeObjectURL(url);

			toast.success("PDF downloaded.");
		} catch (error) {
			toast.error("Error downloading PDF. Please try again.");
		}
	};

	const resetPDF = useCallback(() => {
		if (!file) return;
		setModifiedPdf(null);
		loadPDF(file);
		toast.success("PDF reset.");
	}, [file, loadPDF]);

	return (
		<div className="flex flex-col items-center justify-center p-8 gap-2">
			<h2 className="text-xl font-semibold">PDF Viewer</h2>
			<div className="w-full flex items-center justify-center gap-2 p-2 border rounded-lg bg-muted/50">
				<Button variant="outline" size="sm" onClick={zoomIn}>
					<LucideZoomIn className="h-4 w-4" />
				</Button>
				<Button variant="outline" size="sm" onClick={zoomOut}>
					<LucideZoomOut className="h-4 w-4" />
				</Button>
				<Button variant="outline" size="sm" onClick={zoomReset}>
					<LucideScanSearch className="h-4 w-4" />
				</Button>
				<Button
					variant="outline"
					size="sm"
					onClick={downloadPDF}
					disabled={!file}
				>
					<Download className="h-4 w-4" />
				</Button>
				<Button
					variant="outline"
					size="sm"
					onClick={resetPDF}
					disabled={!modifiedPdf}
				>
					<LucideArchiveRestore className="h-4 w-4" />
				</Button>
			</div>
			<div className="relative w-full max-w-[1190px] h-[1230px] overflow-auto border rounded-lg">
				{totalPages > 1 && (
					<Button
						variant="destructive"
						size="sm"
						onClick={handleDeleteCurrentPage}
						className="absolute top-0 right-0 z-10"
					>
						<Trash2 className="h-4 w-4" />
					</Button>
				)}
				<div className="min-w-fit min-h-fit flex items-center justify-center p-4">
					<canvas ref={canvasRef} className="rounded-lg shadow-md" />
				</div>
			</div>
			<Pagination>
				<PaginationContent>
					<PaginationItem>
						{pageNum === 1 ? (
							<PaginationPrevious
								aria-disabled
								className="pointer-events-none opacity-50"
							/>
						) : (
							<PaginationPrevious
								onClick={() => changePage(-1)}
								className="cursor-pointer"
							/>
						)}
					</PaginationItem>
					<PaginationItem className="flex items-center gap-1">
						{Array.from({ length: totalPages }, (_, i) => {
							const pageNumber = i + 1;
							return (
								<PaginationLink
									key={`page-${pageNumber}`}
									isActive={pageNum === pageNumber}
									onClick={() => gotoPage(pageNumber)}
									className="cursor-pointer"
								>
									{pageNumber}
								</PaginationLink>
							);
						})}
					</PaginationItem>
					<PaginationItem>
						{pageNum === totalPages ? (
							<PaginationNext
								aria-disabled
								className="pointer-events-none opacity-50"
							/>
						) : (
							<PaginationNext
								onClick={() => changePage(1)}
								className="cursor-pointer"
							/>
						)}
					</PaginationItem>
				</PaginationContent>
			</Pagination>
		</div>
	);
}
