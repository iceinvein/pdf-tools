import { useState } from "react";
import PDFViewer from "@/components/PDFViewer";
import { ThemeProvider } from "./components/theme-provider";
import DragAndDrop from "./components/DragAndDrop";
import { Toaster } from "./components/ui/sonner";

const App = () => {
	const [selectedFile, setSelectedFile] = useState<File | null>(null);

	return (
		<ThemeProvider defaultTheme="dark" storageKey="pdf-tools-theme">
			<div className="min-h-screen flex items-center justify-center p-4">
				{!selectedFile && <DragAndDrop onFileSelect={setSelectedFile} />}
				{selectedFile && <PDFViewer file={selectedFile} />}
			</div>
			<Toaster />
		</ThemeProvider>
	);
};

export default App;
