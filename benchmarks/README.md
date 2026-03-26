# Benchmarks

This directory contains development benchmark and analysis scripts used during BRIGx development. These are not part of the main application and are not required for running or building BRIGx.

## Scripts

- **ALIGNMENT_ANALYSIS.py** — Analyses alignment output files for quality metrics.
- **benchmark_alignment.py** — Benchmarks alignment performance against reference datasets.
- **quick_benchmark.py** — Quick benchmark for rapid iteration during development.
- **quick_test_lastz.py** — Quick smoke-test for the lastz aligner integration.
- **test_gapped.py** — Tests gapped alignment behaviour.

## Prerequisites

- Python 3.8+
- lastz (must be available on PATH)

## Usage

Run individual scripts directly:

```bash
python benchmarks/benchmark_alignment.py
```

These scripts are intended for developer use only and may require specific input files or environment configuration.
