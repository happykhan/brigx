# BRIGX product and interface contract

This document is an acceptance contract for the BRIGX website, browser application, and desktop application. It exists to keep the product visually specific, scientifically credible, and recognisably BRIGX.

## Product structure

| Surface | Route or entry point | Responsibility |
|---|---|---|
| Product website | `/` | Explain BRIGX and direct people to the web or desktop edition. |
| Browser application | `/app` | Run the complete local-first BRIGX scientific workflow in a browser. |
| Desktop downloads | `/download` | Publish versioned beta downloads and honest installation guidance. |
| About | `/about` | Record privacy, citation, licence, provenance, and third-party notices. |
| Desktop application | Tauri main window | Open the scientific workbench directly, without website chrome. |

The browser and desktop editions share the same TypeScript workbench, first-party renderer, integrity-checked BLAST WebAssembly modules, and tests. Their shells differ because their environments differ.

## Visual character

BRIGX should feel like a well-made scientific instrument: information-dense, calm, exact, and designed around the circular comparison figure. Use GenomicX tokens and shared components for identity, accessibility, and theme behaviour, but compose BRIGX pages specifically for this product.

Required:

- real BRIGX-rendered scientific output as the principal product image;
- an asymmetric, editorial landing-page composition;
- flat surfaces, fine rules, restrained corners, compact controls, and clear hierarchy;
- technical labels and values set in the GenomicX monospace stack where useful;
- light and dark themes, with the operating-system preference used on first visit;
- responsive layouts that remain useful without hiding core information;
- reduced-motion support and visible keyboard focus;
- British English in product copy and documentation.

Prohibited:

- gradients, glows, glass panels, floating blobs, and decorative background noise;
- giant centred slogans, bento grids, and repeated generic feature cards;
- stock illustrations, AI-generated artwork, fake screenshots, and fake metrics;
- excessive pills, excessive rounded corners, and ornamental icons;
- animation that does not explain state or direct attention;
- marketing claims that are not supported by the application or tests.

## Desktop behaviour

The desktop application uses the operating system title bar, native application menus, native file dialogs, and the system webview. It must not contain the website navigation, website footer, landing page, download page, or calls to visit the web application.

Its visible shell consists of:

1. a compact project toolbar;
2. a collapsible inspector containing inputs and parameters;
3. a plot workspace that consumes the remaining window area;
4. a status bar for processing state, project state, version, and platform.

The window title identifies the project, dirty state, BRIGX, and the Beta channel. Marketing, legal, documentation, and issue-reporting destinations belong in native menus.

## Release truthfulness

The hosted web application is the recommended edition. Windows packages are labelled **Beta — unsigned community build** until publisher signing is configured and clean-machine release checks pass. macOS packages are not publicly distributed until Developer ID signing and Apple notarisation are configured.

The download page must state the expected SmartScreen warning before a person downloads the Windows beta. Every published desktop beta must have:

- source and package version agreement;
- Windows x64 and Linux x64 packages;
- SHA-256 checksums;
- GitHub build-provenance attestations;
- an installation and limitation notice, including the macOS distribution hold;
- the GPL source corresponding to the tag.

Stable `v*` releases remain signing-gated. Unsigned beta tags use `desktop-beta-v*` and create GitHub prereleases.
Before upload, every stable macOS build must pass strict code-signature verification, Gatekeeper assessment, and notarisation-ticket validation for both the application bundle and DMG.
