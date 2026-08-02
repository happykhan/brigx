# BRIGx

A free, local-first circular genome comparison tool for the web and desktop — the successor to [BRIG](https://pmc.ncbi.nlm.nih.gov/articles/PMC3163573/) (BLAST Ring Image Generator).

Live at [brigx.genomicx.org](https://brigx.genomicx.org) · Part of the [GenomicX](https://genomicx.org) ecosystem.

## Features

- **BLAST in the browser** via WebAssembly (BLAST Legacy 2.2.26, compiled with Emscripten)
- **4 parallel alignment workers** using Web Workers for fast whole-genome comparisons
- **GC content and GC skew** rings with adaptive scaling
- **Annotations** from GenBank features, tab-delimited files (BRIG 5-column format), BedGraph, Wiggle, BED
- **Graph rings** for coverage or any numerical data (.graph, .bedgraph, .wig, .sam)
- **Multi-FASTA references** with configurable spacers and contig boundary visualisation
- **Interactive** zoom, pan, and fullscreen
- **Export** as SVG (publication quality), PNG, or JSON session
- **Privacy first** — analysis data stays on your device; nothing is uploaded
- **Offline desktop edition** for macOS, Windows, and Linux with native projects, recovery, and exports

## Quick start

BRIGX requires Node.js 24 LTS for development and release builds.

```bash
npm ci
npm run dev      # http://localhost:5173
npm test         # Unit and domain tests (Vitest)
npm run build    # Production build
npm run verify   # Full release verification, including Chromium workflows
```

## Desktop edition

The small Tauri desktop shell runs the same integrity-checked BLAST WebAssembly pipeline as the web application. It uses the operating system's webview instead of bundling a browser engine, and does not add accounts, payments, telemetry, cloud storage, or a separate native analysis engine.

```bash
npm run desktop:dev       # Desktop shell with Vite hot reload
npm run desktop:test      # Real Tauri workflow and security-boundary tests
npm run desktop:package   # Optimised current-platform executable
npm run desktop:make      # Current-platform installer/package
```

Desktop `.brigx` projects save settings, annotations, completed plot data, source-file paths, and source-file hashes. They do not duplicate genome contents, so referenced input files must remain available. See [the desktop build and release guide](DESKTOP.md).

## How it works

BRIGX runs locally in the browser or desktop shell. Versioned BLAST binaries are compiled to WebAssembly, served from the BRIGX application origin, and verified with SHA-256 before execution. Alignments run inside Web Workers so the UI stays responsive. Genome and annotation file contents are not uploaded to an analysis server.

## Tech stack

- Vite + React + TypeScript
- Tauri 2 + Rust with the operating system webview
- BLAST 2.2.26 compiled to WebAssembly (Emscripten)
- Web Workers for parallel alignment
- [@genomicx/ui](https://github.com/happykhan/genomicx-ui) shared components (NavBar, AppFooter, LogConsole, ThemeToggle)
- SVG rendering (no dependencies)

## File formats

| Format | Use |
|---|---|
| FASTA (.fasta, .fa, .fna) | Reference and query genomes |
| GenBank (.gbk, .gb) | Reference, query, or annotation source |
| Gzipped variants | All of the above |
| .graph | BRIG coverage/graph data (start, stop, value) |
| .bedgraph / .wig / .bed | Coverage and annotation tracks |
| .sam | SAM alignment files (converted to coverage) |
| .tsv / .csv | Tab/comma-delimited annotations (BRIG 5-column format) |

## Citation

If you use BRIGx in your research, please cite the original BRIG paper:

> Alikhan NF, Petty NK, Ben Zakour NL, Beatson SA (2011) BLAST Ring Image Generator (BRIG): simple prokaryote genome comparisons. *BMC Genomics* 12:402. [Read the paper](https://pmc.ncbi.nlm.nih.gov/articles/PMC3163573/)

## Contributing

Bug reports and feature requests are welcome via [GitHub Issues](https://github.com/happykhan/brigx/issues).

## Author

Developed by [Nabil-Fareed Alikhan](https://happykhan.com), CGPS Oxford.

## License

BRIGX is GPL-3.0. Commercial use is permitted subject to the licence terms. See [the third-party notices](THIRD_PARTY_NOTICES.md) and [example-data provenance](examples/README.md).
