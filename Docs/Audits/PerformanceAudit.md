# Performance Audit

**Goal:** Fix confirmed runtime and payload performance problems in the Phaser 4 board, React 19 overlay, Vite asset pipeline, and browser client without speculative memoization or degrading intentional presentation.

## Intent

Confirm a cost with evidence — the development frame monitor, a browser Performance trace, Playwright timing/trace evidence, a reproducible hitch, or a `vite build` output regression — before changing code. A clean pass is valid. Do not invent frame-time or bundle-size CI gates; compare run-over-run and fix confirmed regressions through existing owners. Significant architecture changes (workers, virtualization frameworks, alternate render pipelines) remain proposals per [README.md](README.md). If the scope is large, phase the plan.

Torch’s development monitor samples a rolling two-second `requestAnimationFrame` window and exposes `window.__torchPerf`. It reports average FPS, p50/p99 frame time, one-percent-low FPS, max frame time, frame-budget misses, stutters, overlapping Long Tasks, Phaser loop delta, and measured `scene.render`/`simulation` phases. A monitor attribution is diagnostic evidence, not proof of GPU, browser, OS, or thermal causality; confirm those with a browser trace or real-device profile as [ARCHITECTURE.md](../../ARCHITECTURE.md) requires.

## Hard stops

- Eager Phaser preload of the Knight and Forest Slime marker textures and synchronous initial terrain/entity generation are intentional for the current slice. Boot asset weight alone is not a finding; investigate a regression against `npm run build` output or a startup trace.
- Do not add memoization wrappers, broad selectors, or object pools by reflex. First capture render/frame evidence and preserve the existing simulation, visibility, and interaction contracts.
- Do not degrade intentional presentation — the Action Hand’s 3:4 fan/card-play feedback, tile movement tween, directional fog reveal, entity dissolve, and responsive React focus/dismissal behavior — without a measured dropped-frame or long-task trace on that surface.
- Do not hand-edit `public/assets/`, `dist/`, or `public/assets/manifest.json`. Change `Raw Assets/`, `src/content/`, or `scripts/process-assets.mjs`, then run `npm run assets:build`/`npm run build`.
- Do not move deterministic simulation work into a worker or introduce a new renderer unless [ARCHITECTURE.md](../../ARCHITECTURE.md) is explicitly changed and the proposal is approved.
- Do not treat Vitest headless timings as Phaser frame evidence. Use Vitest for deterministic calculations and monitor logic, not browser GPU claims.

## Domain rules

### Phaser frame cost

Inspect `src/game/scene.ts` and pure presentation helpers in `src/game/` for bounded work per frame. The current contract caches terrain geometry, reuses pooled fog/grid rectangles, keeps active entity tokens mounted while they dissolve, destroys tokens whose entities leave state, and redraws terrain only when the camera tile, viewport, tile size, seed, or grid preference changes. A candidate requires evidence of repeated geometry rebuilds, display-list churn, renderer uploads, or long tasks during movement/reveal — not a code smell alone.

### React overlay churn

`src/ui/` owns semantic menus/HUD and `src/components/ui/` owns shared styled primitives. `GameSession` publishes action-boundary snapshots; React should not poll or subscribe to Phaser’s render loop. Confirm broad state updates with a React/browser trace or visible interaction timing before narrowing state or adding memoization. Route focus, keyboard dismissal, input gating, and pointer/hold correctness findings to `UIInteractionFeedbackAudit.md`; keep this audit focused on measured render/layout cost.

### Simulation and session

`src/sim/` resolves deterministic commands; `src/game/session.ts` measures the `simulation` phase and notifies listeners after an action boundary. Do not optimize by skipping command validation, mutating state from a renderer callback, or changing one-tile action semantics. Compare a fixed seed and command transcript before/after any performance change to prove behavior is unchanged.

### Payload and assets

`scripts/process-assets.mjs` (Sharp) owns optimized variants and the generated manifest. Compare `npm run build` output with the previous run and trace a regression to a source asset, variant, import, or dependency. Movement must not be the first place an asset is requested; the current prototype preloads static art and prewarms a bounded ring.

## Known signals

Optional discovery aids — choose probes that match the suspected owner.

- **Frame evidence:** start the Vite client with `npm run dev`, reproduce a bounded movement/reveal/menu flow, capture `window.__torchPerf` after the two-second window, and record p50/p99, one-percent-low, misses, stutters, longest phase, Phaser loop delta, and Long Tasks. Compare the same seed, viewport, and action sequence across runs.
- **Browser trace:** use Chrome DevTools Performance or a Playwright trace around `tests/e2e/first-light.spec.ts`; look for long tasks, dropped-frame clusters, layout/style work, canvas uploads, and React commits. Playwright tracing is configured on first retry, but retries are not configured by default; enable them explicitly for a diagnostic run. Tracing is evidence collection, not a permanent performance gate.
- **Scene churn:** inspect `src/game/scene.ts` for `clear`/rebuild loops, new Phaser display objects during a tile move, fog/grid pool growth, or entity destroy/create cycles for entities that remain in state. Destroying a token when its entity is defeated or otherwise removed is expected; confirm repeated churn with the monitor and renderer trace before changing the pool contract.
- **React churn:** reproduce HUD/menu updates while the board is animating and inspect React commits and DOM/layout work. Broad `gameSession` listener updates are a candidate only when the trace shows unrelated screens or large lists repainting.
- **Long tasks and scheduling:** correlate monitor phase timings with Long Task entries. If no measured phase explains a hitch, label it browser/OS/GPU/uninstrumented and use a browser or device profile rather than guessing at a source-level fix.
- **Build payload:** run `npm run build` and compare emitted asset/chunk sizes and warnings with a baseline. Trace large changes to source imports, `src/content/` asset references, or the Sharp pipeline; do not impose an absolute size threshold.
- **Asset requests:** inspect the browser network panel during movement and reveal. A new request on a move is a finding only if it violates the loading/warmup contract; generated manifest changes must come from the pipeline.
- **Development-only overhead:** `src/dev/frame-monitor.ts` and its `PerformanceObserver` are disabled in production. Measure production builds separately before treating monitor overhead as a shipped regression.
- **Production evidence:** run `npm run build`, serve the artifact with `npm run preview`, and reproduce the same bounded flow before attributing shipped behavior to the Vite dev server or development monitor.

## Matching verification

- Phaser or frame change: `npm run build`, a focused Playwright reproduction (`npm run test:e2e -- tests/e2e/first-light.spec.ts --reporter=line`), and before/after `window.__torchPerf`/trace evidence.
- React/input change: closest focused Playwright spec plus `npm run typecheck`; add a Vitest test only for pure selectors/calculations.
- Simulation change: `npm test -- tests/simulation.test.ts` or the closest fixed-seed file, then confirm the same command transcript and events.
- Asset/payload change: `npm run assets:build` and `npm run build`; inspect generated output rather than editing it.
- Cross-layer change: `npm run verify` (use `TORCH_E2E_PORT=4174` if port 4173 is occupied).

Report the reproduction, baseline and after metrics, trace/monitor evidence, changed owner, payload delta when relevant, and any real-device or browser tooling limitation. A clean pass is a valid result.
