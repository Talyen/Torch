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

For Phaser presentation changes, verify both the logical canvas bounds and its
backing density in the browser: `canvas.width / canvas.clientWidth` should track
the capped device-pixel ratio (currently 1–2×), while board geometry and pointer
actions remain in CSS-pixel coordinates.

Development builds include a temporary Card Animation Lab in the upper-left UI
overlay. It exposes exactly two source bundles, `trinket` and `alchemy`; the
selected bundle controls the real contextual hand's hand, hover, reflow, draw,
discard, and play phases. The lab is not rendered in production previews and
does not persist its selection. Draw/discard pile anchors are presentation-only
visual endpoints because Torch's simulation does not model a deck.

## Verification

`npm run check:ui-system` enforces the React UI primitive boundary. It rejects
feature-local Base UI imports, native selects, raw feature colors, unnamed
transition shorthands, and direct feature buttons that bypass Torch's shared
components. It also checks the required body, muted, control, selected, and
gold token contrast pairs. `npm run verify` includes this check.

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

Commits automatically run Prettier and ESLint on staged JavaScript and
TypeScript files through the Husky pre-commit hook. Staged JSON, CSS, Markdown,
HTML, and YAML files receive the same Prettier check. The hook is intentionally
limited to staged files so commits stay fast; it does not replace the complete
verification gate below. `npm install` and `npm ci` install the hook through
the repository's `prepare` script. If the hook needs to be restored manually,
run `npm run prepare`.

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

The browser composition root creates the `GameRuntime` with its platform save
provider and awaits `boot()` before mounting input-capable clients. React and
Phaser receive the hydrated runtime through injection. Tests may construct
multiple runtimes directly; they should call `flushPersistence()` before
asserting asynchronous save state.

## Assets

Add source artwork under `Raw Assets/`, then run the owning pipeline script:

```bash
npm run assets:build
```

`npm run assets:build` invokes `scripts/process-assets.mjs`, which writes the
generated assets and `public/assets/manifest.json`. Do not hand-edit generated
assets or the manifest.

## Deployment and publishing

Vercel builds the repository-root Vite app with Node 22, `npm run build`, and
`dist` as the output. `main` deploys to production; other branches and pull
requests create previews. The full verification gate stays in GitHub Actions,
not the Vercel build.

The normal handoff is an unstaged working tree for review. Do not stage, commit,
push, create a branch, or open a pull request unless the user asks.
