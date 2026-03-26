# Changelog

All notable changes to BRIGx will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- `CONTRIBUTING.md` with setup instructions, test/lint/build guidance, PR process, and code style notes.
- GitHub issue templates for bug reports and feature requests (`.github/ISSUE_TEMPLATE/`).
- `benchmarks/README.md` documenting the development benchmark scripts.
- `components/ErrorBoundary.tsx` — React error boundary wrapping the `CircularPlot` component.
- `CHANGELOG.md` (this file).

### Changed
- `lib/version.ts` — replaced CommonJS `require()` with a proper ESM approach using `NEXT_PUBLIC_APP_VERSION` env var; falls back to `'dev'` if unset.
- `next.config.js` — injects `NEXT_PUBLIC_APP_VERSION` from `npm_package_version` at build time.
- `eslint.config.mjs` — re-enabled `@typescript-eslint/no-explicit-any` and `@typescript-eslint/no-require-imports` as warnings (previously disabled) to surface technical debt without breaking the build.

### Removed
- `@biowasm/aioli` dependency — unused since BRIGx ships its own custom WASM build.

### Moved
- Python benchmark/analysis scripts (`ALIGNMENT_ANALYSIS.py`, `benchmark_alignment.py`, `quick_benchmark.py`, `quick_test_lastz.py`, `test_gapped.py`) moved from repo root to `benchmarks/`.

## [0.5.5] — prior release

Initial tracked version. See git history for earlier changes.
