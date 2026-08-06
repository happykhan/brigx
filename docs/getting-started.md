# Quick start

This walkthrough produces a basic whole-genome comparison. No installation or server upload is required.

## 1. Load a reference

Open the BRIGX workspace and choose a reference file in **Reference Genome**. FASTA, GenBank and GBFF files are accepted, including gzipped variants.

- GenBank or GBFF CDS features are displayed automatically.
- Multi-FASTA records are joined into one circular coordinate system.
- GC content and GC skew are calculated from the reference.

## 2. Add a comparison ring

In **Ring Configuration**, select **Add New Ring**.

1. Give the ring a meaningful legend name.
2. Choose a colour or enter its six-digit hexadecimal value.
3. Select **Add Files** and choose one or more query files.
4. Leave the upper and lower identity thresholds at their defaults for the first run.

Several files in one ring are treated as one combined query. Create separate rings when you want separate legend entries or colours.

## 3. Run the alignment

Select **Run Alignments**. Progress and diagnostic messages appear in the debug console. The work is performed by browser workers, so a large comparison can take time without blocking the rest of the page.

## 4. Inspect the result

- Move over the plot to inspect positions, identity values and annotations.
- Scroll over the plot to zoom; drag to pan.
- Use **Centre** to retain the zoom level but reset the pan.
- Use **Reset** to return to the original view.

## 5. Save or export

- **SVG** is the preferred publication-quality figure format.
- **PNG** creates a raster image.
- **Data** exports the computed plot data as JSON.
- **Save session** stores an editable BRIGX session, including the result when available.
- **Preview result** opens a temporary read-only view in the same browser.

!!! warning
    A local preview URL is temporary and is not a shareable publication link. See [Sessions and sharing](reference/sessions-and-sharing.md) for public GitHub-hosted sessions.
