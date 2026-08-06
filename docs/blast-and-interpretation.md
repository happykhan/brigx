# Understanding BLAST results

BRIGX uses BLAST to find local similarities between each query and the reference. A coloured segment means that a query region aligned to that part of the reference and passed the selected filters. A blank segment is not automatically proof that a gene is absent.

## Identity and alignment length

**Minimum Identity** filters alignments below the chosen percentage. **Minimum Alignment Length** removes short matches. More stringent values produce a cleaner plot but can hide genuine divergent or short regions.

Each ring also has two display thresholds:

- Matches at or above the **Upper Threshold** use the ring's full colour.
- Matches between the **Lower Threshold** and upper threshold use a lighter shade.
- Matches below the lower threshold are not drawn on that ring.

The global minimum identity determines which alignments survive processing; per-ring thresholds determine how surviving hits are displayed.

## Low-complexity sequence

The original BRIG manual warns that low-complexity filtering can create gaps in otherwise similar regions. Disabling the filter may fill those gaps, but it can also produce repetitive, biologically unhelpful matches.

Change BLAST options only when you understand their effect and record non-default parameters with the figure.

## What a blank region can mean

A blank region may indicate:

- true absence from the query;
- sequence divergence below the identity threshold;
- an alignment shorter than the length threshold;
- incomplete or low-quality query assembly;
- repetitive sequence removed by filtering;
- a coordinate or file-format problem.

!!! tip "Check before interpreting"
    Lower the identity or length threshold, inspect assembly coverage, and compare more than one query before describing a region as absent.
