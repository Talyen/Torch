# UI Interaction & Feedback Audit

**Goal:** Find runtime interaction and presentation defects that static
TypeScript checks do not catch—blocked clicks, missing or misleading feedback,
stuck input modes, lost focus, keyboard gaps, clipped or unreachable controls,
and unclear Action Hand state—across Torch's Phaser board and React overlay.

This is an interaction and rendered-state audit, not a full WCAG review or a
token migration. Shared accessibility and visual contracts live in
[`DESIGN_SYSTEM.md`](../../DESIGN_SYSTEM.md). Test-infrastructure improvements
belong in [`E2ETestQualityAudit.md`](E2ETestQualityAudit.md), but unreliable
automation cannot be accepted as evidence that an interaction passed.

## Completion standard

A **focused pass** reviews the changed surface and an adjacent flow. It may find
and fix defects, but it must not be reported as a completed audit.

A **completed audit** exercises every applicable flow in the flow inventory,
records every applicable state and required viewport in the coverage ledger,
and explicitly lists anything that could not be tested. Passing automated tests
alone does not complete the audit.

Before testing:

1. Record the current dirty tree and do not overwrite unrelated work.
2. Identify every surface changed by the current diff. If a shared primitive or
   input/session owner changed, identify all of its affected consumers.
3. Select the changed flow, at least one adjacent flow, and every relevant
   shared-primitive consumer for the pass.
4. Map applicable states before interacting with the surface. Mark meaningful
   states `not applicable` rather than silently omitting them.
5. Record the exact viewport, input method, reduced-motion mode, seed or setup,
   and route used to reach the state.

Maintain a coverage ledger with one row per tested state:

| Surface and flow             | State        | Viewport | Input    | Result    | Evidence                 | Limitation |
| ---------------------------- | ------------ | -------- | -------- | --------- | ------------------------ | ---------- |
| Example: Main Menu dismissal | Open, Escape | 390×844  | Keyboard | Pass/fail | Screenshot and assertion | None       |

Do not reuse an old pass result after the owning surface, shared primitive,
input route, or test setup changes. A full pass is required after a substantial
shared primitive, overlay stack, session input, or responsive-layout change.

## Flow inventory

Exercise every flow for a completed audit. A focused pass selects the changed
flow plus at least one adjacent flow that shares navigation, primitives, input,
or layout behavior.

- HUD → Main Menu → Map/Settings, including close button, Escape, backdrop,
  back navigation, focus restoration, and repeated open/close.
- Inventory category/sort/detail, including empty, long-content, scroll, and
  stale-selection states.
- Equipment slot → selector → return, including selected, empty, unavailable,
  native-ratio artwork, and readable labels.
- Abilities slot → selector/detail dialog → return, including click-to-open,
  cooldown/disabled behavior, rapid repeat activation, and reduced motion.
  Hold-to-open detail is not implemented; treat it as a future interaction
  requiring an explicit design and test contract.
- Keyboard bindings and world-input gating while one or more UI surfaces own
  input.
- Action Hand gathering/combat cards, card-play feedback, disabled/cooldown,
  no-target, animation cancellation, replacement timing, and re-targeting.
- Responsive shell and overlay behavior during live resize, orientation change,
  short viewports, long content, and touch scrolling.
- Failure and recovery paths for asynchronous or platform-owned actions such as
  fullscreen requests.

These flows are implemented primarily in `src/ui/menu-overlay.tsx` and
`src/ui/context-action-hand.tsx`, with session/input ownership in
`src/game/session.ts`, `src/game/scene.ts`, and `src/game/input-bindings.ts`.
Start with `tests/e2e/first-light.spec.ts`, `tests/e2e/theme.spec.ts`,
`tests/context-action-hand.test.ts`, and `tests/input-bindings.test.ts` as the
existing semantic owners, but select or add coverage that actually reaches the
flow and state under review.

## Required state matrix

For each selected surface, record and exercise every applicable state:

- Default, hover, focus-visible, pressed, selected, and disabled.
- Empty, loading/pending, success, error, unavailable, cooldown, and no-target.
- Short and long labels, long lists, scrolling, and content that wraps.
- Keyboard-only, pointer, touch/coarse pointer, held/repeated input, rapid
  activation, pointer cancellation, and interrupted dismissal.
- Open, close button, Escape, backdrop, back, nested overlay, reopen, and focus
  restoration.
- Normal motion, in-app Reduce Motion, and `prefers-reduced-motion`.
- Initial render, live resize, portrait/landscape change, and high-DPI rendering.

Do not infer one input path from another. Keyboard, pointer, and touch can fail
independently. Do not infer a visual state from the DOM alone.

## Required browser and visual evidence

Review selected states in the rendered browser at all four baseline viewports:

- `1280×720`
- `1170×624`
- `390×844`
- `320×568`

Also use live resize and a high-DPI configuration when canvas/overlay alignment,
pointer coordinates, artwork, or responsive behavior is involved. Use actual
touch hardware when the defect depends on platform touch behavior; otherwise
record that touch was emulated.

For every meaningful state:

- Capture a screenshot or recording and inspect the rendered result, not only
  the DOM or test assertion.
- Inspect computed geometry for overlap, clipping, accidental whitespace,
  unreachable scroll regions, layout shifts, safe-area violations, clipped
  focus rings, and controls below the usable viewport.
- Confirm visual and hit bounds agree and that the intended target is the
  topmost hit-testable element at its center and edges.
- Check readable contrast, hierarchy, selected/disabled distinction, artwork
  aspect ratio, and whether feedback remains understandable without motion.
- Treat console errors, page errors, unhandled rejections, failed resources,
  focus loss, unexpected overflow, and input leakage as failures.

## Interaction contracts

### Navigation and overlay stack

- `TorchDialog` and menu overlays expose the documented close paths. Backdrop
  activation closes only the topmost dismissible surface; it does not trigger a
  control or world action beneath it.
- Opening a menu, dialog, selector, or popover captures its invoking focus target
  and prior input context before taking ownership. Dismissal restores that exact
  prior context. For a top-level menu the prior mode will normally be `world`;
  nested UI must not reactivate the world while another UI owner remains open.
- Closing restores focus to the invoker. If the invoker unmounted, focus moves
  to a documented, visible fallback in logical reading order rather than to the
  document body or a stale node.
- Close button, Escape, backdrop, back, and programmatic dismissal are tested
  independently. Repeated and out-of-order dismissal cannot leave a stale
  picker, modal, focus target, listener, pointer capture, or input owner.

### World-input gating

Whenever a React surface owns input, the audit must prove all of the following:

- Keyboard, pointer, touch, held/repeated input, and global shortcuts do not
  advance or mutate the world.
- The opening interaction, backdrop interaction, and dismissal interaction do
  not propagate into Phaser or dispatch a second action.
- Movement, wait, gather, map, pointer-to-tile, and Action Hand commands remain
  blocked until the final UI owner releases input.
- Input resumes exactly once after dismissal and uses the current binding and
  coordinate transform.
- Nested overlays retain UI ownership until the final overlay closes.

Route keyboard bindings through `src/game/input-bindings.ts`; Escape remains
reserved for dismissal and cannot be rebound. React and Phaser continue to
submit typed commands through the session boundary rather than mutating
simulation state directly.

### Pointer, keyboard, and touch

- Every interactive control has a semantic role, stable accessible name,
  visible focus state, logical tab position, and at least a 42 px hit area.
- Visible bounds and hit bounds correspond. Transparent or decorative layers do
  not intercept input, and overflow containers do not clip focus or controls.
- Pointer capture is released on completion, cancel, dismissal, and unmount.
  Touch scrolling does not accidentally activate controls or become trapped by
  an interaction gesture.
- Disabled controls cannot dispatch through pointer, keyboard, touch, repeated
  events, or programmatic interaction. `aria-disabled`, `aria-pressed`, and
  selected state match both rendered feedback and actual behavior.

### Feedback and recovery

- Pressed, selected, expanded, and disabled feedback appears in the same
  rendered interaction cycle and remains distinguishable without color alone.
- Long or asynchronous work exposes a pending state immediately, blocks
  duplicate activation while pending, and presents observable success or error
  feedback with a recoverable next action.
- Empty inventory/detail, unavailable destinations, cooldown abilities, and
  no-target Action Hand states state what happened and keep the next valid action
  visible and operable.
- Action Hand cards use typed simulation events for `is-playing` feedback,
  disable the active card during playback, and withhold same-key replacements
  until animation completion. Cancellation, interrupted dismissal, and reduced
  motion preserve the same action result and final state.
- Ability details currently open on click. Any future hold gesture requires
  explicit progress, cancellation, touch-scroll, keyboard-parity, and reduced-
  motion contracts before implementation.

## Runtime diagnostic signals

Use source inspection to guide reproduction, never as a substitute for runtime
evidence. Inspect the relevant surface and its shared owners for:

- `gameSession.setInputMode`, `gameSession.dispatch`, `performAction`, and direct
  state writes from React or Phaser callbacks.
- `onKeyDown`, `onPointer*`, `setPointerCapture`, global listeners, subscriptions,
  and tweens without cleanup on shutdown, unmount, cancel, or dismissal.
- Invisible overlays, unexpected stacking contexts, incorrect `pointer-events`,
  transformed hitboxes, transparent interception layers, and mismatched visual
  and interactive bounds.
- React events that bubble into Phaser, duplicate listeners, repeated dispatch,
  stale closures, and race conditions during rapid activation or reopen.
- Dialogs, selectors, and popovers without independent Escape, outside-click,
  back, focus restoration, and accessible-name behavior.
- Controls whose semantic state does not match visual or actual behavior, and
  disabled controls or cards that still dispatch commands.
- Fixed timers in `src/ui/context-action-hand.tsx` or tests that can race visible
  replacement, cancellation, or unmount. Verify the event/state contract before
  changing timing.
- `src/game/scene.ts` handlers that do not guard the active input owner,
  action-boundary animation state, or the current pointer coordinate transform.

When diagnosing a blocked click, inspect the topmost element at the attempted
point, its stacking context, `pointer-events`, clipping ancestors, hit bounds,
and propagation path before changing handlers or adding selectors.

## Defect correction protocol

Every fix made during the audit follows this sequence:

1. Reproduce the defect in the live browser and capture the exact flow, state,
   viewport, input method, console result, and visual evidence.
2. Identify the owning module and affected shared consumers. Do not patch a
   symptom in a feature if the defect belongs to a shared primitive, session
   boundary, input adapter, or layout contract.
3. Add a failing behavioral test when the defect represents a durable user or
   safety invariant. Confirm that the test reaches the intended state.
4. Apply the smallest complete fix without moving simulation rules into UI or
   Phaser presentation code.
5. Re-run the original reproduction and compare the final rendered state with
   the captured failure.
6. Exercise every alternate input and dismissal path relevant to the defect.
7. Test all affected shared-primitive consumers and at least one adjacent flow.
8. Repeat the required viewport/state checks, inspect console and page errors,
   and run the proportional automated gates.

A defect is not closed because one assertion passes. It is closed only when the
original reproduction, affected state matrix, shared consumers, and adjacent
regression flow pass with recorded evidence.

## Automation evidence and escalation

Automated coverage is valid evidence only when the test demonstrably reaches
the intended surface and state, uses a stable semantic or owned test contract,
and fails when the invariant is intentionally violated.

If a test is flaky, timing-dependent, incorrectly targeted, animation-dependent
without need, or unable to prove the behavior:

1. Mark the affected audit row `blocked`; do not record it as passed.
2. Capture the failure mode and complete manual runtime evidence where possible.
3. Escalate the infrastructure defect to
   [`E2ETestQualityAudit.md`](E2ETestQualityAudit.md).
4. Repair the test evidence before claiming a completed audit. Do not weaken or
   remove a meaningful assertion merely to make the suite green.

Preserve useful `data-testid` contracts unless their semantic owner moves.
Prefer role, accessible name, and state selectors for new coverage, but retain
an owned test hook when geometry, canvas integration, or otherwise inaccessible
state requires one.

## Verification

Run the focused Vitest and browser owner for the selected flow, then the full
gate for any code, asset, configuration, or workflow change. The baseline owners
are:

```bash
npm test -- tests/context-action-hand.test.ts tests/input-bindings.test.ts
npm run test:e2e -- tests/e2e/first-light.spec.ts --reporter=line
npm run verify
```

Select additional focused tests that exercise the actual changed flow. For
Settings, theme, or shared UI-system changes, also run the applicable checks:

```bash
npm run check:ui-system
npm run check:theme
npm run test:e2e -- tests/e2e/theme.spec.ts --reporter=line
```

For every overlay flow, assertions that world state remains unchanged while UI
owns input and resumes only after the final dismissal are mandatory, not
optional. Automated checks do not replace the required rendered browser pass.

## Handoff record

Report:

- Whether this was a focused pass or completed audit.
- Surfaces, states, viewports, input methods, and shared consumers covered.
- Each finding with severity, exact reproduction, user impact, evidence, owning
  module, and correction.
- Original reproduction and post-fix regression results.
- Commands actually run, console/page-error status, and screenshots or
  recordings captured.
- Every untested, blocked, emulated, or not-applicable case.
- Pre-existing dirty-tree work left untouched.

If a live browser pass or any required matrix entry was not possible, the audit
remains incomplete and the limitation must be explicit.

## Hard stops

- Do not restyle unrelated chrome or migrate tokens here; use
  `DesignSystemConsistencyAudit.md`.
- Do not rewrite Playwright infrastructure as incidental audit work; route a
  confirmed reliability defect to `E2ETestQualityAudit.md` and keep the affected
  audit result blocked until its evidence is trustworthy.
- Do not assume surfaces that are not present in Torch. It currently runs as a
  Vite browser client with a Phaser board and React overlay.
- Do not move simulation rules into click handlers or Phaser callbacks. UI and
  presentation actions call typed `gameSession` commands; canonical rules remain
  under `src/sim/`.
- Do not churn test hooks without an interaction or ownership reason.
- Do not close a defect, report an audit pass, or suppress a failure without the
  required runtime and regression evidence.
- Leave unrelated dirty-tree changes untouched.
