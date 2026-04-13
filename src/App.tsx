import { BrowserRouter, Route, Routes } from "react-router-dom";
import { PRIVACY, TOOLS } from "@/lib/tools";
import PrivacyRoute from "@/routes/PrivacyRoute";
import ToolRoute from "@/routes/ToolRoute";
import { ThemeProvider } from "./components/theme-provider";
import { Toaster } from "./components/ui/sonner";

const App = () => {
	return (
		<ThemeProvider defaultTheme="system" storageKey="pdf-tools-theme">
			<BrowserRouter>
				<Routes>
					{TOOLS.map((tool) => (
						<Route
							key={tool.slug || "home"}
							path={tool.slug ? `/${tool.slug}` : "/"}
							element={<ToolRoute tool={tool} />}
						/>
					))}
					<Route path={`/${PRIVACY.slug}`} element={<PrivacyRoute />} />
					{/* Unknown paths fall back to the home tool, acting as a soft-404. */}
					<Route path="*" element={<ToolRoute tool={TOOLS[0]} />} />
				</Routes>
			</BrowserRouter>
			<Toaster />
		</ThemeProvider>
	);
};

export default App;
