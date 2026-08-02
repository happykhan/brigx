# Security policy

## Reporting a vulnerability

Do not open a public GitHub issue for a suspected security vulnerability. Email **nabil@happykhan.com** with a description, impact, reproduction steps, and any suggested mitigation. You should receive an initial response within five business days.

## Current security boundary

BRIGX is a static browser application with no authentication, server-side analysis, account storage, or file-upload endpoint. Its principal security surfaces are:

- parsing genome, annotation, graph, session, and compressed files supplied by the user;
- executing the bundled BLAST WebAssembly modules;
- browser rendering and export of user-controlled labels and metadata;
- the JavaScript package supply chain and production hosting.

BLAST assets are served from the BRIGX origin and checked against committed SHA-256 values before execution. Production hosting applies a restrictive Content Security Policy and related browser security headers. Dependencies are checked in CI with `npm run quality:licenses` and `npm run quality:security`.

## Audit exception

As of 2 August 2026, npm advisory 1124282 reports a high-severity React Router CSRF issue affecting React Server Components mode. BRIGX uses React Router only for static client-side navigation and has no React Server Components, actions, server rendering, or action endpoints, so the vulnerable execution path is absent. No patched version is currently published in the configured npm registry. The security check accepts only this exact advisory and fails if any other production advisory appears. Reassess this exception when a patched compatible release becomes available, or by 1 September 2026, whichever is earlier.
