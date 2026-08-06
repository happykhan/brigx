# Multi-FASTA reference

A multi-FASTA reference contains several records, such as contigs, chromosomes or plasmids. BRIGX joins them into a single circular coordinate system and records each contig boundary.

## Load and inspect

Choose the multi-FASTA file in **Reference Genome**. Once parsed, BRIGX exposes the **Spacer Size** parameter. The spacer separates adjacent contigs visually without changing the original sequence files.

## Configure spacers

Use a small spacer when boundaries only need to be visible. Increase it when neighbouring contigs are difficult to distinguish, but remember that large spacers occupy plot circumference without representing genomic sequence.

Query alignments are mapped to the joined reference coordinates. Hover information identifies contig positions and lengths where available.

## Common uses

- Comparing queries against a draft assembly
- Showing several replicons in a single figure
- Reviewing conservation across a pan-genome or concatenated locus set

!!! warning
    Contig order in the FASTA file becomes the order around the circle. Reorder the FASTA records before loading if a particular biological or assembly order is required.
