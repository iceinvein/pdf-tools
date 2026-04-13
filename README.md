# Quire

**Free PDF tools, private, browser-based.** Merge, extract, delete, and reorder PDF pages without uploading them. Your files never leave your device.

[**Open Quire →**](https://quire-pdf.netlify.app)

---

## Why it exists

Every other free PDF tool uploads your file to a server. Quire does the work in your browser.

- **No upload.** Files are read, edited, and downloaded entirely on your machine.
- **No account.** No sign-up, no email, no tracking.
- **No limits.** No file size cap, no watermark, no per-day quota.
- **No internet needed after first visit.** The site is a static bundle your browser caches.

## What it does

| Tool | What it's for |
|------|---------------|
| [Merge PDFs](https://quire-pdf.netlify.app/merge-pdf) | Combine two or more PDFs into one |
| [Extract pages](https://quire-pdf.netlify.app/extract-pdf-pages) | Save any single page as its own file |
| [Delete pages](https://quire-pdf.netlify.app/delete-pdf-pages) | Remove pages you don't need |
| [Reorder pages](https://quire-pdf.netlify.app/reorder-pdf-pages) | Move a page earlier or later in the document |

Every action is undoable. Nothing is written to disk until you hit download.

## How it works

Two open-source libraries do all the work, both running inside your browser tab:

- **pdf.js** (Mozilla) renders each page onto a canvas so you can see it.
- **pdf-lib** rewrites the PDF byte stream when you edit.

There is no server component. Open the network tab, drop a PDF, and watch: no outbound requests carry your file.

Read the longer version at [/privacy](https://quire-pdf.netlify.app/privacy).

## Keyboard shortcuts

| Action | Shortcut |
|--------|----------|
| Open a file | `Cmd/Ctrl + O` |
| Navigate pages | `Arrow Left` / `Arrow Right` |
| Jump to first / last page | `Home` / `End` |
| Reorder current page | `Cmd/Ctrl + Shift + Arrow` |
| Zoom in / out | `Cmd/Ctrl + +` / `Cmd/Ctrl + -` |
| Save | `Cmd/Ctrl + S` |
| Undo | `Cmd/Ctrl + Z` |
| Cancel a prompt | `Esc` |

## Running it locally

```bash
bun install
bun dev
```

Dev server runs on `http://localhost:5173`. For a production build with prerendered SEO routes:

```bash
bun run build
```

Output lands in `dist/`, ready for any static host.

## Under the hood

Built on React 19, Vite 7, Tailwind v4, and shadcn/ui. Typography pairs Bricolage Grotesque (display) with Atkinson Hyperlegible (body). Routes are prerendered at build time via a small Bun script in `scripts/prerender.ts`; each tool gets its own static HTML with title, canonical, OG tags, and FAQPage JSON-LD so search engines and AI summarizers can index it without running JavaScript.

## License

MIT.
