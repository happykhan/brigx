# Contributing to BRIGx

Thank you for your interest in contributing to BRIGx — a browser-based tool for generating BRIG-style circular genome comparison plots entirely in the browser using WebAssembly.

## Prerequisites

- **Node.js 24 LTS** (see `.nvmrc` and `.node-version`)
- **npm** (use the version bundled with Node.js 24)
- A modern browser for manual testing (Chrome or Firefox recommended)

## Getting Started

1. **Fork and clone the repository**

   ```bash
   git clone https://github.com/happykhan/BRIGx.git
   cd BRIGx
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Start the development server**

   ```bash
   npm run dev
   ```

   The app will be available at [http://localhost:3000](http://localhost:3000). Changes to source files are reflected immediately via hot reload.

## Running Tests

```bash
npm test
```

To run tests in watch mode (re-runs on file changes):

```bash
npm run test:watch
```

Tests live in `__tests__/` and use Jest with `jest-environment-jsdom`.

## Linting

```bash
npm run lint
```

Please ensure there are no new lint errors before opening a PR. Lint warnings for `@typescript-eslint/no-explicit-any` are acceptable in the short term but should be addressed progressively.

## Building

```bash
npm run build
```

BRIGx uses `next build` with static export (`output: 'export'`). The built output is placed in `out/`. Always verify the build succeeds before submitting a PR.

## Pull Request Process

1. Create a feature branch from `main`:

   ```bash
   git checkout -b feat/my-feature
   ```

2. Make your changes with focused, well-described commits.

3. Ensure tests pass (`npm test`) and lint is clean (`npm run lint`).

4. Verify the production build succeeds (`npm run build`).

5. Open a pull request against `main` on GitHub. Fill in the PR template with:
   - A clear description of what changed and why
   - Any relevant issue numbers (e.g. `Closes #42`)
   - Notes on manual testing performed

6. A maintainer will review your PR. Please respond to review comments promptly.

## Code Style

- **TypeScript** is used throughout. Avoid `any` types where possible — use proper interfaces or generics instead.
- **React** components live in `components/`. Use functional components with hooks; avoid class components unless implementing an error boundary.
- **Formatting**: The project does not currently enforce Prettier — aim for consistency with the surrounding code (2-space indentation, single quotes in TS/TSX).
- **Comments**: Comment non-obvious logic, especially in `lib/` where geometry and rendering code can be complex.
- **WASM/Workers**: WebAssembly binaries and web workers live in `public/` and `workers/` respectively. Changes here require extra care as they interact with browser APIs.

## Benchmarks

Development benchmark scripts (Python) live in `benchmarks/`. These are not part of the application and are not required for normal development.

## Reporting Bugs

Please use the GitHub issue tracker and fill in the bug report template. Include steps to reproduce, expected behaviour, and actual behaviour. Attaching sample FASTA/genome files (or a minimal reproducer) is very helpful.

## Feature Requests

Open a GitHub issue using the feature request template. Describe the use case, not just the implementation — this helps maintainers understand the need.
