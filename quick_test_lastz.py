#!/usr/bin/env python3
"""Quick test of different LASTZ parameters without running BLAST each time."""

import subprocess
import time
from pathlib import Path

def run_lastz_test(ref_file, query_file, params_dict, name):
    """Run LASTZ with given parameters and report results."""
    cmd = ['lastz', str(ref_file), str(query_file)]
    
    for key, value in params_dict.items():
        if value is True:
            cmd.append(f'--{key}')
        else:
            cmd.append(f'--{key}={value}')
    
    cmd.append('--format=BLASTN')
    
    print(f"\n{'='*60}")
    print(f"Testing: {name}")
    print(f"{'='*60}")
    print(f"Command: {' '.join(cmd)}")
    
    start_time = time.time()
    try:
        result = subprocess.run(cmd, check=True, capture_output=True, text=True)
        runtime = time.time() - start_time
        
        # Count hits
        hits = len([line for line in result.stdout.strip().split('\n') if line and not line.startswith('#')])
        
        print(f"Runtime: {runtime:.2f}s")
        print(f"Hits: {hits} alignments")
        
        return {'runtime': runtime, 'hits': hits, 'success': True}
    except subprocess.CalledProcessError as e:
        runtime = time.time() - start_time
        print(f"FAILED after {runtime:.2f}s")
        print(f"Error: {e.stderr}")
        return {'runtime': runtime, 'hits': 0, 'success': False}

def main():
    ref = Path('examples/E_coli_CFT073.fna')
    query = Path('examples/E_coli_K12MG1655.fna')
    
    print("Testing LASTZ Parameter Configurations")
    print(f"Reference: {ref.name} vs Query: {query.name}\n")
    
    # Test different parameter sets
    param_sets = {
        'BLAST-like (gapped)': {
            'ambiguous': 'iupac',
            'gapped': True,  # Enable gapped alignment like BLAST
            'chain': True    # Chain hits together
        },
        'With gfextend': {
            'ambiguous': 'iupac',
            'gapped': True,
            'chain': True,
            'gfextend': True  # Gap-free extension
        },
        'Sensitive seed': {
            'ambiguous': 'iupac',
            'gapped': True,
            'chain': True,
            'seed': 'match10',  # More sensitive seed
            'step': '5'
        }
    }
    
    results = {}
    for name, params in param_sets.items():
        results[name] = run_lastz_test(ref, query, params, name)
    
    # Summary
    print(f"\n{'='*60}")
    print("SUMMARY")
    print(f"{'='*60}")
    print(f"{'Configuration':<30} | {'Runtime':<10} | {'Hits':<10}")
    print("-"*60)
    
    for name, result in results.items():
        if result['success']:
            print(f"{name:<30} | {result['runtime']:>8.2f}s | {result['hits']:>10}")
        else:
            print(f"{name:<30} | {'FAILED':<10} | {'-':>10}")
    
    print(f"{'='*60}")
    print("\nNote: Compare hit counts to BLAST baseline of ~48,481 alignments")
    print("Goal: Find params that give similar hit count but faster runtime")

if __name__ == '__main__':
    main()
