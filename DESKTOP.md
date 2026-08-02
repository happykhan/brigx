# BRIGX desktop build and release guide

The desktop edition is a free, offline Electron shell around the same BRIGX renderer and integrity-checked BLAST WebAssembly engine used on the web. It has no accounts, payments, subscription checks, cloud storage, analytics, telemetry, advertising, or automatic network update checks.

## Supported release targets

- macOS: `.dmg` and `.zip`
- Windows: Squirrel installer
- Linux: `.deb`, `.rpm`, and `.zip`

Development and release builds require Node.js 24 LTS. Use the committed lockfile:

```bash
npm ci
npm run desktop:dev
npm run desktop:test
npm run desktop:package
npm run desktop:make
```

Linux packaging additionally needs `fakeroot` and `rpm`. Each installer must be built on its target operating system; `.github/workflows/desktop.yml` runs the complete matrix.

## Security architecture

- Packaged renderer files are served from the standard, secure `brigx://app/` protocol inside the application archive. No production window loads the hosted website or other remote code.
- Renderer Node integration is disabled. Context isolation, Chromium sandboxing, web security, and the Electron application sandbox are enabled.
- The preload exposes only versioned, typed project/export operations. It does not expose `ipcRenderer`, `fs`, shell commands, raw filesystem paths, or arbitrary IPC.
- All renderer IPC calls are checked against the trusted BRIGX origin. File references opened by the main process return opaque tokens.
- Window creation and in-app navigation are denied. User-initiated HTTPS and `mailto:` links open in the operating system browser or mail application.
- Camera, microphone, location, payment, and USB permissions are denied.
- CSP blocks JavaScript evaluation. Verified BLAST module bytes are imported through an in-memory module URL, and the narrower `wasm-unsafe-eval` capability permits WebAssembly compilation.
- Release packages use ASAR and Electron fuses to disable `ELECTRON_RUN_AS_NODE`, Node CLI inspection and `NODE_OPTIONS`, enforce embedded ASAR integrity, and load application code only from ASAR.

Do not add remote content, arbitrary filesystem APIs, broad shell access, or a generic IPC bridge.

## Project and recovery format

A `.brigx` project is versioned JSON containing:

- session settings, annotations, ring configuration, and image properties;
- completed plot and alignment output, when available;
- relative source paths when the inputs are beside the project, otherwise absolute paths;
- source metadata and optional SHA-256 hashes.

Genome contents are not copied into the project. Opening a project validates its schema, file size, and stored hash before restoring any input. Missing or changed inputs are reported instead of silently substituted. Saves use a temporary file and atomic rename. Per-file, total-input, and project-manifest size limits bound resource use.

Unsaved meaningful changes create a debounced recovery snapshot in Electron's per-user application-data directory. A normal project save clears it. The close guard offers Save, Discard, or Cancel. Project files and recovery snapshots can reveal local filenames and paths; users should treat them as potentially sensitive.

## Release workflow

The Desktop GitHub Actions workflow:

1. runs the real Electron scientific workflow under Linux;
2. builds each supported operating-system package from `package-lock.json`;
3. applies macOS signing/notarisation when the Apple secrets are present;
4. records build-provenance attestations for tags;
5. uploads packages as workflow artifacts;
6. creates a draft GitHub release with every package and `SHA256SUMS.txt` for a `v*` tag.

Before publishing a draft release:

- verify every matrix job and provenance attestation;
- sign and notarise macOS packages with `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, and `APPLE_TEAM_ID` repository secrets;
- configure and verify `WINDOWS_CERTIFICATE_BASE64` and `WINDOWS_CERTIFICATE_PASSWORD` repository secrets for a trusted Windows code-signing certificate;
- install each artifact on a clean machine and repeat a BLAST/project/export smoke test;
- confirm the release tag identifies the exact corresponding GPL source;
- review bundled `LICENSE`, `THIRD_PARTY_NOTICES.md`, Electron `LICENSE`, and `LICENSES.chromium.html`.

Unsigned local packages are suitable for development testing only. Do not present them as a production release. Code-signing credentials are intentionally not stored in the repository.

Automatic updates are deliberately excluded from the first release: a secure updater requires stable signed artifacts and a trusted release channel. Users can download reviewed releases manually without the application making background network requests.
