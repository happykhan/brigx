#!/usr/bin/env python3
"""
Benchmark LASTZ vs BLAST alignment quality and runtime.
Compares per-base identity across the reference genome.
"""

import subprocess
import time
import re
from pathlib import Path
from collections import defaultdict
from typing import Dict, List, Tuple
import numpy as np

class AlignmentBenchmark:
    def __init__(self, reference_file: str, query_file: str):
        self.reference_file = Path(reference_file)
        self.query_file = Path(query_file)
        self.reference_length = self._get_fasta_length(reference_file)
        
    def _get_fasta_length(self, fasta_file: str) -> int:
        """Get total sequence length from FASTA file."""
        total_length = 0
        with open(fasta_file) as f:
            for line in f:
                if not line.startswith('>'):
                    total_length += len(line.strip())
        return total_length
    
    def run_blast(self) -> Tuple[np.ndarray, float]:
        """Run BLAST and return per-base identity vector and runtime."""
        print(f"Running BLAST: {self.query_file.name} vs {self.reference_file.name}")
        
        # Create BLAST database
        db_path = self.reference_file.with_suffix('.blast_db')
        print(f"  Creating BLAST database...")
        subprocess.run([
            'makeblastdb',
            '-in', str(self.reference_file),
            '-dbtype', 'nucl',
            '-out', str(db_path)
        ], check=True, capture_output=True)
        
        # Run BLAST
        print(f"  Running BLAST alignment (this may take a while)...")
        start_time = time.time()
        result = subprocess.run([
            'blastn',
            '-query', str(self.query_file),
            '-db', str(db_path),
            '-outfmt', '6 qseqid sseqid pident length qstart qend sstart send evalue bitscore',
            '-task', 'blastn',
            '-evalue', '1e-10',  # Filter out random hits
            '-num_threads', '4'  # Use multiple threads
        ], check=True, capture_output=True, text=True)
        runtime = time.time() - start_time
        
        # Parse BLAST output
        identity_vector = self._parse_blast_output(result.stdout)
        
        print(f"  Runtime: {runtime:.2f}s")
        print(f"  Hits: {len(result.stdout.strip().split(chr(10)))} alignments")
        
        return identity_vector, runtime
    
    def _parse_blast_output(self, blast_output: str) -> np.ndarray:
        """Parse BLAST tabular output to per-base identity vector."""
        identity_vector = np.zeros(self.reference_length, dtype=np.float32)
        hit_count = np.zeros(self.reference_length, dtype=np.int32)
        
        for line in blast_output.strip().split('\n'):
            if not line:
                continue
            fields = line.split('\t')
            pident = float(fields[2])
            sstart = int(fields[6])
            send = int(fields[7])
            
            # Handle reverse strand
            start = min(sstart, send) - 1  # Convert to 0-based
            end = max(sstart, send)
            
            # Add identity to each base in the alignment
            identity_vector[start:end] += pident
            hit_count[start:end] += 1
        
        # Average identity for bases covered by multiple hits
        mask = hit_count > 0
        identity_vector[mask] /= hit_count[mask]
        
        return identity_vector
    
    def run_lastz(self, params: Dict[str, str] = None) -> Tuple[np.ndarray, float]:
        """Run LASTZ and return per-base identity vector and runtime."""
        print(f"Running LASTZ: {self.query_file.name} vs {self.reference_file.name}")
        
        # Minimal required LASTZ parameters (ambiguous=iupac is needed for IUPAC codes in sequences)
        if params is None:
            params = {'ambiguous': 'iupac'}
        elif 'ambiguous' not in params:
            # Always add ambiguous=iupac if not specified
            params = {**params, 'ambiguous': 'iupac'}
        
        # Build LASTZ command
        cmd = ['lastz', str(self.reference_file), str(self.query_file)]
        
        for key, value in params.items():
            if value is True:
                cmd.append(f'--{key}')
            else:
                cmd.append(f'--{key}={value}')
        
        cmd.append('--format=BLASTN')
        
        print(f"  Command: {' '.join(cmd)}")
        
        # Run LASTZ
        start_time = time.time()
        try:
            result = subprocess.run(cmd, check=True, capture_output=True, text=True)
        except subprocess.CalledProcessError as e:
            print(f"  ERROR: LASTZ failed with exit code {e.returncode}")
            print(f"  STDERR: {e.stderr}")
            raise
        runtime = time.time() - start_time
        
        # Parse LASTZ output (BLASTN format)
        identity_vector = self._parse_blastn_output(result.stdout)
        
        print(f"  Runtime: {runtime:.2f}s")
        print(f"  Hits: {len([l for l in result.stdout.strip().split(chr(10)) if l and not l.startswith('#')])} alignments")
        
        return identity_vector, runtime
    
    def _parse_blastn_output(self, blastn_output: str) -> np.ndarray:
        """Parse BLASTN format output to per-base identity vector."""
        identity_vector = np.zeros(self.reference_length, dtype=np.float32)
        hit_count = np.zeros(self.reference_length, dtype=np.int32)
        
        for line in blastn_output.strip().split('\n'):
            if not line or line.startswith('#'):
                continue
            
            fields = line.split()
            if len(fields) < 12:
                continue
            
            # BLASTN format: query, subject, %id, alnlen, mismatches, gaps, qstart, qend, sstart, send, e-value, bitscore
            pident = float(fields[2])
            sstart = int(fields[8])
            send = int(fields[9])
            
            # Handle reverse strand
            start = min(sstart, send) - 1  # Convert to 0-based
            end = max(sstart, send)
            
            # Add identity to each base in the alignment
            identity_vector[start:end] += pident
            hit_count[start:end] += 1
        
        # Average identity for bases covered by multiple hits
        mask = hit_count > 0
        identity_vector[mask] /= hit_count[mask]
        
        return identity_vector
    
    def compare_vectors(self, blast_vector: np.ndarray, lastz_vector: np.ndarray) -> Dict[str, float]:
        """Compare BLAST and LASTZ identity vectors."""
        # Only compare bases that have alignments in at least one method
        covered_blast = blast_vector > 0
        covered_lastz = lastz_vector > 0
        covered_either = covered_blast | covered_lastz
        covered_both = covered_blast & covered_lastz
        
        # Calculate metrics
        metrics = {
            'blast_coverage': np.sum(covered_blast) / self.reference_length * 100,
            'lastz_coverage': np.sum(covered_lastz) / self.reference_length * 100,
            'overlap_coverage': np.sum(covered_both) / self.reference_length * 100,
            'bases_same_identity': 0,
            'mean_abs_diff': 0,
            'correlation': 0
        }
        
        if np.sum(covered_either) > 0:
            # Compare identity values for bases covered by both
            if np.sum(covered_both) > 0:
                blast_vals = blast_vector[covered_both]
                lastz_vals = lastz_vector[covered_both]
                
                # Bases with same identity (within 1%)
                same_identity = np.abs(blast_vals - lastz_vals) < 1.0
                metrics['bases_same_identity'] = np.sum(same_identity) / len(same_identity) * 100
                
                # Mean absolute difference
                metrics['mean_abs_diff'] = np.mean(np.abs(blast_vals - lastz_vals))
                
                # Correlation
                if np.std(blast_vals) > 0 and np.std(lastz_vals) > 0:
                    metrics['correlation'] = np.corrcoef(blast_vals, lastz_vals)[0, 1]
        
        return metrics
    
    def run_benchmark(self, lastz_params: Dict[str, str] = None) -> Dict:
        """Run full benchmark comparing BLAST and LASTZ."""
        print(f"\n{'='*60}")
        print(f"Benchmarking: {self.reference_file.name} vs {self.query_file.name}")
        print(f"Reference length: {self.reference_length:,} bp")
        print(f"{'='*60}\n")
        
        # Run BLAST
        blast_vector, blast_time = self.run_blast()
        
        # Run LASTZ
        lastz_vector, lastz_time = self.run_lastz(lastz_params)
        
        # Compare results
        print(f"\nComparing results...")
        metrics = self.compare_vectors(blast_vector, lastz_vector)
        
        # Print results
        print(f"\n{'='*60}")
        print("RESULTS")
        print(f"{'='*60}")
        print(f"Runtime:")
        print(f"  BLAST: {blast_time:.2f}s")
        print(f"  LASTZ: {lastz_time:.2f}s")
        print(f"  Speedup: {blast_time/lastz_time:.2f}x")
        print(f"\nCoverage:")
        print(f"  BLAST: {metrics['blast_coverage']:.2f}%")
        print(f"  LASTZ: {metrics['lastz_coverage']:.2f}%")
        print(f"  Overlap: {metrics['overlap_coverage']:.2f}%")
        print(f"\nIdentity Comparison (bases covered by both):")
        print(f"  Bases with same identity (±1%): {metrics['bases_same_identity']:.2f}%")
        print(f"  Mean absolute difference: {metrics['mean_abs_diff']:.2f}%")
        print(f"  Correlation: {metrics['correlation']:.4f}")
        print(f"{'='*60}\n")
        
        return {
            'blast_time': blast_time,
            'lastz_time': lastz_time,
            'speedup': blast_time / lastz_time,
            'metrics': metrics,
            'blast_vector': blast_vector,
            'lastz_vector': lastz_vector
        }


def main():
    """Run benchmarks on all E. coli genome pairs."""
    examples_dir = Path('examples')
    
    # Get all E. coli genomes
    genomes = sorted(examples_dir.glob('E_coli_*.fna'))
    
    print(f"Found {len(genomes)} E. coli genomes:")
    for genome in genomes:
        print(f"  - {genome.name}")
    
    # Test different LASTZ parameter sets
    param_sets = {
        'default': {},  # No special parameters - use LASTZ defaults
        'current': {
            'ambiguous': 'iupac',
            'noentropy': True,
            'notransition': True,
            'seed': 'match14',
            'step': '10',
            'maxwordcount': '90%',
            'masking': '10',
            'hspthresh': 'top50%'
        }
    }
    
    # Run pairwise comparisons with different parameter sets
    all_results = {}
    
    for param_name, params in param_sets.items():
        print(f"\n{'#'*60}")
        print(f"# Testing parameter set: {param_name.upper()}")
        print(f"{'#'*60}\n")
        
        results = []
        for i, ref_genome in enumerate(genomes):
            for query_genome in genomes[i+1:]:
                benchmark = AlignmentBenchmark(str(ref_genome), str(query_genome))
                result = benchmark.run_benchmark(params)
                results.append({
                    'reference': ref_genome.name,
                    'query': query_genome.name,
                    **result
                })
        
        all_results[param_name] = results
        
        # Summary for this parameter set
        print(f"\n{'='*60}")
        print(f"SUMMARY - {param_name.upper()}")
        print(f"{'='*60}")
        print(f"Total comparisons: {len(results)}")
        
        avg_similarity = np.mean([r['metrics']['bases_same_identity'] for r in results])
        avg_speedup = np.mean([r['speedup'] for r in results])
        avg_correlation = np.mean([r['metrics']['correlation'] for r in results])
        
        print(f"Average bases with same identity: {avg_similarity:.2f}%")
        print(f"Average correlation: {avg_correlation:.4f}")
        print(f"Average speedup (BLAST/LASTZ): {avg_speedup:.2f}x")
        print(f"\nTarget: ≥95% similarity between BLAST and LASTZ")
        
        if avg_similarity >= 95:
            print("✓ PASSED: LASTZ matches BLAST results")
        else:
            print("✗ FAILED: LASTZ does not match BLAST results closely enough")
        
        print(f"{'='*60}\n")
    
    # Final comparison
    print(f"\n{'#'*60}")
    print("# FINAL COMPARISON")
    print(f"{'#'*60}\n")
    for param_name, results in all_results.items():
        avg_similarity = np.mean([r['metrics']['bases_same_identity'] for r in results])
        avg_speedup = np.mean([r['speedup'] for r in results])
        avg_correlation = np.mean([r['metrics']['correlation'] for r in results])
        print(f"{param_name.upper():15s} | Similarity: {avg_similarity:5.2f}% | Correlation: {avg_correlation:.4f} | Speedup: {avg_speedup:.2f}x")
    print()


if __name__ == '__main__':
    main()
