# Security policy

## Reporting a vulnerability

Do not open a public GitHub issue for a suspected security vulnerability. Email **nabil@happykhan.com** with a description, impact, reproduction steps, and any suggested mitigation. You should receive an initial response within five business days.

## Current security boundary

BRIGX is a static web application and an offline Electron application with no authentication, server-side analysis, account storage, telemetry, or file-upload endpoint. Its principal security surfaces are:

- parsing genome, annotation, graph, session, and compressed files supplied by the user;
- executing the bundled BLAST WebAssembly modules;
- browser rendering and export of user-controlled labels and metadata;
- the JavaScript package supply chain and production hosting.
- desktop project paths and recovery snapshots;
- the Electron main/preload IPC boundary and packaged application integrity.

BLAST assets are served from the BRIGX application origin and checked against committed SHA-256 values before execution. Production hosting and the desktop protocol apply a restrictive Content Security Policy and related browser security headers. JavaScript evaluation is disabled; CSP grants the narrower WebAssembly compilation capability. Dependencies are checked in CI with `npm run quality:licenses` and `npm run quality:security`.

The desktop renderer is sandboxed and context-isolated with Node integration disabled. Its versioned preload exposes only allowlisted project and export operations. IPC callers and external navigation are checked, permissions are denied, application code is stored in ASAR, and release fuses disable Node execution and debugging environment overrides. `.brigx` files store local paths and hashes but not genome contents; treat project and recovery files as potentially sensitive.

## Audit exception

As of 2 August 2026, npm advisory 1124282 reports a high-severity React Router CSRF issue affecting React Server Components mode. BRIGX uses React Router only for static client-side navigation and has no React Server Components, actions, server rendering, or action endpoints, so the vulnerable execution path is absent. No patched version is currently published in the configured npm registry. The security check accepts only this exact advisory and fails if any other production advisory appears. Reassess this exception when a patched compatible release becomes available, or by 1 September 2026, whichever is earlier.
