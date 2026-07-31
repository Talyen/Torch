# UI Interaction & Feedback Audit

**Goal:** Find confirmed interaction defects that static TypeScript checks do
not catch—blocked clicks, missing feedback, stuck input modes, lost focus,
keyboard gaps, and unclear Action Hand state—across Torch's Phaser board and
React overlay.

This is an interaction audit, not a full WCAG review or a token migration.
Shared accessibility and visual contracts live in
[`DESIGN_SYSTEM.md`](../../DESIGN_SYSTEM.md); browser reliability work belongs
in `E2ETestQualityAudit.md`.

## Intent and flow rotation

Verify one live flow per pass, then fix confirmed defects and add coverage only
for a unique interaction or safety invariant. Rotate through:

- HUD → Main Menu → Map/Settings, including close, Escape, backdrop dismissal,
  and focus restoration.
- Inventory category/sort/detail, including the empty-detail state.
- Equipment slot → selector → return, including native-ratio artwork and
  readable selected/empty labels.
- Abilities slot → selector/detail dialog → return, including click-to-open
  detail behavior and reduced-motion feedback. Hold-to-open detail is not
  implemented; treat it as a future interaction requiring an explicit design
  and test contract.
- Keyboard bindings and world-input gating while a menu is open.
- Action Hand gathering/combat cards, card-play feedback, disabled/cooldown
  state, and re-targeting.

These flows are implemented primarily in `src/ui/menu-overlay.tsx` and
`src/ui/context-action-hand.tsx`, with session/input ownership in
`src/game/session.ts`, `src/game/scene.ts`, and `src/game/input-bindings.ts`.
Use `tests/e2e/first-light.spec.ts`, `tests/e2e/theme.spec.ts`,
`tests/context-action-hand.test.ts`, and `tests/input-bindings.test.ts` as the
existing semantic owners before adding a new test.

## Hard stops

- Do not restyle unrelated chrome or migrate tokens here; use
  `DesignSystemConsistencyAudit.md`.
- Do not rewrite Playwright setup or remove useful animation assertions; use
  `E2ETestQualityAudit.md` for test reliability.
- Do not assume surfaces that are not present in Torch. It currently runs as a
  Vite browser client with a Phaser board and React overlay.
- Do not move simulation rules into click handlers. UI actions call
  `gameSession` commands; canonical rules remain under `src/sim/`.
- Do not churn `data-testid` values unless an interaction or test is blocked;
  prefer accessible role, name, and state selectors for new coverage.

## Interaction contracts

**Navigation and overlays**

- `TorchDialog` and the menu overlay have a close button, Escape path, and
  appropriate backdrop behavior. Closing restores focus to the invoking HUD or
  menu control.
- `MenuOverlay` sets `gameSession` input mode to `ui` while open. Keyboard and
  pointer input must not advance the world; dismissal restores `world` mode.
- Selector and detail dialogs return to their owning screen without leaving a
  stale picker, modal, or focus target mounted.

**Pointer, keyboard, and touch**

- Every interactive control has a visible focus state and a minimum 42 px hit
  area. Icon-only HUD controls retain an accessible label.
- Keyboard bindings route through `src/game/input-bindings.ts`; Escape remains
  reserved for dismissal and cannot be rebound.
- Phaser's scene input checks `gameSession.inputMode` before movement, wait,
  gather, map, or pointer-to-tile commands. A menu must not leak a world action.

**Feedback and modes**

- Buttons and toggles expose immediate pressed/selected/disabled feedback.
- Long or asynchronous work (for example fullscreen requests) has a visible
  status and cannot double-activate. Ability details currently open on click;
  any future hold gesture needs its own feedback contract.
- Action Hand cards use typed simulation events for `is-playing` feedback,
  disable the active card during playback, and withhold same-key replacements
  until the animation completes. Reduced motion shortens presentation without
  changing the action result.
- Empty inventory/detail, unavailable menu destinations, cooldown abilities,
  and no-target Action Hand states explain what happened and leave a recoverable
  next action.

## Known signals

Search only the relevant surface and then reproduce it in the live browser:

- `gameSession.setInputMode`, `gameSession.dispatch`, `performAction`, and
  direct state writes from React callbacks.
- `onKeyDown`, `onPointer*`, `setPointerCapture`, and global listeners without
  cleanup on unmount, cancel, or dismissal.
- Dialogs/selectors/popovers without Escape, outside-click, focus restoration,
  or an accessible name.
- Controls with `aria-disabled`/`aria-pressed` that do not match visual or
  actual behavior; disabled cards that still dispatch commands.
- Fixed timers in `src/ui/context-action-hand.tsx` or tests that can race a
  visible card replacement; verify the event/state contract before changing it.
- `src/game/scene.ts` handlers that do not guard `inputMode` or animation state.

## Verification

For a UI interaction change, run the focused Vitest/browser owner and then the
full gate:

```bash
npm test -- tests/context-action-hand.test.ts tests/input-bindings.test.ts
npm run test:e2e -- tests/e2e/first-light.spec.ts --reporter=line
npm run verify
```

For Settings or theme changes, also run `npm run check:theme` and
`npm run test:e2e -- tests/e2e/theme.spec.ts --reporter=line`. When a flow
opens a menu, optionally assert that a move or wait leaves the world state
unchanged while `inputMode` is `ui`, then verify input resumes after dismissal.

If a live browser pass was not possible, report that limitation explicitly.
Leave unrelated dirty-tree changes untouched.
