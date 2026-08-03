# BRIGX third-party notices

This notice covers software and data distributed with BRIGX or loaded by the production application. BRIGX itself is licensed under GPL-3.0; see `LICENSE`. JavaScript and Rust versions are locked in `package-lock.json` and `src-tauri/Cargo.lock` and checked by `npm run quality:licenses`.

## Bundled alignment assets

### NCBI BLAST Legacy 2.2.26

- Files: `public/wasm/blast/blastall.js`, `blastall.wasm`, `formatdb.js`, and `formatdb.wasm`
- Purpose: nucleotide database preparation and sequence alignment in the browser or desktop webview
- Status: NCBI states that BLAST source code is in the US public domain
- Source and terms: https://blast.ncbi.nlm.nih.gov/doc/blast-help/developerinfo.html
- Project: https://blast.ncbi.nlm.nih.gov/Blast.cgi

The JavaScript and WebAssembly files are served from the BRIGX application origin and verified at runtime using these SHA-256 values:

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
| `@genomicx/ui` | Shared GenomicX interface components | GPL-3.0 | https://github.com/happykhan/genomicx-ui |
| `@tauri-apps/api` | Typed desktop IPC and event client | MIT or Apache-2.0 | https://github.com/tauri-apps/tauri |
| `pako` | DEFLATE/GZIP decompression | MIT and Zlib | https://github.com/nodeca/pako |
| `react` | User-interface runtime | MIT | https://github.com/facebook/react |
| `react-dom` | Browser/webview rendering | MIT | https://github.com/facebook/react |
| `react-hot-toast` | Status notifications | MIT | https://github.com/timolins/react-hot-toast |
| `react-router-dom` | Client-side navigation | MIT | https://github.com/remix-run/react-router |

The circular renderer and editable annotation table are original BRIGX code.

## Desktop runtime

The desktop edition uses Tauri 2 and a Rust backend. Tauri is dual-licensed under MIT or Apache-2.0. The application links additional permissively licensed Rust crates. Each desktop package includes `THIRD_PARTY_LICENSES.html`, generated from the locked production graph with cargo-about, containing crate names, versions, source links, and full applicable licence texts.

| Component | Purpose | Licence or terms | Source |
|---|---|---|---|
| Tauri | Native application and IPC runtime | MIT or Apache-2.0 | https://github.com/tauri-apps/tauri#license |
| WKWebView | macOS system webview; not bundled by BRIGX | Apple operating-system component | https://developer.apple.com/documentation/webkit/wkwebview |
| Microsoft Edge WebView2 | Windows system webview; evergreen runtime/bootstrapper | Microsoft terms and component notices | https://developer.microsoft.com/en-us/microsoft-edge/webview2/ |
| WebKitGTK | Linux system webview; supplied by the distribution | LGPL-2.1-or-later and component-specific terms | https://webkitgtk.org/ |

Unlike the earlier prototype, BRIGX does not ship Electron, Chromium, or Node.js inside the application. The exact system-webview version varies with the operating system and its updates.

## Build and test tooling

BRIGX is built and tested with open-source tools including Rust, cargo-about, Tauri CLI, TypeScript, Vite, Tailwind CSS, ESLint, Vitest, Testing Library, jsdom, Playwright, WebdriverIO, and the debug-only Tauri WebDriver plugins. These tools are development dependencies; WebDriver plugins and permissions are compiled only into the dedicated E2E build and are not present in release packages.

## Example and test data

The repository contains public accessioned NCBI records and files from the original BRIG example set for regression testing. They are not included in the hosted application's production bundle. See `examples/README.md` for accession and provenance details.

## Marks and attribution

BLAST is a registered trademark of the US National Library of Medicine. BRIGX is not affiliated with or endorsed by NCBI, NLM, NIH, Tauri, Microsoft, Apple, WebKitGTK, or any other third-party project listed here. All names and marks remain the property of their respective owners.
