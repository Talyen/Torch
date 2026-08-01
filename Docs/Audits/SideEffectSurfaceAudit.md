# Side-Effect Surface Audit

**Goal:** Confine browser I/O, shared mutation, renderer work, and non-deterministic primitives to designated Torch seams; keep pure simulation and data definitions free of them.

## Intent

Confirm unexpected effect ownership and fix violations using existing owners. A clean pass is valid. A new seam requires repeated confirmed violations, at least three current uses or an enforced boundary, and proposal approval per [README.md](README.md). If the scope is large, phase the plan.

## Hard stops

- Do not move the simulation onto wall-clock time, unseeded randomness, or a real-time loop to make presentation easier.
- Do not add a storage/network/audio/platform abstraction for a hypothetical future feature. The current client already has action-boundary persistence through `SaveProvider` and a local-storage provider; add another provider only for an approved platform requirement.
- Do not put DOM, Phaser, or browser APIs into `src/sim/**` or content definitions to avoid an existing owner. `src/content/*-assets.ts` may use Vite's `import.meta.env.BASE_URL` as a path-only bridge to generated public assets; keep that bridge out of rules and state.
- Teardown and listener-lifetime findings belong to `AsyncRaceAudit.md`; direct `GameState`/session writes belong to `BehaviorHardeningAudit.md` for transition impact or `StateGravityOwnershipAudit.md` for misplaced ownership.
- Do not treat `Date.now`/`performance.now` used by development diagnostics as gameplay entropy without confirming that the value crosses into simulation state.
- Generated asset writes belong to the asset pipeline; do not hand-edit `public/assets/` or `dist/`.

## Allowlisted seams

| Effect                                                              | Allowed owner                                                                                                                                                        |
| ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Deterministic command/state mutation                                | `src/sim/**`, reached through `applyCommand` in `src/sim/simulation.ts` and dispatched by `src/game/session.ts`                                                      |
| Browser preference storage and JSON decode                          | `src/game/presentation-settings.ts` and `src/game/input-bindings.ts`                                                                                                 |
| Save serialization and provider storage                             | `src/sim/world-save.ts`, `src/sim/profile-save.ts`, `src/game/save-provider.ts`, and `src/platform/local-save-provider.ts`; `GameSession` owns action-boundary calls |
| DOM event, focus, timer, and React lifecycle work                   | `src/ui/**`, `src/components/ui/**`, with cleanup in the owning effect                                                                                               |
| Phaser canvas, textures, tweens, resize, and pointer/keyboard input | `src/main.ts` and `src/game/scene.ts`                                                                                                                                |
| Session listeners and input mode                                    | `src/game/session.ts`                                                                                                                                                |
| CSS token bridge                                                    | `readCssColorToken` in `src/game/presentation-colors.ts`, called by the scene; keep color math pure                                                                  |
| Vite asset URL bridge                                               | `import.meta.env.BASE_URL` in `src/content/*-assets.ts`; path composition only, never gameplay state                                                                 |
| Frame timing and Long Task diagnostics                              | `src/dev/frame-monitor.ts`; development-only and never part of `GameState`                                                                                           |
| Asset reads/transforms and generated manifest writes                | `scripts/assets.config.mjs` and `scripts/process-assets.mjs`; source artwork under `Raw Assets/`                                                                     |
| Seeded generation                                                   | `unitRandom`/`hashCoordinates` in `src/sim/rng.ts`, consumed by deterministic world generation                                                                       |

`src/game/layout.ts`, most of `src/game/visibility.ts`, `src/game/presentation-colors.ts`, and all `src/sim/**`/`src/content/**` definitions should remain pure unless a function is explicitly documented as an integration bridge.

## Domain rules

- **Simulation:** `src/sim/**` must not read `window`, `document`, storage, network, renderer state, wall-clock time, or unseeded entropy. Gameplay randomness is derived from the seed, coordinates, and generation version.
- **Command routing:** UI and Phaser callbacks send typed `Command` values through `GameSession`; they must not mutate `GameState` fields directly.
- **Presentation:** `src/game/scene.ts` may own Phaser objects and browser listeners, but all listeners, tweens, and observers must have a scene-shutdown owner. React effects must return cleanup.
- **Preferences:** `localStorage` failures fall back to declared defaults and dispatch only a presentation event. They must not alter simulation determinism or world-local state.
- **Diagnostics:** frame monitor timestamps and Performance Timeline entries are observability only. Never feed them into action resolution, generation, or save data.
- **Asset pipeline:** asynchronous Sharp/file-system work is expected in `scripts/process-assets.mjs`; generated files are reproducible outputs and not runtime simulation inputs.
- **Network/platform:** the core game loop has no network request. The Playwright smoke flow may fetch `/assets/manifest.json` as a browser assertion; this is test infrastructure, not a simulation seam.

## Known signals

Optional discovery aids — choose probes that fit the candidate.

- **Entropy/time leaks:** `Math.random`, `Date.now`, `new Date(`, `crypto.randomUUID`, `crypto.getRandomValues`, other crypto entropy, or `performance.now` under `src/sim/**` or content definitions.
- **Browser API leaks:** `window`, `document`, `localStorage`, `sessionStorage`, `fetch`, `requestAnimationFrame`, or `addEventListener` in pure simulation, content, or rule helpers.
- **Direct state writes:** UI/scene modules assigning `gameSession.state`, Hero/entity fields, inventory, cooldown, or reveal data outside `GameSession`/`applyCommand`.
- **Global access in rules:** reading a singleton session, DOM, or renderer from `src/sim/**` instead of passing state and deterministic inputs.
- **Unowned Phaser/React effects:** `src/game/scene.ts` or `src/ui/**` listeners, timers, observers, or tweens that lack teardown or persist after the owner closes.
- **Generated-output writes:** runtime or source modules writing under `public/assets/`/`dist/` instead of the asset script.
- **UI rerolls:** unstable decorative values computed with randomness or time during React render rather than initialized once at the presentation owner.

## Matching verification

Use bounded searches and the closest tests first:

```bash
npm run typecheck
npm test -- tests/simulation.test.ts tests/visibility.test.ts tests/presentation-colors.test.ts tests/frame-monitor.test.ts
npm run check:theme
npm run verify
```

If an asset pipeline seam changes, include `npm run assets:build` and inspect only the expected generated outputs.
