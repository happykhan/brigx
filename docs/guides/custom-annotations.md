# Custom annotations

Custom annotations are optional highlights attached to a selected ring. They can mark genes, genomic islands, resistance loci, prophages or any other reference-coordinate interval.

## Open the annotation editor

1. Create or select the ring that should carry the overlay.
2. Select **Custom Ring Overlay**.
3. Add rows manually, paste tabular rows, upload a table, or import GenBank/GFF3 features.
4. Choose block or arrow styles and colours.
5. Close the editor when finished; annotations are retained with the ring.

## Table format

The editable table uses five fields:

| Field | Meaning |
|---|---|
| Start | First reference coordinate |
| End | Last reference coordinate |
| Label | Text shown for the feature |
| Style | Block, forward arrow or reverse arrow |
| Colour | Six-digit hexadecimal colour |

Rows can be pasted from a spreadsheet as tab-separated values.

## GenBank and GFF3 imports

Use the import controls inside **Custom Ring Overlay** to extract features from GenBank or GFF3. Review coordinates and labels after import, especially if the annotation file was generated against a different reference build.

Annotations embedded in a GenBank/GBFF reference are not displayed automatically. Import the features you want through **Custom Ring Overlay**.

!!! warning
    An annotation interval is drawn against reference coordinates. BRIGX does not lift coordinates between assemblies.
