#!/usr/bin/env python3
"""Compare BLAST vs LASTZ gapped alignment on per-base coverage."""

import sys
from benchmark_alignment import AlignmentBenchmark

def main():
    ref = 'examples/E_coli_CFT073.fna'
    query = 'examples/E_coli_K12MG1655.fna'
    
    print("Per-Base Coverage Comparison: BLAST vs LASTZ\n")
    
    # Test LASTZ with gapped alignment
    print("="*60)
    print("Testing: LASTZ with --gapped --chain")
    print("="*60)
    benchmark = AlignmentBenchmark(ref, query)
    result = benchmark.run_benchmark(lastz_params={
        'ambiguous': 'iupac',
        'gapped': True,
        'chain': True
    })
    
    print("\n" + "="*60)
    print("KEY FINDINGS")
    print("="*60)
    metrics = result['metrics']
    print(f"BLAST found hits at:  {metrics['blast_coverage']:.2f}% of genome bases")
    print(f"LASTZ found hits at:  {metrics['lastz_coverage']:.2f}% of genome bases")
    print(f"Both agree on:        {metrics['overlap_coverage']:.2f}% of genome bases")
    print(f"\nOf bases covered by both:")
    print(f"  Same identity (±1%%): {metrics['bases_same_identity']:.2f}%")
    print(f"  Mean difference:     {metrics['mean_abs_diff']:.2f}%")
    print(f"  Correlation:         {metrics['correlation']:.4f}")
    print(f"\nRuntime:")
    print(f"  BLAST: {result['blast_time']:.2f}s")
    print(f"  LASTZ: {result['lastz_time']:.2f}s")
    print(f"  Speedup: {result['speedup']:.2f}x")
    
    print("\n" + "="*60)
    if metrics['bases_same_identity'] >= 95 and metrics['overlap_coverage'] >= 65:
        print("✓ PASS: LASTZ gapped matches BLAST coverage and identity")
    else:
        print(f"✗ FAIL: Need ≥95% identity match and ≥65% overlap")
        print(f"  Got {metrics['bases_same_identity']:.2f}% identity, {metrics['overlap_coverage']:.2f}% overlap")

if __name__ == '__main__':
    main()
