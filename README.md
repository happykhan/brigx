# BRIGx

A browser-based circular genome comparison tool — the successor to [BRIG](https://pmc.ncbi.nlm.nih.gov/articles/PMC3163573/) (BLAST Ring Image Generator), rebuilt for the modern web.

Live at [brigx.genomicx.org](https://brigx.genomicx.org). 

## Features

- **BLAST in the browser** via WebAssembly (BLAST Legacy 2.2.26, compiled with Emscripten)
- **4 parallel alignment workers** using Web Workers for fast whole-genome comparisons
- **GC content and GC skew** rings with adaptive scaling
- **Annotations** from GenBank features, tab-delimited files (BRIG 5-column csv format), BedGraph, Wiggle, BED
- **Graph rings** for coverage or any numerical data (.graph, .bedgraph, .wig, .sam)
- **Multi-FASTA references** with configurable spacers and contig boundary visualisation
- **Interactive** zoom, pan, and fullscreen
- **Export** as SVG (publication quality), PNG, or JSON session
- **Privacy first** — all data stays in your browser; nothing is uploaded anywhere. 

## Quick start

BRIGX requires Node.js 24 LTS for development and release builds.

```bash
npm install
npm run dev      # http://localhost:3000
npm test         # 157 tests (Vitest)
npm run build    # Production build
npm run verify   # Full release verification, including Chromium workflows
```

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

Bug reports and feature requests are welcome via [GitHub Issues](https://github.com/happykhan/brigx/issues). Or email me.

## Author

Developed by [Nabil-Fareed Alikhan](https://happykhan.com). 

## License

BRIGX is GPL-3.0. Commercial use is permitted subject to the licence terms. See [the third-party notices](THIRD_PARTY_NOTICES.md) and [example-data provenance](examples/README.md).
