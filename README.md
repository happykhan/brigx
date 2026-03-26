# BRIGX

A browser-based circular genome comparison tool. The successor to [BRIG](https://pmc.ncbi.nlm.nih.gov/articles/PMC3163573/) (BLAST Ring Image Generator), rebuilt for the modern web.

BRIGX runs entirely in your browser using WebAssembly. No server, no uploads, no installation. Your data stays on your machine.

## What it does

Compare multiple bacterial genomes against a reference and visualise the results as a circular plot, showing regions of similarity, GC content, GC skew, and custom annotations.

## Features

- **BLAST in the browser** via WebAssembly (BLAST Legacy 2.2.26, megablast)
- **4 parallel alignment workers** for fast whole-genome comparisons
- **GC content and GC skew** rings with adaptive scaling
- **Annotations** from GenBank features, tab-delimited files (BRIG 5-column format), BedGraph, Wiggle, BED
- **Graph rings** for coverage, expression, or any numerical data (.graph, .bedgraph, .wig, .sam)
- **Multi-FASTA references** with configurable spacers and contig boundary visualisation
- **Per-ring thresholds** for identity colour scaling
- **Interactive** zoom, pan, scroll-to-zoom, expand to fullscreen
- **Export** as SVG (publication quality), PNG, or JSON
- **Save/load sessions** to resume work later
- **Dark and light themes**

## Quick start

```bash
npm install
npm run dev
# Open http://localhost:3000
```

## Usage

1. Load a reference genome (FASTA or GenBank)
2. Add rings with query genomes, graph files, or SAM coverage
3. Configure thresholds, colours, and annotations per ring
4. Click **Run Alignments**
5. Export the plot

## File formats

| Format | Use |
|---|---|
| FASTA (.fasta, .fa, .fna) | Reference and query genomes |
| GenBank (.gbk, .gb) | Reference, query, or annotation source |
| Gzipped variants | All of the above |
| .graph | BRIG coverage/graph data (start, stop, value) |
| .bedgraph | UCSC BedGraph format |
| .wig | UCSC Wiggle (variableStep/fixedStep) |
| .bed | BED format (score column used as value) |
| .sam | SAM alignment files (converted to coverage) |
| .tsv/.csv | Tab/comma-delimited annotations (BRIG 5-column: Start, Stop, Label, Colour, Decoration) |

## Parameters

- **Minimum Identity**: Filter alignments below this similarity (50-100%)
- **Minimum Alignment Length**: Filter short alignments
- **BLAST Program**: blastn (default) or blastx
- **BLAST Options**: Custom blastall flags (e.g., `-W 11 -e 1e-3`)
- **Spacer Size**: Gap between contigs in multi-FASTA references

## Tech stack

- Next.js 15 + TypeScript + Tailwind CSS
- BLAST 2.2.26 compiled to WebAssembly (Emscripten)
- Web Workers for parallel alignment
- SVG rendering (no dependencies)

## Tests

```bash
npm test          # 130 tests
npm run lint      # ESLint
npm run build     # Production build
```

## Citation

If you use BRIGX in your research, please cite the original BRIG paper:

> Alikhan NF, Petty NK, Ben Zakour NL, Beatson SA (2011) BLAST Ring Image Generator (BRIG): simple prokaryote genome comparisons. BMC Genomics 12:402. [Read the paper](https://pmc.ncbi.nlm.nih.gov/articles/PMC3163573/)

## Links

- [genomicx.org](https://genomicx.org)
- [GitHub](https://github.com/happykhan/brigx)
- Bug reports: nabil@happykhan.com

## License

GPL-3.0
