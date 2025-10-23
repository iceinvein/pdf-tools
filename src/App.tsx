import PDFViewer from "@/components/PDFViewer";
import { useState } from "react";
import DragAndDrop from "./components/DragAndDrop";
import { ThemeProvider } from "./components/theme-provider";
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
