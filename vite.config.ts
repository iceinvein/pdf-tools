import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { resolve } from "node:path";
import tailwindcss from '@tailwindcss/vite';

// https://vite.dev/config/
export default defineConfig({
	plugins: [react(), tailwindcss()],
	// Use a relative base so the app works when hosted under a subpath (e.g., GitHub Pages project site)
	base: "./",
	resolve: {
		alias: {
			"@": resolve(__dirname, "./src"),
		},
	},
	build: {
		outDir: "dist",
		rollupOptions: {
			output: {
				manualChunks: (path) => {
					const reversedPath = path.split("/").reverse();
					return reversedPath[reversedPath.indexOf("node_modules") - 1];
				},
			},
			onwarn(warning, warn) {
				if (warning.code === "MODULE_LEVEL_DIRECTIVE") return;
				warn(warning);
			},
		},
		chunkSizeWarningLimit: 1600,
	},
});
