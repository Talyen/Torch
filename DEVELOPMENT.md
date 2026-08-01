# Torch Development

Torch is a browser-first Phaser client with a headless TypeScript simulation.
Keep changes focused and finish one coherent path at a time.

## Local development

```bash
npm install   # first checkout or dependency change
npm run dev   # Vite at 127.0.0.1:5173
```

Open the Vite URL rather than `index.html`; module and asset paths rely on the
development server.

## Verification

Use the checks closest to the change while iterating:

```bash
npm run format:check
npm run lint
npm run check:theme
npm run check:content
npm run typecheck:sim
npm run typecheck
npm test
npm run test:e2e -- --reporter=line
npm run test:e2e:prod -- --reporter=line
```

Run the complete local gate before handing off code, asset, configuration, or
workflow changes:

```bash
npm run verify
```

If port 4173 is occupied, use `TORCH_E2E_PORT=4174 npm run verify`. GitHub
Actions runs the same gate and uploads Playwright reports on browser failures.

Documentation-only changes do not need the full gate unless they change a
command or workflow. Never report a check as passed unless it ran.

## Where changes belong

- `src/sim/`: rules, state transitions, deterministic generation, selectors
- `src/game/`: session orchestration, input routing, Phaser presentation
- `src/ui/`: React HUD, menus, and dialogs
- `src/content/`: authored definitions and stable IDs
- `src/styles.css`: design tokens
- `Raw Assets/`: original artwork
- `public/assets/`: generated asset output

Simulation changes need a meaningful fixed-seed test. User-visible behavior
usually needs the closest Playwright assertion. Save changes need round-trip and
migration coverage. Update the owning product or architecture document when a
decision or runtime boundary changes.

## Assets

Add source artwork under `Raw Assets/`, then run:

```bash
npm run assets:build
```

Do not hand-edit generated assets or the manifest.

## Deployment and publishing

Vercel builds the repository-root Vite app with Node 22, `npm run build`, and
`dist` as the output. `main` deploys to production; other branches and pull
requests create previews. The full verification gate stays in GitHub Actions,
not the Vercel build.

The normal handoff is an unstaged working tree for review. Do not stage, commit,
push, create a branch, or open a pull request unless the user asks.
