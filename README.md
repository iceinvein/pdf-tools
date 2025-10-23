# PDF Tools

A modern, feature-rich browser-based PDF viewer and editor built with React and TypeScript.

## Features

### Viewing
- 📄 View PDF files with smooth navigation
- 🔍 Zoom in/out and reset zoom
- 📑 Page-by-page navigation with pagination

### Editing
- 🗑️ **Delete pages** - Remove unwanted pages (supports multiple deletions!)
- � **Exttract pages** - Save individual pages as separate PDF files
- ⬆️⬇️ **Reorder pages** - Move pages up or down in the document
- 🔗 **Merge PDFs** - Combine multiple PDF files into one

### Management
- 💾 Download modified PDFs
- ↩️ Reset to original file
- 🎨 Dark mode support

## Installation

```bash
bun install
```

## Usage

```bash
bun dev
```

## How to Use

1. Drag and drop a PDF file or click "Choose File" to select one
2. Use the toolbar to manipulate your PDF:
   - **Zoom controls**: Adjust viewing size
   - **Extract**: Save current page separately
   - **Move Up/Down**: Reorder pages
   - **Merge**: Combine with another PDF
   - **Delete**: Remove current page
   - **Download**: Save your modified PDF
   - **Reset**: Revert all changes

## Tech Stack

- React 19 + TypeScript
- Vite 7
- pdf-lib (PDF manipulation)
- pdfjs-dist (PDF rendering)
- Tailwind CSS 4 + shadcn/ui
- Lucide icons
- Biome (linting & formatting)
