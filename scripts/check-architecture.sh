#!/usr/bin/env bash
set -euo pipefail

maximum_lines=1000
failed=0

while IFS= read -r source_file; do
  line_count=$(wc -l < "$source_file" | tr -d ' ')
  if (( line_count > maximum_lines )); then
    echo "Architecture check: $source_file has $line_count lines (limit: $maximum_lines)."
    failed=1
  fi
done < <(find components hooks lib src workers -type f \( -name '*.ts' -o -name '*.tsx' \) -print | sort)

if rg -n "(from[[:space:]]+|import\()[\"'][^\"']*workers/" components hooks lib src; then
  echo "Architecture check: UI/domain modules must not import Web Worker entry modules."
  failed=1
fi

if rg -n "from[[:space:]]+[\"'][^\"']*renderer[\"']" lib/canvas-renderer.ts; then
  echo "Architecture check: canvas rendering must use shared rendering contracts, not SVG renderer internals."
  failed=1
fi

exit "$failed"
