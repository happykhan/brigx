# Whole-genome comparison

This is the standard BRIGX workflow: one reference genome in the centre and one ring for each query genome or query group.

## Choose the reference

Use a complete or well-characterised genome when possible. The reference defines every coordinate around the circle; changing it changes the visual and biological frame of the comparison.

FASTA, GenBank and GBFF references can all be used for sequence comparison. To display selected annotations, import them explicitly through **Custom Ring Overlay**.

## Configure the rings

For each comparison group:

1. Select **Add New Ring**.
2. Enter the legend text.
3. Choose a colour.
4. Set lower and upper identity thresholds.
5. Add one or more genome files.

Rings are drawn from the inside out in the order shown. Use the up and down controls to reorder them.

### One file or several?

Use one file per ring when each genome needs its own visible comparison. Add several files to a single ring when they form one logical group and can share the same colour and legend entry.

## Review the plot

After the alignment finishes:

- confirm that the reference length is plausible;
- check that every expected ring appears in the legend;
- review query coverage in **Statistics**;
- move over unexpected gaps or low-identity segments;
- compare the plot against known assembly quality or biology.

## Prepare a figure

Use **Image Properties** to adjust ring width, spacing and font sizes. Keep labels legible at the final publication size. Export SVG for further editing in vector graphics software.

!!! tip "Build up complexity"
    Save a session after the first successful ring, then add the remaining genomes. This makes it easier to distinguish a data problem from a display problem.
