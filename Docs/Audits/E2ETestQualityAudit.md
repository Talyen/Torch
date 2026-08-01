# E2E Test Reliability & Signal Audit

**Goal:** Improve confirmed Playwright reliability, signal, and scope without
weakening the browser contract for the Torch vertical slice.

The browser test owner is `tests/e2e/`. Configuration and server behavior live
in [`playwright.config.ts`](../../playwright.config.ts), while the workflow is
defined in [`DEVELOPMENT.md`](../../DEVELOPMENT.md). Torch is a Vite-hosted
Phaser canvas with a sibling React overlay; this audit targets the configured
specs directly and does not assume extra harness layers.

## Intent

Confirm reliability and tier-fit candidates in the existing Playwright specs,
then prefer delete → merge → replace with a deterministic assertion → shorten.
Add a helper or page object only when at least three current call sites become
clearer, or when it establishes a real shipping boundary. If the scope is
large, phase it by flow (shell/menu, collection surfaces, action hand).

The current browser suite is intentionally small:

- `tests/e2e/first-light.spec.ts` owns the end-to-end vertical slice,
  responsive Hero/Abilities checks, menu/input-mode behavior, persistence, and
  Action Hand feedback.
- `tests/e2e/theme.spec.ts` owns the Gold/Charcoal token contract across menu,
  settings, inventory, and equipment surfaces.
- `tests/e2e/crafting.spec.ts` owns the gathered-resource → crafting → Inventory
  journey and station-gating copy.
- `tests/e2e/loadout.spec.ts` owns responsive canonical Gear/Tools containment
  and hit-area checks.

Do not duplicate assertions across these owners merely to increase test count.

## How Torch runs E2E

- Specs use raw `@playwright/test`; Chromium is the only configured project.
- `playwright.config.ts` runs one worker and disables full parallelism because
  Phaser owns a real render loop. This is an intentional anti-noise boundary,
  not a reason to invent per-feature workers.
- The web server is `npm run dev -- --host 127.0.0.1 --port <port>` and the
  base URL is `http://127.0.0.1:<port>`. The default E2E port is `4173`; set
  `TORCH_E2E_PORT=4174` when that port is occupied.
- `npm run test:e2e -- --reporter=line` runs the browser suite. `npm run verify`
  runs theme checking, typecheck, Vitest, build, and this suite.

## Hard stops

- Do not invent wall-clock budgets, CI tags, or extra test tiers that are not
  configured in Torch.
- Do not add dev-only shortcuts such as Skip Combat or Unlock All. Exercise the
  seeded starting world and real `gameSession` input/command path.
- Do not expand this audit into Vitest portfolio cleanup; use
  `UnitTestAudit.md` for `tests/*.test.ts`.
- Do not weaken Action Hand animation assertions solely to remove a wait. The
  card's play/replacement state is a product contract; replace fixed waits with
  a stable state assertion only when the state is observable.
- Do not change `data-testid` contracts casually. If a test and semantic owner
  move together, prefer role/name/state selectors for new assertions.

## Reliability and signal rules

| Priority | Torch candidate                                                    | Preferred correction                                                                                                            |
| -------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| P0       | Browser crash, unhandled runtime error, or harness failure         | Reproduce the spec in isolation; fix the boundary and keep the failure visible                                                  |
| P1       | Flake from render-loop timing, asset readiness, or animation state | Wait for a semantic locator/state (`expect`, `waitForFunction`) rather than a blind delay; preserve the product timing contract |
| P1       | Multi-step flow fails because a prior test leaks state             | Keep each test on a fresh `page.goto('/')`; avoid shared mutable module state and order dependence                              |
| P2       | Brittle selector or geometry check                                 | Prefer role, accessible name, `data-testid`, and explicit state; retain `evaluate` only for geometry/aspect-ratio contracts     |
| P2       | Duplicate flow/assertion across specs                              | Keep one semantic owner and delete the weaker copy                                                                              |
| P3       | Unclear naming or noisy diagnostics                                | Use flow-oriented test names; collect traces/screenshots during an explicitly configured retry or diagnostic run                |

## Domain rules

- The seeded initial state is created by `GameSession`; reload the page to reset
  the browser flow rather than adding a test-only reset API.
- Opening a React menu changes the session input mode to `ui`; browser tests
  should prove world input is blocked while the dialog is open and restored on
  close when that behavior is in scope.
- Action Hand tests should exercise the real card (`Chop`, `Bash`, `Sunder`,
  `Avatar`) and its `is-playing`/replacement behavior. Simulation outcome
  assertions belong in `tests/simulation.test.ts`.
- Responsive UI checks should use the four viewport contracts exercised by
  `tests/e2e/first-light.spec.ts` (1280×720, 1170×624, 390×844, and 320×568),
  matching the short-desktop and narrow-mobile guidance in `DESIGN_SYSTEM.md`;
  do not add device-project assumptions that are not in `playwright.config.ts`.
- A console error, overflow, clipped control, focus loss, or runtime error is a
  real failure, even if the final locator appears.
- Browser probes should collect `pageerror` events and `console` messages, fail
  unexpected errors, and keep a narrow documented allowlist for known
  development diagnostics such as `[Torch perf] frame hitch` warnings. The
  config has no retries, so `trace: 'on-first-retry'` does not collect a trace
  unless a diagnostic run enables retries explicitly.

## Known signals

Use focused searches and rerun only the suspect spec when confirming a finding:

- `rg -n "waitForTimeout|setTimeout|sleep\\(" tests/e2e`
- Index- or text-only selectors where a role, label, or existing test id is
  available.
- `waitForFunction` predicates that poll a value unrelated to a visible state.
- Assertions coupled to generated asset URLs or CSS implementation details
  when an accessible contract exists.
- Browser tests relying on order across specs rather than a fresh navigation.
- `page.evaluate` checks that can be expressed as a user-visible semantic
  assertion; retain geometry checks when they enforce native art ratios,
  square map cells, panel containment, or hit-area contracts.

The current `waitForTimeout` calls in `first-light.spec.ts` are candidates for
review, not automatic defects: some allow Phaser/card presentation to settle.
Replace them only after identifying an equivalent observable state.

## Verification

Run a suspect spec directly first, then the normal gate:

```bash
npm run test:e2e -- tests/e2e/first-light.spec.ts --reporter=line
npm run test:e2e -- tests/e2e/theme.spec.ts --reporter=line
npm run test:e2e -- tests/e2e/crafting.spec.ts --reporter=line
npm run test:e2e -- tests/e2e/loadout.spec.ts --reporter=line
npm run verify
```

If `4173` is occupied, use `TORCH_E2E_PORT=4174 npm run verify`. Report the
exact command and any known browser/runtime limitations; do not claim checks
that were not run.
