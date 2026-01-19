#!/usr/bin/env python3
"""Quick benchmark of LASTZ vs BLAST on a single genome pair."""

import sys
from benchmark_alignment import AlignmentBenchmark

def main():
    # Test on one pair: K12 vs CFT073
    ref = 'examples/E_coli_CFT073.fna'
    query = 'examples/E_coli_K12MG1655.fna'
    
    print("Testing LASTZ parameter configurations\n")
    
    # Test 1: Default LASTZ (minimal parameters)
    print("="*60)
    print("TEST 1: MINIMAL LASTZ PARAMETERS (just --ambiguous=iupac)")
    print("="*60)
    benchmark1 = AlignmentBenchmark(ref, query)
    result1 = benchmark1.run_benchmark(lastz_params={'ambiguous': 'iupac'})
    
    # Test 2: Current parameters
    print("\n" + "="*60)
    print("TEST 2: CURRENT PARAMETERS (optimized for speed)")
    print("="*60)
    benchmark2 = AlignmentBenchmark(ref, query)
    result2 = benchmark2.run_benchmark(lastz_params={
        'ambiguous': 'iupac',
        'noentropy': True,
        'notransition': True,
        'seed': 'match14',
        'step': '10',
        'maxwordcount': '90%',
        'masking': '10',
        'hspthresh': 'top50%'
    })
    
    # Comparison
    print("\n" + "="*60)
    print("COMPARISON")
    print("="*60)
    print(f"{'Parameter Set':<20} | {'Similarity':<12} | {'Correlation':<12} | {'Speedup':<10}")
    print("-"*60)
    print(f"{'Minimal':<20} | {result1['metrics']['bases_same_identity']:>10.2f}% | {result1['metrics']['correlation']:>10.4f} | {result1['speedup']:>8.2f}x")
    print(f"{'Current (fast)':<20} | {result2['metrics']['bases_same_identity']:>10.2f}% | {result2['metrics']['correlation']:>10.4f} | {result2['speedup']:>8.2f}x")
    print("="*60)
    print(f"\nTarget: ≥95% similarity")
    
    if result1['metrics']['bases_same_identity'] >= 95:
        print("✓ Minimal parameters PASS")
    else:
        print(f"✗ Minimal parameters FAIL ({result1['metrics']['bases_same_identity']:.2f}%)")
    
    if result2['metrics']['bases_same_identity'] >= 95:
        print("✓ Current parameters PASS")
    else:
        print(f"✗ Current parameters FAIL ({result2['metrics']['bases_same_identity']:.2f}%)")

if __name__ == '__main__':
    main()
