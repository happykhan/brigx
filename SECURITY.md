# Security Policy

## Reporting a Vulnerability

Please **do not** open a public GitHub issue for security vulnerabilities.

Instead, email **nabil@happykhan.com** with:

- A description of the vulnerability and its potential impact
- Steps to reproduce or a proof-of-concept
- Any suggested mitigations (optional)

You will receive a response within 5 business days. Once confirmed, a fix will be released as soon as practicable and the reporter credited (unless anonymity is requested).

## Scope

BRIGx runs entirely in the browser — no server-side code, no data upload, no authentication. The main security surface is:

- **Client-side file parsing** (FASTA, GenBank, GFF3, SAV, graph files supplied by the user)
- **WASM binaries** (BLAST, minimap2) fetched from a CDN on first load
- **CDN-hosted resources** (biowasm, phylocanvas.gl)

Dependencies are tracked in `package.json`. Please report supply-chain concerns (malicious packages, compromised CDN assets) via the contact above.
