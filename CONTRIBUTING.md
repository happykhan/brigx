# Contributing to BRIGX

BRIGX is a local-first React, TypeScript, WebAssembly, and Electron application. Contributions are welcome through GitHub issues and pull requests.

## Prerequisites

- Node.js 24 LTS, matching `.nvmrc` and `.node-version`
- npm bundled with Node.js 24
- Chromium for browser end-to-end tests
- The platform packaging tools listed in `DESKTOP.md` when building installers

Install the committed dependency graph with:

```bash
npm ci
```

Do not replace `package-lock.json` with an unreviewed dependency resolution.

## Development

```bash
npm run dev             # Web app at http://localhost:5173
npm run desktop:dev     # Electron shell with hot reload
```

The web and desktop editions share the renderer and the BLAST WebAssembly engine. Keep browser-only and Electron-only behaviour behind the narrow `window.brigxDesktop` bridge; renderer code must never import Electron or Node.js runtime modules.

## Verification

```bash
npm run lint
npm run quality:architecture
npm run quality:licenses
npm run quality:security
npm test
npm run build
npm run test:e2e
npm run desktop:test
npm run desktop:package
```

`npm run verify` covers the web release gates. `npm run verify:desktop` covers the Electron workflow and current-platform package. `npm run verify:all` runs both.

Tests live in `__tests__/`, `tests/e2e/`, and `tests/electron/`. Changes to file parsing, rendering, workers, project persistence, preload IPC, CSP, or packaging require regression coverage at the appropriate layer.

## Pull requests

1. Branch from `master`.
2. Keep commits focused and explain the user-visible or scientific effect.
3. Run the relevant verification commands above.
4. Open a pull request against `master` and include testing evidence.
5. Do not commit secrets, signing credentials, private genome data, generated packages, or test reports.

Use functional React components and strict TypeScript types. Preserve the Electron defaults of sandboxing, context isolation, no renderer Node integration, denied permissions, and allowlisted IPC. Do not weaken CSP or expose filesystem paths to the renderer without a documented security review.

## Data and bug reports

Never attach confidential, embargoed, patient-identifiable, or otherwise sensitive genome data. Use a minimised, synthetic, or public reproducer and remove sensitive local paths from `.brigx` files before sharing them.

## Licence and notices

BRIGX is GPL-3.0. New runtime dependencies need an approved entry in `scripts/check-licenses.mjs`, a notice in `THIRD_PARTY_NOTICES.md`, and an About-page disclosure when applicable. Release packages must retain the BRIGX licence, third-party notices, Electron licence files, and a link to the exact corresponding source tag.
