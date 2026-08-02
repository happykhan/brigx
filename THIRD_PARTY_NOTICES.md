# BRIGX third-party notices

This notice covers software and data distributed with BRIGX or loaded by the production application. BRIGX itself is licensed under GPL-3.0; see `LICENSE`. Package versions are resolved from `package.json` at build time and checked by `npm run quality:licenses`.

## Bundled alignment assets

### NCBI BLAST Legacy 2.2.26

- Files: `public/wasm/blast/blastall.js`, `blastall.wasm`, `formatdb.js`, and `formatdb.wasm`
- Purpose: nucleotide database preparation and sequence alignment in the browser
- Status: NCBI states that BLAST source code is in the US public domain
- Source and terms: https://blast.ncbi.nlm.nih.gov/doc/blast-help/developerinfo.html
- Project: https://blast.ncbi.nlm.nih.gov/Blast.cgi

The JavaScript and WebAssembly files are served from the BRIGX origin and verified at runtime using the following SHA-256 values:

| File | SHA-256 |
|---|---|
| `blastall.js` | `1f9d7c8374d72cf03f5f2c2f81ba0e4c1ddeb2deb0bafa9ff08ca0541fddce0e` |
| `blastall.wasm` | `f7f4e1b6ee56625f2f42ef9d278c5f270a7ade09aef11753c3e248c007d2c139` |
| `formatdb.js` | `760874788a0e65458c32e86c578ca0b7e1eb983c046576b819382d05ddb042b2` |
| `formatdb.wasm` | `ab867d4eabccde92b4a1e2452d5156d2838f4e7051828104f50cf7a4dbc0df63` |

### Emscripten runtime

The BLAST JavaScript/WebAssembly output includes Emscripten runtime code. Emscripten is distributed under the MIT and University of Illinois/NCSA licences. See https://emscripten.org/docs/introducing_emscripten/emscripten_license.html.

## Production JavaScript packages

| Package | Purpose | Licence | Source |
|---|---|---|---|
| `@genomicx/ui` | Shared GenomicX user-interface components | GPL-3.0 | https://github.com/happykhan/genomicx-ui |
| `pako` | DEFLATE/GZIP decompression | MIT and Zlib | https://github.com/nodeca/pako |
| `react` | User-interface runtime | MIT | https://github.com/facebook/react |
| `react-dom` | Browser rendering for React | MIT | https://github.com/facebook/react |
| `react-hot-toast` | Status notifications | MIT | https://github.com/timolins/react-hot-toast |
| `react-router-dom` | Client-side navigation | MIT | https://github.com/remix-run/react-router |

The production application does not include Handsontable or LAST. BRIGX's annotation editor and circular renderer are first-party code.

## Desktop runtime

The optional desktop edition is packaged with Electron 43.2.0. That distribution includes Chromium 150 and Node.js 24.18.0, plus their transitive libraries. Electron is MIT-licensed; Chromium, Node.js, and their dependencies use several permissive open-source licences. Each packaged Electron distribution includes its complete `LICENSE` and `LICENSES.chromium.html` files.

| Component | Purpose | Licence and notices | Source |
|---|---|---|---|
| `electron` | Sandboxed desktop application runtime | MIT; bundled Chromium notices | https://github.com/electron/electron |
| Chromium | Rendering and Web Platform runtime | BSD-style and component-specific licences | https://www.chromium.org/Home/ |
| Node.js | Main-process runtime; not exposed to BRIGX web content | MIT and bundled third-party licences | https://github.com/nodejs/node |

Electron Forge, Electron Packager, Electron Fuses, esbuild, and the platform-specific makers are build-time tools. They are installed from the exact versions in `package-lock.json` and are not shipped as executable JavaScript inside the application archive. The fuses are applied to the packaged Electron executable during release builds.

## Build and test tooling

BRIGX is built and tested with open-source tools including TypeScript, Vite, Tailwind CSS, ESLint, Vitest, Testing Library, jsdom, Playwright, Electron Forge, Electron Fuses, and esbuild. Their package manifests and licence files are installed by npm for development and CI; except for the fuses applied to Electron, they are not production runtime dependencies.

## Example and test data

The repository contains public accessioned NCBI records and files from the original BRIG example set for regression testing. They are not included in the hosted application's production bundle. See `examples/README.md` for accession and provenance details.

## Marks and attribution

BLAST is a registered trademark of the US National Library of Medicine. BRIGX is not affiliated with or endorsed by NCBI, NLM, NIH, or any other third-party project listed here. All names and marks remain the property of their respective owners.
