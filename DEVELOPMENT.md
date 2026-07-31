# Torch Development Workflow

Torch is intentionally developed as a browser-first Phaser client with a
headless TypeScript simulation. Keep feature work narrow and prove one complete
path before adding a large content family.

## Daily loop

```bash
npm install                 # first checkout only
npm run dev                 # Vite development server at 127.0.0.1:5173
```

Open the Vite URL rather than `index.html` directly. The Phaser module and
generated asset paths rely on the development server.

## Vercel deployment

Torch is deployed as a Vite static client through the repository's Vercel Git
integration. Keep the Vercel project rooted at the repository root with the
Vite framework preset, `npm run build` as the build command, and `dist` as the
output directory. The repository pins Node.js to `22.x`, matching the GitHub
Actions workflow.

Pushes to `main` are production deployments; pull requests and other branches
are preview deployments. The Vercel build should run `npm run build`, not
`npm run verify`: browser installation and the full Playwright gate remain in
GitHub Actions. `vercel.json` provides the SPA fallback for future URL-based
screens while preserving the generated static asset paths.

## Publishing

The default handoff is a verified working tree for the user to review. Agents
must not stage, commit, push, create branches, or open pull requests unless the
user explicitly requests that publishing action. When publishing is requested,
the solo-developer default is a direct push to `main`; GitHub Actions remains
the hosted safety gate.

## Verification

Run the focused checks while iterating:

```bash
npm run check:theme
npm run typecheck
npm test
npm run test:e2e -- --reporter=line
```

Run the complete local gate before handing off a change:

```bash
npm run verify
```

`verify` first checks the Gold/Charcoal UI token contract, then runs TypeScript
checking, headless tests, the production build, and the Playwright browser
smoke suite. The development-only FPS monitor may log
browser long-task warnings during automated browser work; those warnings are
diagnostic and should be investigated separately from test failures.

If another local app is already using port 4173, isolate the Playwright server
with `TORCH_E2E_PORT=4174 npm run verify`.

GitHub Actions runs the same `npm run verify` gate on pushes to `main` and
agent branches and on every pull request. The workflow installs Chromium with
its system dependencies and uploads Playwright reports when a browser check
fails.

## Change boundaries

- Put rules, state transitions, seeded generation, and deterministic helpers in
  `src/sim/`. They must not import Phaser, React, or browser APIs.
- Put session orchestration and input routing in `src/game/`.
- Keep Phaser world presentation in `src/game/scene.ts` and pure presentation
  math in neighboring modules.
- Keep React menus and HUD in `src/ui/`, using tokens from `src/styles.css`.
- Keep authored data and stable IDs in `src/content/`; do not make content
  definitions import UI components.
- Keep original artwork under `Raw Assets/`. Generated files under
  `public/assets/` are disposable pipeline outputs.

For a simulation change, add a fixed-seed unit test. For a visible client
change, add or update a Playwright smoke assertion. If a product or runtime
boundary changes, update `README.md`, `ARCHITECTURE.md`, or `ROADMAP.md` in the
same change.

## Assets

Add source artwork under the appropriate `Raw Assets/` content directory, then
run:

```bash
npm run assets:build
```

The pipeline preserves raw files, emits intentional variants, and rewrites
`public/assets/manifest.json`.
