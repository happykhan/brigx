# BRIGX manual

BRIGX creates interactive circular comparisons between a reference genome and one or more query genomes. It is the browser-based successor to **BRIG** (BLAST Ring Image Generator).

The analysis runs locally in your browser. Reference genomes, query genomes and annotations are not uploaded to an analysis server.

## What you can make

- Whole-genome BLAST comparisons with several query rings
- Multi-contig reference plots with configurable spacers
- GC content and GC skew tracks
- Coverage and other numerical graph rings
- Custom feature overlays imported from GenBank, GFF3 or a table
- SVG and PNG figures, plus reusable BRIGX session files

## How this manual is organised

This manual follows the workflow of the original BRIG manual: begin with a worked whole-genome comparison, then move to multi-FASTA references, graph data, annotations and detailed configuration. The controls and terminology have been updated for BRIGX.

1. [Run a first comparison](getting-started.md).
2. Follow the [whole-genome comparison](guides/whole-genome-comparison.md) walkthrough.
3. Learn how [identity thresholds affect interpretation](blast-and-interpretation.md).
4. Use the configuration reference when you need a specific control.

!!! tip "A good first plot"
    Start with one reference and one closely related query. Once the result looks sensible, add more query genomes and tune the display.

## Citation

If you use BRIGX in research, cite the original BRIG paper:

> Alikhan NF, Petty NK, Ben Zakour NL, Beatson SA (2011). BLAST Ring Image Generator (BRIG): simple prokaryote genome comparisons. *BMC Genomics* 12:402.

[Read the open-access BRIG paper](https://pmc.ncbi.nlm.nih.gov/articles/PMC3163573/)
