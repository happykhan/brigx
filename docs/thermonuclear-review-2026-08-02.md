# Thermo-nuclear code-quality review — 2 August 2026

Scope: the complete `origin/master...codex/finish-brigx` change set, reviewed using the thermo-nuclear maintainability standard. The review focused on structural simplification, canonical ownership, branching growth, state consistency, type boundaries, and file growth.

## Blocking findings fixed

1. **The ring-merge tests did not test production code.** They contained a second copy of the controller algorithm, allowing the tests and implementation to drift while both appeared healthy. The merge now lives in the typed, pure `lib/ringState.ts` module and both partial/final controller paths and tests call it directly.
2. **Ring alignment data was merged by editable legend text.** Duplicate legends could cross-wire results. The canonical merge now uses the stable `queryId`, preserves explicit empty annotation arrays and valid numeric zero values, and has regression coverage for all three cases.
3. **Annotation updates performed a nested React state update.** `setPlotData` ran inside `setCachedPlotData`, coupling two stores through a setter callback. Both stores now use the same pure annotation update independently, preserving alignment data without a half-applied nested transition.
4. **GenBank and GFF3 imports duplicated modes, state, handlers, and panels.** The editor now has one typed import mode, one filter state, one handler, and one panel driven by format configuration.
5. **Annotation identity lived in a parallel index array.** Removing or reordering rows could silently attach an old ID to a different annotation. IDs now travel with their table rows, and untrusted spreadsheet shape strings pass through an explicit normalizer rather than a cast.
6. **Canvas and SVG renderers duplicated reference-feature conversion.** A single typed `referenceFeaturesToAnnotations` function now defines label, strand and colour behaviour for both renderers.
7. **Preview/export view state was declared twice and copied twice.** One shared `PlotViewState` contract now spans the canvas, page and SVG renderer. Tooltip payloads also have an explicit type instead of a double cast.
8. **SVG/PNG export setup was duplicated and cleanup was fragile.** Both formats now use one renderer path with guaranteed temporary-node cleanup. PNG blob creation is awaited so errors reach the existing error handler, and the 1000-pixel SVG is explicitly scaled onto the 1200-pixel PNG canvas instead of leaving an unpainted strip.

## Size result

- `hooks/useBRIGController.ts`: 541 to 392 lines.
- `components/AnnotationEditor.tsx`: 515 to 473 lines, despite retaining all spreadsheet and feature-import behaviour.
- Touched implementation/tests: more than 320 net lines removed before adding this report.
- No file crossed the 1,000-line threshold in this PR. The SVG and canvas renderer classes were already over that threshold on `master`; this change removes duplicated policy from them but does not attempt a risky wholesale rendering-engine rewrite in the feedback branch.

## Verification

- `npm test`: 12 files, 142 tests passed.
- `npm run test:e2e`: 4 Chromium workflows passed, including spreadsheet edit/paste/delete.
- Tracked-source ESLint: zero errors.
- `npm run build`: TypeScript and Vite production build passed.
- Browser: loaded `examples/BRIGExample.fna`, rendered the plot, added/deleted/saved annotations, switched GenBank/GFF3 import modes, and exported SVG and PNG. No browser console errors were recorded.

The repository-wide `npm run lint` also discovers the user's untracked `benchmark-blast-wasm.mjs`, which has 18 Node-global lint errors. That unrelated untracked file was deliberately not edited, staged, or included in this review fix.
