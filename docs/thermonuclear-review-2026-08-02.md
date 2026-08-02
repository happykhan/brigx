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

## Architectural recovery pass

The first pass fixed regressions introduced by the feedback work. A second repository-wide pass then removed inherited structural debt that made those regressions too easy to create:

1. **The SVG and canvas renderers were 1,554 and 1,125 lines.** Annotation geometry, canvas primitives, SVG/canvas annotation drawing, legend drawing and rendering contracts now have canonical focused modules under `lib/rendering/`. Canvas no longer imports its configuration contract from the SVG implementation.
2. **Complete and partial plots lived in two independently mutated React stores.** A pure `plotStateReducer` now models `committed` and `displayed` data explicitly. Partial results cannot corrupt the baseline; configuration, annotation and final-result transitions are atomic and tested.
3. **The UI and controller imported a Web Worker entrypoint as a library.** Genome parsing and feature extraction now live in ordinary domain modules. `parser.worker.ts` is a 64-line typed transport adapter, and CI rejects future UI/domain imports of worker entry modules.
4. **Reference previews initialized four BLAST/WASM workers they never used.** Controller initialization now starts only the parser worker. The four alignment workers are created lazily and concurrently when a real sequence ring needs BLAST; graph-only and annotation-only workflows do not load BLAST.
5. **Parser GC content and skew requests duplicated orchestration.** One typed `gcMetrics` request calculates both in a single worker transaction.
6. **Worker and controller caches had unsafe identities.** Alignment cache keys now include file identities and BLAST options; each worker verifies both reference name and sequence before reusing a formatdb index.
7. **An empty parsed ring could shift every following result onto the wrong ring.** Empty inputs retain their ring index and produce an explicit empty result instead of collapsing the array.
8. **Session JSON was trusted through a TypeScript cast.** Session/profile imports now validate every external field and enum, and session export retains per-ring BLAST, label and graph-cap settings.
9. **The on-page console interception was unbounded and unsafe on circular objects.** It is now an isolated hook with bounded history and defensive summarisation.
10. **Handsontable dominated the initial application bundle.** The annotation editor is loaded on demand, reducing the startup JavaScript chunk from about 1.55 MB to 349 KB. Its current theme API replaces the stylesheet path deprecated for Handsontable 17.
11. **The architecture had no regression barrier.** `npm run quality:architecture` enforces the 1,000-line ceiling and the worker/renderer ownership boundaries in CI.

## Size result

- `hooks/useBRIGController.ts`: 541 to 335 lines.
- `components/AnnotationEditor.tsx`: 515 to 476 lines, despite retaining all spreadsheet and feature-import behaviour.
- `lib/renderer.ts`: 1,554 to 908 lines.
- `lib/canvas-renderer.ts`: 1,125 to 654 lines.
- `workers/parser.worker.ts`: 402 to 64 lines.
- The two renderer classes shed 1,117 lines and the worker entrypoint shed 338; the retained behaviour now lives in focused domain/rendering modules instead of monoliths.
- No production TypeScript/TSX file exceeds 1,000 lines; CI now enforces that limit.

## Verification

- `npm test`: 14 files, 149 tests passed.
- `npm run test:e2e`: 4 Chromium workflows passed, including spreadsheet edit/paste/delete.
- Tracked-source ESLint: zero errors.
- `npm run build`: TypeScript and Vite production build passed.
- Architecture guardrails: passed.
- Browser: loaded both the 5.36 Mb example and the 582 kb fixture, rendered the plot at `Reference ready — 100%` without starting BLAST workers, synchronized a typed hex colour with the colour picker, loaded the lazy annotation editor, edited and deleted annotations, and confirmed the Handsontable deprecation warning was removed. No browser errors were recorded.

The repository-wide `npm run lint` also discovers the user's untracked `benchmark-blast-wasm.mjs`, which has 18 Node-global lint errors. That unrelated untracked file was deliberately not edited, staged, or included in this review fix.
