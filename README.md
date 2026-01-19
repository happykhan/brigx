# BRIGX - Browser-Based Ring Image Generator

A modern, browser-based implementation of BRIG (BLAST Ring Image Generator) for comparative genomics visualization, powered by WebAssembly and LASTZ.

A fully client-side circular comparative genome visualization tool built with Next.js and WebAssembly.

## Features

- 🌐 **100% Browser-Based**: No server required, all processing happens client-side
- 🧬 **Bacterial Genome Support**: Optimized for bacterial genomes and draft assemblies
- ⚡ **WebAssembly Powered**: Uses LASTZ compiled to WASM for fast alignments
- 🎨 **Publication Quality**: Export high-resolution SVG for publications
- 🔒 **Privacy First**: Your data never leaves your browser
- 📊 **Interactive Visualization**: Zoom, pan, and explore alignment data
- 🚀 **Parallel Processing**: Multi-threaded alignment using Web Workers

## Quick Start

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Open http://localhost:3000
```

## Usage

1. **Upload Reference Genome**: Select your reference genome in FASTA format
2. **Upload Query Genomes**: Select one or more query genomes to compare
3. **Adjust Parameters**: Configure window size, identity thresholds, and alignment filters
4. **Generate Plot**: Click "Generate Plot" to run the alignment pipeline
5. **Export**: Save your visualization as SVG or export alignment data as JSON

## Parameters

- **Window Size**: Resolution of the circular plot (100-10000 bp)
- **Minimum Identity**: Filter alignments below this similarity (50-100%)
- **Minimum Alignment Length**: Filter short alignments (50-5000 bp)

## Tech Stack

- **Next.js 15**: React framework with App Router
- **TypeScript**: Type-safe development
- **Tailwind CSS**: Utility-first styling
- **LASTZ WASM**: Pairwise DNA sequence aligner
- **Web Workers**: Multi-threaded processing
- **SVG Rendering**: Scalable, publication-quality graphics

## Architecture

```
├── app/                 # Next.js app router pages
├── components/          # React components
├── lib/                 # Core libraries
│   ├── types.ts        # TypeScript interfaces
│   ├── renderer.ts     # SVG circular plot renderer
│   └── controller.ts   # Pipeline orchestration
├── workers/             # Web Workers
│   ├── parser.worker.ts      # FASTA parsing
│   ├── alignment.worker.ts   # LASTZ alignment
│   └── processing.worker.ts  # Data aggregation
└── public/              # Static assets
```

## Browser Support

- Chrome/Edge 90+
- Firefox 90+
- Safari 14+

Requires WebAssembly and Web Workers support.

## License

MIT

## Credits

Built with LASTZ from biowasm.com
```
