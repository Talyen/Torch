# Design System Consistency Audit

**Goal:** Find confirmed React-overlay and board-presentation drift from
Torch's shared tokens, semantic variables, and behavior primitives, then move
the smallest useful set of call sites back to those owners.

Canonical owners are `src/styles.css` (Torch tokens), `src/index.css`
(component-semantic variables), `src/ui/primitives.tsx` (Torch's behavior
boundary), and the checked-in source components under `src/components/ui/`.
`src/game/presentation-colors.ts` is the bridge for board-safe background, fog,
and grid colors. Product direction and invariants live in
[`DESIGN_SYSTEM.md`](../../DESIGN_SYSTEM.md) and
[`ARCHITECTURE.md`](../../ARCHITECTURE.md).

## Intent

Inventory custom values as **tokenized**, **feature-owned**, or
**justified-custom**, then migrate confirmed drift toward an existing owner.
Add a token or primitive only when at least three current uses share the same
semantic role and the new API removes more call-site surface than it adds. If
the change touches both React chrome and Phaser presentation, keep the token
bridge explicit and phase the work.

Prefer one Gold/Charcoal chrome palette, Inter product typography, the 4 px
spacing rhythm, and the existing shape/elevation tokens. Keep authored game
art, terrain, entity colors, HP feedback, and other semantic content colors as
documented exceptions.

## Hard stops

- Do not rewrite simulation rules or move game state into CSS/UI code.
- Do not redesign the Phaser board, visibility sweep, or responsive tile math
  as part of a token audit.
- Do not flatten the intentional 3:4 Action Hand fan, event-driven card-play
  feedback, native-ratio Hero/ability art, or equipment paper-doll geometry.
- Do not import `@base-ui/react` directly from screens; use the
  Torch-owned names in `src/ui/primitives.tsx`.
- Do not add a competing behavior library, platform-specific design system, or
  feature-local theme.

## Triage

| Priority | Cluster                   | Torch signal                                                                                            | Preferred remediation                                                                                       |
| -------- | ------------------------- | ------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| 1        | Token bypass              | Raw hex/rgb, spacing, radius, shadow, or type values in `src/ui/`, `src/index.css`, or feature CSS      | Map to a canonical token or add one semantic token in `src/styles.css` first                                |
| 1        | Behavior bypass           | A screen imports Base UI or a vendor component directly, or hand-rolls dialog/tabs/select/menu behavior | Route through `src/ui/primitives.tsx` and the existing `src/components/ui/*` wrapper                        |
| 1        | Responsive contract drift | Controls below 42 px, clipped panels, native-ratio art stretched, or unsafe HUD/menu bounds             | Fix the owning layout and verify the four design-system viewports                                           |
| 2        | Duplicated chrome         | Repeated button, panel, card, selector, or focus styles in two or more screens                          | Extend the existing primitive or token; use `DuplicateFeatureSurfaceAudit.md` when whole surfaces are twins |
| 2        | Motion drift              | `transition: all`, layout animation, missing reduced-motion handling, or timing that changes meaning    | Name transform/opacity properties and honor `data-reduce-motion` plus `prefers-reduced-motion`              |
| 3        | Justified custom layout   | Action Hand fan, ability artwork, equipment rows, Hero art, map cells, Phaser terrain/entity colors     | Keep behavior; extract only repeated constants or document the exception                                    |

## Domain rules

- The React overlay is owned by `src/ui/menu-overlay.tsx` and
  `src/ui/context-action-hand.tsx`; shared interaction behavior is owned by
  `src/ui/primitives.tsx` and `src/components/ui/`.
- `src/game/presentation-settings.ts` owns local display preferences. Do not
  encode those preferences as simulation state or invent CSS-only persistence.
- Board presentation may consume only the documented bridge in
  `src/game/presentation-colors.ts`; terrain, entities, resources, health, and
  authored art retain semantic content colors.
- Use semantic HTML and accessible names. Icon-only controls still need an
  `aria-label`; selected, pressed, disabled, and focus-visible states must be
  visible without relying on color alone.
- Preserve the overlay/board boundary: opening a menu sets the session input
  mode to `ui`, and closing it restores world input and focus.

## Known signals

Discovery aids (choose focused probes; do not treat every match as a defect):

- `rg -n "#[0-9a-fA-F]{3,8}|rgb\\(|hsl\\(|transition: all|w-\\[|h-\\[|p-\\[|text-\\[" src`
- Direct imports from `@base-ui/react` outside `src/ui/primitives.tsx` or
  `src/components/ui/`.
- Repeated ad-hoc `.menu-panel`, button, card, tab, selector, or focus-ring
  styles in `src/styles.css` and `src/index.css`.
- `data-reduce-motion`/`prefers-reduced-motion` missing on new motion rules.
- Geometry and state assertions in
  `tests/e2e/first-light.spec.ts` and `tests/e2e/theme.spec.ts` failing after a
  style change.

## Verification

Run the narrowest relevant checks while iterating:

```bash
npm run check:theme
npm run typecheck
npm test
npm run test:e2e -- --reporter=line
```

Use `npm run verify` for the full handoff gate. For UI changes, include the
existing browser coverage at `1280×720`, `1170×624`, `390×844`, and `320×568`
and report any visual review not run. `npm run check:theme` covers the static
token/palette ownership contract only; it does not prove responsive layout,
accessibility, or Phaser presentation behavior. Keep unrelated dirty-tree
changes intact.
