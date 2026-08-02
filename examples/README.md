# Example and regression data

These files support parser, renderer, and original-BRIG workflow regression tests. Vite does not copy this directory into the hosted BRIGX application.

## Public NCBI sequence snapshots

The following files contain static snapshots of public sequence records. The identifier in each file is the authoritative way to locate the current record. NCBI may update record annotations or sequence versions after these snapshots were created.

| File | Accession/version in file |
|---|---|
| `E_coli_CFT073.fna` | NC_004431.1 |
| `E_coli_HS.fna` | NC_009800.1 |
| `E_coli_K12MG1655.fna` | NC_000913.2 |
| `E_coli_UTI89.fna` | NC_007946.1 |
| `Ecoli_O126.fna` | NC_011601.1 (the record identifies strain E2348/69) |
| `E_coli_O157H7Sakai.gbk` | BA000007.2, with segment accessions AP002550-AP002569 |
| `brig_examples/BRIG_examples/Chapter7-sam-examples/S.aureus.Mu50-plasmid-AP003367.gbk` | AP003367.1 |
| `brig_examples/BRIG_examples/Chapter7-sam-examples/S.aureus.pSK57-plasmid-GQ900493.gbk` | GQ900493.1 |
| `brig_examples/BRIG_examples/Chapter7-sam-examples/S.aureus.SAP014A-plasmid-GQ900379.gbk` | GQ900379.1 |

NCBI policies: https://www.ncbi.nlm.nih.gov/home/about/policies/

## Original BRIG examples

`BRIGExample.fna`, `BRIGExample.graph`, `EHEC_vir.fna`, `SP-Sites.txt`, the example profile, and the files under `brig_examples/` come from the original BRIG demonstration/test set. They are retained to reproduce documented BRIG workflows and to prevent parser or rendering regressions.

Original BRIG project: https://github.com/happykhan/BRIG

Do not treat these snapshots as current reference records. Retrieve the current accession from NCBI or another authoritative source for scientific analysis.
