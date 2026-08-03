# BRIGX desktop build and release guide

The desktop edition is a free, offline Tauri application around the same BRIGX renderer and integrity-checked BLAST WebAssembly engine used on the web. It has no accounts, payments, subscription checks, cloud storage, analytics, telemetry, advertising, or automatic update checks.

Tauri keeps the application small by using the operating system webview: WKWebView on macOS, WebView2 on Windows, and WebKitGTK on Linux. Node.js is used to build and test BRIGX, but is not bundled in or exposed to the desktop application. The WebAssembly BLAST engine is intentionally retained so the scientific pipeline remains identical across web and desktop.

## Supported release targets

- macOS: `.app` and `.dmg`, built separately for Apple silicon and Intel
- Windows: NSIS `.exe`; the small installer downloads the evergreen WebView2 bootstrapper only when the runtime is absent
- Linux: `.AppImage`, `.deb`, and `.rpm`

Development and release builds use Node.js 24 LTS and the Rust version pinned in `rust-toolchain.toml`:

```bash
npm ci
npm run desktop:dev
npm run desktop:test
npm run desktop:package
npm run desktop:make
```

Linux also requires the Tauri WebKitGTK development packages plus `fakeroot` and `rpm`. Packages must be built on their target operating system; `.github/workflows/desktop.yml` runs the supported matrix.

## Security architecture

- Production HTML, JavaScript, CSS, workers, and WASM are bundled locally. The main window never loads the hosted site or other remote code.
- The renderer receives a narrow, versioned BRIGX API. Tauri plugin APIs are not granted wholesale.
- Native file pickers return metadata and opaque random tokens, never raw paths. The Rust backend validates tokens, types, sizes, schemas, and hashes before reading or writing.
- Large genome inputs and exports cross IPC as binary data instead of JSON number arrays.
- Navigation and new webview creation are denied. Explicit HTTPS and `mailto:` links open through a scheme-checked native command.
- CSP permits WebAssembly compilation and blob workers required by BLAST, but blocks remote scripts, objects, frames, forms, and ordinary JavaScript evaluation in release builds.
- Camera, microphone, location, payment, and USB access are denied by policy.
- Test-only WebDriver commands and environment-controlled dialog queues compile only with the `e2e` Cargo feature; release builds do not include that feature or those permissions.
- Project, recovery, recent-project, and export writes use atomic replacement. Unix files created by BRIGX use mode `0600`.

Do not add remote application content, a generic shell command, broad filesystem scopes, arbitrary URL opening, or a catch-all Tauri permission.

## Project and recovery format

A `.brigx` project is versioned JSON containing:

- session settings, annotations, ring configuration, and image properties;
- completed plot and alignment output, when available;
- relative source paths when inputs are beside the project, otherwise absolute paths;
- source metadata and optional SHA-256 hashes.

Genome contents are not copied into the project. Opening a project validates its schema, regular-file status, individual and aggregate size limits, and stored hash before restoring an input. Missing or changed inputs are reported instead of silently substituted. The schema remains compatible with projects created by the earlier Electron prototype.

Meaningful unsaved changes create a debounced recovery snapshot in BRIGX's per-user application-data directory. A normal save clears it. The close guard offers Save, Discard, or Cancel. Project files and recovery snapshots can reveal local filenames and paths, so users should treat them as potentially sensitive.

## Licence material

Installers bundle `LICENSE`, `THIRD_PARTY_NOTICES.md`, and a generated `THIRD_PARTY_LICENSES.html` containing the licence texts for the locked Rust production graph. Regenerate the latter after any Cargo dependency change:

```bash
cargo install cargo-about --version 0.9.1 --locked --features cli
npm run licences:rust:generate
npm run quality:licenses
```

The About page links the main runtime projects and licences. BRIGX does not embed CGView.js or copy its source; the circular renderer and annotation table are first-party implementations.

## Release workflow

The Desktop GitHub Actions workflow:

1. runs Rust tests and the real Tauri/WASM scientific workflow on Linux;
2. builds each operating-system package from `Cargo.lock` and `package-lock.json`;
3. separates unsigned `desktop-beta-v*` prereleases from signing-gated stable `v*` releases;
4. requires and uses code-signing credentials for stable macOS and Windows releases;
5. validates that the tag and application versions agree;
6. records build-provenance attestations for tags;
7. uploads packages as workflow artifacts;
8. publishes an unsigned GitHub prerelease and `SHA256SUMS.txt` for a `desktop-beta-v*` tag, or creates a signed draft release for a `v*` tag.

Versions are changed deliberately in a tested pull request with `npm version <version> --no-git-tag-version`. BRIGX does not bump to an untested version after a merge.

### Zero-cost desktop beta

The public beta channel is explicitly an unsigned community build. Create a tag matching the package version, for example:

```bash
git tag desktop-beta-v0.7.0
git push origin desktop-beta-v0.7.0
```

The tag packages and immediately publishes a GitHub prerelease using `docs/DESKTOP_BETA_RELEASE.md`. macOS Gatekeeper and Windows SmartScreen warnings are expected and must be disclosed on both the website and release page. Linux packages distribute normally. Beta packages still receive checksums and GitHub build-provenance attestations.

Before publishing any release:

- verify every matrix job, package hash, and provenance attestation;
- install each artifact on a clean supported system and repeat a BLAST/project/export smoke test;
- confirm the tag identifies the exact corresponding GPL source;
- inspect the bundled BRIGX and third-party licence files;
- record the measured download and installed sizes in the release notes.

Before publishing a stable `v*` release, additionally configure `APPLE_ID`, `APPLE_PASSWORD` (or `APPLE_APP_SPECIFIC_PASSWORD`), `APPLE_TEAM_ID`, `APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`, and `KEYCHAIN_PASSWORD` with a Developer ID Application certificate, plus `WINDOWS_CERTIFICATE_BASE64` and `WINDOWS_CERTIFICATE_PASSWORD` with a trusted, valid Authenticode certificate containing its private key.

Signing credentials are never stored in this repository. Automatic updates remain deliberately excluded until BRIGX has a stable signed release channel.
