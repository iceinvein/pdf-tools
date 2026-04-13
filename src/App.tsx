import { useState } from "react";
import PDFViewer from "@/components/PDFViewer";
import DragAndDrop from "./components/DragAndDrop";
import { ThemeProvider } from "./components/theme-provider";
import { Toaster } from "./components/ui/sonner";

const App = () => {
	const [selectedFile, setSelectedFile] = useState<File | null>(null);

	return (
		<ThemeProvider defaultTheme="system" storageKey="pdf-tools-theme">
			{!selectedFile ? (
				<DragAndDrop onFileSelect={setSelectedFile} />
			) : (
				<div className="h-dvh flex flex-col bg-paper-workspace overflow-hidden">
					<PDFViewer
						file={selectedFile}
						onClose={() => setSelectedFile(null)}
					/>
				</div>
			)}
			<Toaster />
		</ThemeProvider>
	);
};

export default App;
