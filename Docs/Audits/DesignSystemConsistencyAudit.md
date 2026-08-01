# Design System Consistency Audit

**Goal:** Find and correct user-visible UI defects and confirmed drift from
Torch's shared design-system owners without introducing regressions. An audit
passes only when both of these gates pass:

1. **Rendered experience:** In-scope surfaces are visually correct, usable,
   accessible, responsive, and free of runtime errors in every applicable
   state.
2. **System consistency:** Those surfaces use Torch's tokens, semantic
   variables, behavior primitives, and presentation boundaries correctly.

Code consistency is not evidence of UI quality. Passing static checks or
moving values into shared owners cannot compensate for a broken rendered
experience.

Canonical owners are `src/styles.css` (Torch tokens), `src/index.css`
(component-semantic variables), `src/ui/primitives.tsx` (Torch's behavior
boundary), and the checked-in source components under `src/components/ui/`.
`src/game/presentation-colors.ts` is the bridge for board-safe background, fog,
and grid colors. Product direction and invariants live in
[`DESIGN_SYSTEM.md`](../../DESIGN_SYSTEM.md) and
[`ARCHITECTURE.md`](../../ARCHITECTURE.md).

## Completion contract

Do not report this audit as passed or complete unless all of the following are
true:

- Every in-scope surface and shared-owner consumer appears in the coverage
  ledger.
- Every applicable visual, content, interaction, input, and responsive state
  is marked **verified** with evidence. Mark genuinely irrelevant states
  **not applicable** with a reason.
- Before-and-after screenshots exist for every corrected user-visible defect at
  the viewport and state where it reproduced.
- The rendered result has been inspected at all four required viewports, not
  only queried through the DOM.
- Confirmed defects have regression coverage that asserts the intended
  contract rather than preserving incidental pixel coordinates.
- Shared token or primitive changes include a consumer inventory and
  verification of every materially affected consumer.
- Browser console errors, page errors, clipped or unreachable controls,
  overflow, focus loss, layout shifts, unreadable contrast, and unintended
  world input are treated as failures.
- Both the rendered-experience and system-consistency gates pass.
- Required checks pass, including `npm run verify` at handoff.

Skipped visual review, unreviewed consumers, missing applicable states, or
unexplained coverage gaps are blocking limitations, not acceptable omissions
to mention after declaring success.

## Scope and coverage ledger

Define the audit scope before searching source or changing code. Inventory
user-visible routes and surfaces, not only owner files. Include React screens,
dialogs, popovers, selectors, HUD elements, the Action Hand, and any Phaser
presentation affected by the audit.

A full-project audit includes every reachable user-visible surface. A focused
audit may name a smaller scope, but it must include:

- Every surface directly changed.
- Every consumer of a changed shared token, semantic variable, component, or
  behavior primitive that could materially change.
- Both sides of the React/Phaser boundary when overlay geometry, input mode,
  board-safe colors, scaling, or world readability could change.
- Entry, dismissal, back-navigation, and return-focus behavior for each
  transient surface.

Create and maintain this ledger during the audit:

| Surface/route | Entry condition | Applicable states | Viewports/input | Shared owners consumed | Existing coverage | Missing coverage | Evidence/status |
| ------------- | --------------- | ----------------- | --------------- | ---------------------- | ----------------- | ---------------- | --------------- |
| _Required_    | _Required_      | _Required_        | _Required_      | _Required_             | _List or none_    | _List or none_   | _Open/verified_ |

Do not use a short list of central files as a substitute for this surface
inventory.

## Required audit sequence

### 1. Establish the rendered baseline

Open every in-scope surface before editing. Capture its meaningful states and
record concrete defects with reproducible setup. Inspect screenshots and
computed geometry, not only markup or test selectors.

Start with the user experience. Static source probes come later to diagnose
why a confirmed defect exists or to discover additional consistency risks.

### 2. Exercise the state and input matrix

For every surface, verify each applicable state and record important
not-applicable states:

- Default, hover, focus-visible, pressed, selected, and disabled.
- Empty, loading, error, success, feedback, and destructive confirmation.
- Short and long labels, long lists, wrapping/truncation, and missing or
  fallback artwork.
- Keyboard tab order, Enter/Space activation, Escape, pointer, touch, backdrop
  dismissal, back navigation, and focus restoration.
- Scroll ownership and reachability at both the beginning and end of content.
- Reduced motion through both `data-reduce-motion` and
  `prefers-reduced-motion`.
- Portrait, landscape, short-height, live resize/orientation change, safe-area,
  and high-DPI behavior.
- Overlay input ownership: world input must not advance the simulation while a
  React surface owns focus.

Use `1280x720`, `1170x624`, `390x844`, and `320x568` for every in-scope
surface. Include keyboard and pointer checks, touch where supported, and a
high-DPI pass. Test on real mobile hardware when the behavior depends on its
browser chrome, safe areas, touch handling, or performance.

### 3. Look for experience defects

Treat each of the following as a defect even when tokens and tests pass:

- Clipping, overlap, accidental whitespace, broken stacking, obscured primary
  actions, or unreachable controls.
- Multiple competing scroll regions, scroll traps, or important controls below
  an unreachable region.
- Misaligned baselines, stretched artwork, weak hierarchy, duplicate or
  contradictory affordances, nested decorative containers, or accidental
  transparency.
- Text or state indicators that are unreadable against the actual composited
  surface, or meaning communicated by color alone.
- Missing, clipped, or misleading focus; visual order that disagrees with tab
  order; broken dismissal or focus restoration.
- Controls below 42 px, unreliable pointer/touch targets, click-through, or
  world input leaking through overlays.
- Layout shifts, stale geometry after resize, missing fonts/icons/assets,
  runtime exceptions, browser console errors, or unexpected network failures.
- Motion that changes meaning, animates layout, cannot be cancelled safely, or
  ignores reduced-motion settings.

### 4. Diagnose system drift

Classify relevant custom values and behaviors as **tokenized**,
**feature-owned**, or **justified-custom**, then move confirmed drift toward
the correct existing owner. An exception is justified only when it has a
specific semantic purpose, an owning module, and a recorded reason; visual
preference alone is not sufficient.

Prefer one Gold/Charcoal chrome palette, Inter product typography, the 4 px
spacing rhythm, and the existing shape, elevation, layer, and motion tokens.
Keep authored game art, terrain, entity colors, HP feedback, and other semantic
content colors as documented exceptions.

Choose ownership by semantic responsibility and API clarity, not by an
arbitrary reuse count. Reuse frequency is evidence, not a hard threshold. A
single legitimate semantic role may belong in the canonical system, while
three similar values may represent different meanings.

### 5. Correct defects and verify the blast radius

Prefer extending or simplifying the owning module over adding wrappers,
managers, compatibility paths, dependencies, or local workarounds. Fix each
confirmed user-facing defect even when it appears in only one surface.

Before changing a shared token, variable, primitive, or component:

1. Inventory every consumer.
2. State the intended effect on each consumer.
3. Capture baseline evidence for materially affected consumers.
4. Apply the smallest coherent change that resolves the defect without leaving
   competing patterns or a half-migrated state.
5. Re-run the state and viewport matrix for every materially affected consumer.
6. Add or update regression coverage at the owner and representative consumer
   surfaces.

Phase cross-boundary or large migrations only when each phase is independently
correct, verified, and shippable. A smaller diff is not preferable when it
leaves the system visually inconsistent or behaviorally broken.

## Triage

| Priority | Cluster                        | Torch signal                                                                                                                      | Preferred remediation                                                                                    |
| -------- | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| P0       | Runtime or interaction failure | Exception, unusable control, blocked progression, lost focus, click-through, world input under an overlay, or unreachable content | Fix the owning behavior or layout immediately and add a regression test                                  |
| P0       | Responsive/rendering failure   | Clipping, overlap, stale resize geometry, stretched art, unsafe bounds, broken scroll, or board/input coordinate drift            | Fix the owning layout or presentation contract and verify the full viewport matrix                       |
| P1       | Accessibility failure          | Missing name/role, invisible focus, incorrect tab order, color-only meaning, unreadable contrast, or pointer/keyboard mismatch    | Correct semantics and visible behavior, then exercise all applicable inputs and states                   |
| P1       | Shared-owner regression risk   | A token, variable, primitive, or component change can affect multiple surfaces                                                    | Inventory and verify all materially affected consumers before declaring success                          |
| P1       | Behavior bypass                | A screen imports Base UI/vendor behavior directly or hand-rolls dialog, tabs, select, menu, or focus behavior                     | Route through `src/ui/primitives.tsx` and the existing `src/components/ui/*` wrapper                     |
| P2       | Token bypass                   | Raw palette, spacing, radius, shadow, type, layer, or motion values duplicate a canonical semantic role                           | Map to an existing owner or add one clearly named semantic owner                                         |
| P2       | Duplicated chrome              | Repeated button, panel, card, selector, focus, or state styles appear across screens                                              | Extend the owning primitive or token and verify its consumers                                            |
| P2       | Motion drift                   | `transition: all`, layout animation, missing cancellation, or missing reduced-motion handling                                     | Name safe properties, animate transform/opacity where practical, and verify both reduction paths         |
| P3       | Justified custom presentation  | Action Hand fan, native-ratio artwork, equipment geometry, map cells, or semantic Phaser content colors                           | Preserve the intent while still auditing responsiveness, accessibility, input, and rendering correctness |

## Hard stops and protected intent

- Do not rewrite simulation rules or move canonical game state into CSS, React,
  Phaser, or presentation settings.
- Do not redesign the Phaser board, visibility sweep, or responsive tile math
  incidentally during a token audit. Still record confirmed defects and either
  fix them through the owning presentation contract or route them as explicit
  follow-up work; protected scope is not permission to mark a defect as passed.
- Preserve the intent of the 3:4 Action Hand fan, event-driven card-play
  feedback, native-ratio Hero/ability art, and equipment paper-doll geometry.
  Still audit their clipping, overlap, scaling, aspect ratio, accessibility,
  input behavior, and compact-layout usability.
- Do not import `@base-ui/react` directly from screens; use the Torch-owned
  names in `src/ui/primitives.tsx`.
- Do not add a competing behavior library, platform-specific design system, or
  feature-local theme.
- Do not hide a defect by weakening an assertion, deleting coverage, clipping
  content, suppressing errors, or documenting a preventable implementation
  problem as justified custom behavior.

## Domain rules

- React owns semantic application UI in `src/ui/` and the `#ui-root` overlay;
  shared interaction behavior is owned by `src/ui/primitives.tsx` and
  `src/components/ui/`. Use the coverage ledger to identify feature surfaces
  rather than assuming only central overlay files matter.
- `src/game/presentation-settings.ts` owns local display preferences. Do not
  encode those preferences as simulation state or invent CSS-only persistence.
- Board presentation may consume only the documented bridge in
  `src/game/presentation-colors.ts`; terrain, entities, resources, health, and
  authored art retain semantic content colors.
- Use semantic HTML and accessible names. Icon-only controls still need an
  `aria-label`; selected, pressed, disabled, and focus-visible states must be
  visible without relying on color alone.
- Preserve the overlay/board boundary: opening a menu sets the session input
  mode to `ui`, prevents world input from advancing the simulation, and closing
  it restores world input and the previous focus context.

## Phaser presentation checks

If board presentation is in scope directly or through a shared change, verify:

- Canvas and camera geometry derive from the real parent bounds and remain in
  logical CSS-pixel coordinates across resize, orientation, and DPR changes.
- Tile drawing, camera positioning, and pointer-to-tile conversion use the same
  coordinate contract.
- Board, fog, grid, entities, Hero, effects, and React overlay retain explicit
  layer ownership; fog does not accidentally hide enabled grid lines.
- React overlays do not obscure required world actions or intercept/release
  input incorrectly.
- Pointer, touch, and keyboard input remain equivalent and route through the
  existing session/input boundary.
- Artwork keeps its intended aspect ratio and texture filtering.
- Tweens cancel safely, preserve action-boundary truth, and have a
  reduced-motion path.
- Resize, render-density, or effects changes leave the console clean and frame
  diagnostics free of a new regression in a representative dense scene.

If none of these checks are run, explicitly exclude board presentation from the
audit scope. Do not claim board consistency or correctness from palette checks
alone.

## Static discovery aids

Use focused source probes after establishing the rendered baseline. Matches are
leads, not automatically defects, and clean output does not prove UI quality.

- `rg -n "#[0-9a-fA-F]{3,8}|rgb\\(|hsl\\(|transition: all|w-\\[|h-\\[|p-\\[|text-\\[" src`
- Direct imports from `@base-ui/react` outside `src/ui/primitives.tsx` or
  `src/components/ui/`.
- Repeated ad-hoc panel, button, card, tab, selector, disabled, selected, or
  focus-ring styles in `src/styles.css` and `src/index.css`.
- Motion rules lacking both `data-reduce-motion` and
  `prefers-reduced-motion` handling.
- Fixed dimensions, absolute positioning, overflow clipping, high layer values,
  transparent surfaces, pointer-event overrides, or multiple scroll owners.
- Existing geometry and state assertions in the closest Playwright coverage.
  Map those tests to the coverage ledger instead of assuming named specs cover
  all affected routes, states, or consumers.

## Required finding record

Record every confirmed defect before correcting it:

| Field               | Required evidence                                                                 |
| ------------------- | --------------------------------------------------------------------------------- |
| ID and severity     | Stable identifier and P0-P3 priority                                              |
| Surface and state   | Route/surface, entry condition, and exact state                                   |
| Environment         | Viewport, DPR, input method, reduced-motion setting, and relevant seed/data setup |
| Reproduction        | Minimal repeatable steps                                                          |
| Expected vs. actual | Intended contract and observed failure                                            |
| Evidence            | Before screenshot, geometry/console evidence where relevant, and owning source    |
| User impact         | What becomes confusing, inaccessible, unreliable, or visually broken              |
| Correction          | Owning-module fix and shared-consumer blast radius                                |
| Regression coverage | Test added/updated and the behavior it proves                                     |
| Verification        | After screenshot and checks actually run                                          |

Existing tests are evidence only for the behavior they explicitly assert. Do
not preserve bad current geometry simply because a test encodes it. Prefer
role, label, state, relationship, reachability, and responsive-contract
assertions over brittle incidental coordinates.

## Verification

Run the narrowest relevant checks while iterating:

```bash
npm run check:theme
npm run check:ui-system
npm run typecheck
npm test
npm run test:e2e -- --reporter=line
```

`npm run check:theme` covers static palette ownership only.
`npm run check:ui-system` enforces the broader UI-system boundary and contrast
contracts. Neither proves responsive layout, interaction, accessibility,
Phaser presentation, or visual quality.

For each corrected defect, add or update the closest Playwright coverage and
reproduce the original failure before accepting the fix when practical. Run
the affected surface tests and every materially affected shared-owner consumer
while iterating. At handoff, run `npm run verify` and complete the rendered
state/viewport review with before-and-after evidence.

The handoff must report:

- In-scope and explicitly excluded surfaces.
- Findings by severity and final status.
- Shared owners changed and the consumers verified.
- Screenshots and regression coverage added or updated.
- Checks and browser reviews actually run.
- Remaining limitations. Any blocking limitation means the audit did not pass.
- Unrelated dirty-tree changes that were preserved.
