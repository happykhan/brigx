# BRIGX feedback browser audit — 2026-08-02

## Scope

- Live site: `https://brigx.genomicx.org/` (`v0.6.26` shown in the header)
- Pending branch: `codex/finish-brigx` / PR #18 (`v0.6.27`)
- Browser: Chromium via the Codex in-app browser
- Laptop viewports checked: 1366 × 768 and 1280 × 720
- Reference: `S.aureus.Mu50-plasmid-AP003367.gbk` (25,107 bp)
- Query: `S.aureus.pSK57-plasmid-GQ900493.gbk` (31,164 bp)
- Live alignment result: 25 hits; 13.5% reference coverage; 99.9% average identity. The run had completed by the first observation 8 seconds after clicking **Run Alignments**.

No production data was changed. All files were local public BRIG example files and BRIGX processed them in the browser.

## Findings on the live site

### 3. Settings and output are difficult to see together on a laptop — confirmed

At the effective 1280 × 720 viewport after loading the two plasmids:

- **Circular Plot** heading: document Y 330–364 px
- **Run Alignments** button: document Y 1386–1430 px
- **Statistics** heading: document Y 1762–1796 px
- Total document height: 2192 px

The plot is visible near the top while the action and statistics are far below the fold. Substantial vertical movement is required to operate the settings and inspect the result.

### 4. HEX colour entry — partially confirmed on live; explicit control exists in PR #18

The live site exposes only the browser's native `input[type=color]`. Its value is a HEX value and accepts `#123ABC` (normalized by the browser to `#123abc`), but there is no visible text field for manually entering or pasting a HEX code.

The pending branch adds a visible **Hex colour code** field next to the colour control.

### 5. File permission/read error — not reproduced

Both the reference and query GenBank files loaded successfully in a fresh session. No file-read exception appeared in the UI or browser console.

The reported message is the browser's `NotReadableError`/File API wording. It is consistent with the browser losing access to a previously selected local file, for example after the file is moved, permissions change, or a stale file reference is reused. The live site surfaces the raw browser message, which is not actionable for users. PR #18 includes friendlier file-reselection guidance, but this intermittent condition could not be forced in the browser audit.

### 6. Meaning of average identity — calculation confirmed; documentation absent on live

The live **About** page does not define the statistic.

BRIGX first filters alignment hits using the configured minimum identity and minimum alignment length. It then calculates a reference-span-weighted mean:

`sum(hit percent identity × hit reference span) / sum(hit reference span)`

The calculation is over accepted BLAST hits in the ring. Overlapping hit spans contribute more than once to the identity weighting. Coverage is different: it marks reference bases and counts each covered reference position only once.

For this plasmid test, BRIGX reported 99.9% average identity across the accepted hits and 13.5% unique reference coverage.

### 7. Annotation spreadsheet — several parts confirmed, with nuance

Observed on live `v0.6.26`:

- **Add New** works and creates a default annotation.
- Manual editing works when a cell is double-clicked and text is entered through the grid editor.
- **Delete Selected** is broken: after selecting row 1 and clicking the button, BRIGX reports `No rows selected` and leaves the row in place. The selection is lost when focus moves to the toolbar button.
- Pressing Delete on one cell clears it, but the grid displays the literal value `null` instead of an empty cell.
- There is no annotation reset control. The visible **Reset** elsewhere belongs to plot zoom/view state.
- Pasting two Excel-style tab-separated rows updates the first row but does not create/display the second row. The toolbar still reports one annotation.

## Pending-branch regression and resolution

PR #18 includes fixes for explicit HEX entry, a statistics explanation, annotation reset, and selected-row retention. The first manual browser pass found this blocking regression:

1. Load the 25,107 bp plasmid reference.
2. Add a ring.
3. Click **Custom Annotations**.
4. React repeatedly logs `Maximum update depth exceeded`.
5. The final stack is in Handsontable's `handsontableAfterViewRender` / `<HotTableClass2>` and the application DOM disappears.

The repeated errors began at `2026-08-02T10:55:09.197Z`; the fatal Handsontable stack was captured at `2026-08-02T10:55:17.740Z`.

The root cause was the plot-view export integration rather than Handsontable itself. `CircularPlot` emitted a newly allocated view-state object; `Home` stored it and recreated the plot-data object inline; this forced another render and another view-state emission. Mounting Handsontable during that parent render loop made the eventual fatal stack appear to originate inside `<HotTableClass2>`.

The loop was fixed by memoising the displayed plot data and ignoring view-state updates whose values have not changed. The browser regression now loads a real reference before opening annotations so the plot and grid are mounted together.

Post-fix verification:

- Annotation dialog opens with the real 25,107 bp reference and an active circular plot.
- Add and selected-row deletion work; deletion reports `Deleted 1 annotation(s)`.
- Automated browser coverage verifies edit, two-row TSV paste, row deletion, and no uncaught page errors.
- Manual browser console: zero errors after opening and using the annotation dialog.
- 140 unit tests, lint, production build, and all 4 Chromium end-to-end tests pass.
- The only browser warning is Handsontable's deprecated stylesheet notice; it is non-fatal.

## Recommended acceptance checks after repair

1. At 1280 × 720, keep the plot visible while the reference/ring/run controls remain usable without scrolling the whole document.
2. Enter and paste a HEX code in the explicit text field and verify the ring updates.
3. Re-select files after a forced stale-file/read failure and verify actionable guidance.
4. Show a tooltip or help text for the exact average-identity formula.
5. In annotations: add, double-click edit, clear one cell, paste at least two TSV rows, select and delete a row, reset all, save, reopen, and verify persistence.
6. Run the same annotation workflow from a production build, not only the Vite development server.
