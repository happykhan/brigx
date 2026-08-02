# Changelog

All notable changes to BRIGx will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Free, small offline Tauri desktop edition for macOS, Windows, and Linux using each operating system's webview.
- Versioned `.brigx` projects with source-path hashing, recent projects, native save dialogs, autosave recovery, and an unsaved-changes close guard.
- Least-privilege Tauri command/capability boundary, opaque file tokens, binary IPC, denied navigation, platform icons, packaging matrix, checksums, and tagged-build provenance.
- Desktop end-to-end coverage for the real BLAST workflow, project round-trip, recovery, native export, renderer isolation, and direct-plugin denial.
- Locked Rust dependency policy and bundled full licence texts generated with cargo-about.
- Bakta `.gbff` and GFF3 feature import support.
- Reference GenBank CDS annotations in both the canvas preview and SVG export.
- A plot centre control and correctly scaled legend dragging.
- Direct HEX colour entry for comparison rings.
- Explanatory average-identity tooltip in the statistics panel.
- Named Inkscape-compatible SVG groups and top-level gradient definitions.
- Actionable recovery guidance when a browser loses access to a selected file.
- Regression coverage for GFF3, file access, editable SVG output, and annotation editing/paste/deletion.

### Changed
- Replaced the Electron prototype with Tauri while retaining the browser WebAssembly BLAST engine and `.brigx` schema.
- JavaScript `unsafe-eval` is no longer required; integrity-checked BLAST loaders use verified in-memory modules while CSP grants only WebAssembly compilation.
- All exports use native save dialogs in the desktop edition and ordinary downloads on the web.
- CI installs the committed npm lockfile with `npm ci` and audits runtime plus build dependencies.
- Bug-report guidance now requests only minimised, synthetic, or public test data and warns against sharing sensitive genome data.
- Settings and output panels now remain usable together on laptop screens.
- Annotation editing now preserves manual edits and spreadsheet paste, with reliable row deletion and reset.
- SVG and PNG exports preserve the preview zoom, pan, and dragged legend positions.
- BED inputs are routed through the graph parser as advertised.
- Browser workers and the alignment interface now use strict TypeScript types.
- Production DOMPurify is pinned to the patched release.

### Removed
- Cloud storage, payments, licence keys, analytics, and telemetry from the product plan; BRIGX remains entirely free and local-first.
- `@biowasm/aioli` dependency — unused since BRIGx ships its own custom WASM build.

### Moved
- Python benchmark/analysis scripts (`ALIGNMENT_ANALYSIS.py`, `benchmark_alignment.py`, `quick_benchmark.py`, `quick_test_lastz.py`, `test_gapped.py`) moved from repo root to `benchmarks/`.

## [0.5.5] — prior release

Initial tracked version. See git history for earlier changes.
