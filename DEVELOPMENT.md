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

## Publishing

Torch uses a solo-developer, direct-to-`main` workflow by default. After
reviewing the intended diff and running `npm run verify`, commit the change on
`main` and push it with `git push origin main`. GitHub Actions is the hosted
safety gate. Use a branch or pull request only for an explicitly requested
review boundary, risky experiment, or outside collaboration.

## Verification

Run the focused checks while iterating:

```bash
npm run typecheck
npm test
npm run test:e2e -- --reporter=line
```

Run the complete local gate before handing off a change:

```bash
npm run verify
```

`verify` runs TypeScript checking, headless tests, the production build, and
the Playwright browser smoke suite. The development-only FPS monitor may log
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
