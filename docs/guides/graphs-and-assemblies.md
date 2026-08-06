# Graphs and assemblies

Graph rings display numerical values along reference coordinates. Typical examples are read depth, assembly coverage and other windowed measurements.

## Supported graph inputs

BRIGX accepts `.graph`, BedGraph, Wiggle, BED and SAM files as ring inputs. Add the file with **Add Files** on the ring that should display it.

When graph data is detected, the ring editor shows summary statistics and a **Graph Max Value** control. Leave the value empty to scale against the data maximum, or set a cap to keep extreme outliers from flattening the rest of the track.

## Coordinate expectations

Graph coordinates must refer to the loaded reference. Check whether the source format uses zero-based or one-based coordinates before converting data. A track that is shifted by one base is rarely visually obvious on a whole-genome circle.

## SAM coverage

SAM files are converted to coverage over the reference. Ensure that reference names in the SAM header and alignments match the loaded reference records.

!!! tip
    Put graph data in its own ring. Mixing it with query sequence files makes the legend and scaling harder to interpret.
