import { useState } from "react";
import PDFViewer from "@/components/PDFViewer";
import DragAndDrop from "./components/DragAndDrop";
import { ModeToggle } from "./components/mode-toggle";
import { ThemeProvider } from "./components/theme-provider";
import { Toaster } from "./components/ui/sonner";

const App = () => {
	const [selectedFile, setSelectedFile] = useState<File | null>(null);

	return (
		<ThemeProvider defaultTheme="system" storageKey="pdf-tools-theme">
			<div className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-6">
				{!selectedFile && <DragAndDrop onFileSelect={setSelectedFile} />}
				{selectedFile && (
					<PDFViewer
						file={selectedFile}
						onClose={() => setSelectedFile(null)}
					/>
				)}
			</div>
			{!selectedFile && <ModeToggle className="fixed top-3 right-3 z-50" />}
			<Toaster />
		</ThemeProvider>
	);
};

export default App;
