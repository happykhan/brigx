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

if grep -R -n -E "(from[[:space:]]+|import\()[\"'][^\"']*workers/" components hooks lib src; then
  echo "Architecture check: UI/domain modules must not import Web Worker entry modules."
  failed=1
fi

if grep -n -E "from[[:space:]]+[\"'][^\"']*renderer[\"']" lib/canvas-renderer.ts; then
  echo "Architecture check: canvas rendering must use shared rendering contracts, not SVG renderer internals."
  failed=1
fi

for renderer in lib/canvas-renderer.ts lib/renderer.ts; do
  if ! grep -F -q "from './plotScene'" "$renderer"; then
    echo "Architecture check: $renderer must consume the shared plot scene."
    failed=1
  fi
done

if grep -n -E "(calculateRingLayout|positionToAngle|getColorIntensity|hexToRGB)" lib/canvas-renderer.ts lib/renderer.ts; then
  echo "Architecture check: renderer backends must not recalculate shared plot geometry or colours."
  failed=1
fi

if grep -n -E "data\.(reference|rings)" lib/canvas-renderer.ts lib/renderer.ts; then
  echo "Architecture check: renderer backends must use scene visibility, not raw plot data."
  failed=1
fi

exit "$failed"
