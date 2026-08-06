# File formats

| Format | Extensions | Use |
|---|---|---|
| FASTA | `.fasta`, `.fa`, `.fna` | Reference or query sequences |
| GenBank | `.gbk`, `.gb`, `.gbff`, `.genbank` | Sequences and embedded features |
| Gzip | `.gz` variants | Compressed FASTA or GenBank inputs |
| BRIG graph | `.graph` | Coordinate-value graph tracks |
| BedGraph | `.bedgraph` | Coordinate-value graph tracks |
| Wiggle | `.wig` | Numerical tracks |
| BED | `.bed` | Interval or graph tracks |
| SAM | `.sam` | Alignment coverage |
| Table | `.tsv`, `.csv`, `.txt` | Custom annotations in the annotation editor |
| BRIGX JSON | `.json` | Saved session or result data |

## File naming

Use informative, unique names. Ring file lists and diagnostic logs identify inputs by filename, so repeated names from different directories can be confusing.

## Compression

FASTA and GenBank inputs can be gzip-compressed. Graph and annotation-table imports should be supplied in their uncompressed form unless the relevant chooser explicitly lists gzip support.
