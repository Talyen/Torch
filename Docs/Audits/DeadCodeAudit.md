# Dead Code & API Surface Audit

**Goal:** Remove clearly unused internal symbols and narrow unnecessary exports in Torch's TypeScript, React, Phaser, and asset-source code without deleting live entry points.

## Intent

Identify confirmed unused symbols and unnecessary APIs, then clean them up. A clean pass is valid. Prefer making an export module-private when the behavior remains useful inside its owner. A successful fix must report authored LOC, declarations, files, or exported API removed; moving the same surface is not dead-code reduction. Reachable twins or no-op shims with live callers belong to `DualPathRetentionAudit.md`. If the scope is large, phase the plan.

## Hard stops

- Preserve the Vite entry `index.html` → `src/main.ts`, the `Phaser.Game`/`TorchScene` registration, the React `#ui-root` mount, and any dynamic asset path or manifest key used by the client.
- Do not delete symbols referenced by Vitest tests, Playwright specs, test helpers, `src/sim/index.ts`, or content/asset registration merely because there is no nearby production import.
- Never hand-edit generated output under `public/assets/` or `dist/`. Remove an unused source definition from `scripts/assets.config.mjs`/`Raw Assets/` only after confirming references, then run `npm run assets:build`.
- Prove a candidate is not an entry point, an index/barrel export, an asset manifest ID, a CSS/DOM test selector, a Phaser texture key, or a dynamically chosen screen/action key before deleting it.
- A wildcard barrel re-export (`export *`) is not call-site evidence by itself. Inspect the re-exported symbol's imports, runtime registrations, type-only consumers, and stable module contract before narrowing or deleting it; preserve an intentional barrel boundary.
- Do not create an imagined dead-code tool or script. This checkout has no dedicated dead-code command; use the compiler, Vite, focused tests, and bounded call-site searches as evidence.
- Test fixtures and cross-cutting invariant suites may be intentionally independent of a one-to-one production file. Do not delete them for lacking app call sites.

## Domain rules

- `src/sim/index.ts` is the simulation export surface consumed by tests and renderer-facing modules. Narrow an export only after checking all `src/**` and `tests/**` imports.
- `src/sim/**` owns deterministic rules and helpers; `src/game/**` owns session/input/Phaser presentation; `src/ui/**` and `src/components/ui/**` own overlay UI; `src/content/**` owns stable content and asset IDs; `src/dev/**` is development-only instrumentation.
- `src/main.ts`, `index.html`, `vite.config.ts`, and `playwright.config.ts` are runtime/config entry points. Treat exported functions used only by a test as intentional until the test is revised or removed with the behavior.
- Asset source definitions in `scripts/assets.config.mjs` feed `scripts/process-assets.mjs`; generated manifest and images are outputs. Delete source entries and regenerate rather than editing generated files.
- Unused React state, Phaser token maps, event handlers, or content definitions require both call-site evidence and a check that the surface is not reached through a string ID, `data-testid`, CSS selector, or test assertion.
- A type-only export can still be part of the test or module contract. Verify with TypeScript and import search before narrowing it.

## Known signals

Optional discovery aids — choose probes that fit the candidate.

- **Call-site search:** `rg -n "\b(symbol)\b" src tests scripts` followed by inspection of imports, string IDs, and asset keys.
- **Compiler signal:** `npm run typecheck` with `noUnusedLocals` and `noUnusedParameters` enabled in `tsconfig.json`; treat a diagnostic as evidence to confirm, not permission to delete blindly.
- **Unused exports:** exported functions/types/constants in `src/**` with no import or runtime registration outside their defining module.
- **Unread UI state:** `useState`/`useRef`/derived values written but never rendered, used in an effect, or passed to a callback.
- **Uncalled local helpers:** private functions in `src/game/scene.ts`, `src/ui/**`, or simulation modules with no call sites after accounting for callbacks and method references.
- **Empty tests:** test files with no test cases; confirm whether they are intended scaffolding before removal.
- **Asset/catalog orphans:** IDs in `scripts/assets.config.mjs` or `src/content/*-assets.ts` with no source, manifest, scene preload, UI use, or test assertion.
- **Generated-output mismatch:** after source cleanup, run `npm run assets:build` and inspect the manifest diff; never “fix” the generated file by hand.

## Matching verification

Run the cheapest checks covering the deleted surface, then the normal gate for a shipped fix:

```bash
npm run typecheck
npm test
npm run build
npm run test:e2e -- --reporter=line
npm run verify
```

For asset-source changes, include `npm run assets:build` before `npm run build`. Report the measured reduction and any intentionally retained export or fixture.
