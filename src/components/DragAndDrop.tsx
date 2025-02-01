import { useState, type DragEvent, type ChangeEvent } from "react";
import { Button } from "@/components/ui/button";
import { UploadCloud } from "lucide-react";

interface DragAndDropProps {
	onFileSelect: (file: File) => void;
}

export default function DragAndDrop({ onFileSelect }: DragAndDropProps) {
	const [isDragging, setIsDragging] = useState(false);

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
		if (file && file.type === "application/pdf") {
			onFileSelect(file);
		}
	};

	const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0];
		if (file && file.type === "application/pdf") onFileSelect(file);
	};

	return (
		<div
			className={`flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-lg transition-colors ${isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25"}`}
			onDragOver={handleDragOver}
			onDragLeave={handleDragLeave}
			onDrop={handleDrop}
		>
			<UploadCloud className="w-10 h-10 text-muted-foreground mb-4" />
			<p className="text-sm text-muted-foreground mb-2">
				Drag and drop your PDF here, or
			</p>
			<Button variant="default" asChild>
				<label className="cursor-pointer">
					Choose File
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
