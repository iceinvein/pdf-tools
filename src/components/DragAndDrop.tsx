import { UploadCloud } from "lucide-react";
import { type ChangeEvent, type DragEvent, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

type DragAndDropProps = {
	onFileSelect: (file: File) => void;
};

export default function DragAndDrop({ onFileSelect }: DragAndDropProps) {
	const [isDragging, setIsDragging] = useState(false);

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

	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: drop zone requires drag events on a region
		<div
			className={`flex flex-col items-center justify-center w-full max-w-md px-12 py-16 border-2 border-dashed rounded-lg transition-colors ${
				isDragging
					? "border-primary bg-primary/5"
					: "border-border hover:border-muted-foreground/40"
			}`}
			onDragOver={handleDragOver}
			onDragLeave={handleDragLeave}
			onDrop={handleDrop}
		>
			<UploadCloud className="w-8 h-8 text-muted-foreground mb-4" />
			<p className="text-base font-medium text-muted-foreground mb-1 font-display">
				Drop a PDF here
			</p>
			<p className="text-xs text-muted-foreground/60 mb-4">
				or choose from your files
			</p>
			<Button variant="default" size="sm" asChild>
				<label className="cursor-pointer">
					Choose file
					<input
						type="file"
						accept=".pdf"
						className="hidden"
						onChange={handleFileChange}
					/>
				</label>
			</Button>
		</div>
	);
}
