# Duplicate Feature Surface Audit

**Goal:** Collapse confirmed near-duplicate React product surfaces in Torch
without inventing a generic UI framework or erasing meaningful game-content
differences.

Torch's current overlay is intentionally compact: `src/ui/menu-overlay.tsx`
owns the HUD, Main Menu, Hero, Inventory, Equipment, Abilities, Map, Settings,
and selector/detail screens; `src/ui/context-action-hand.tsx` owns the
world-adjacent Action Hand. Shared behavior belongs in
`src/ui/primitives.tsx`; shared styled source lives in `src/components/ui/`.
The current overlay is the primary feature-surface owner, rather than a
multi-package feature hierarchy.

The current selector twins are `EquipmentSelectorScreen`, `ToolSelectorScreen`,
and `AbilitySelectorScreen` in `src/ui/menu-overlay.tsx`. They share the
selector header/back contract, but their art, choice semantics, and empty
states remain intentionally distinct until structural drift demonstrates a
smaller local helper.

## Intent

Find cohesive structural twins and parameterize them under their existing
owner. Require three structural twins, or two with clear drift/duplicate
maintenance. A successful collapse deletes the weaker path and reduces net
surface; it must not create a configuration-heavy component for two callers.
If a potential duplicate crosses the Phaser board boundary, keep the React
overlay and Phaser scene as separate presentation owners.

## What counts as a duplicate here

| Signal | Likely owner |
| --- | --- |
| Repeated menu/dialog shell, title/close/focus plumbing, or selector back path | `TorchDialog`/`TorchButton` via `src/ui/primitives.tsx`, with composition in `menu-overlay.tsx` |
| Repeated inventory/equipment/ability choice grid scaffolding | A small local helper in `menu-overlay.tsx`, only after structural twinship and semantic differences are mapped |
| Repeated empty/detail panel chrome | Existing semantic panel/card styles in `src/styles.css`/`src/index.css`; token-only work belongs in `DesignSystemConsistencyAudit.md` |
| Repeated HUD action button markup | A typed local composition in `menu-overlay.tsx` if at least three actions truly share behavior and labels |
| Repeated Action Hand card presentation | Keep in `context-action-hand.tsx`; combat/gathering card semantics and 3:4 art are intentionally distinct from collection grids |

## Not this audit

- Raw spacing/color/radius or primitive drift →
  `DesignSystemConsistencyAudit.md`.
- Misplaced simulation/state ownership → `StateGravityOwnershipAudit.md`.
- Unused symbols or retained alternate implementations → the applicable audit
  in `Docs/Audits/` (for example `DeadCodeAudit.md` or
  `DualPathRetentionAudit.md`).
- A single verbose screen or authored content mass with correct ownership →
  `InelegantSlopAudit.md`.
- Phaser board render layers, camera, fog, terrain, or entity tokens → keep
  ownership in `src/game/scene.ts` and its pure helpers; do not merge them with
  React menu surfaces.

## Hard stops

- Do not force Hero, Inventory, Equipment, Abilities, Map, and Settings into
  one generic data-driven screen merely because they use the same dialog.
- Do not merge the Action Hand with inventory/ability selector grids. Their
  interaction model, event timing, target semantics, and native art treatment
  differ.
- Do not move shared chrome into a nonexistent feature folder or import a
  vendor component directly around `src/ui/primitives.tsx`.
- Do not change simulation commands, `GameState`, or `GameSession` ownership as
  a by-product of collapsing view scaffolding.
- Keep exact test and accessibility contracts when possible; move a test only
  with the semantic owner, not to make duplicate code appear smaller.
- Preserve role/name/state selectors, `data-testid` contracts, Escape/backdrop
  dismissal, focus restoration, responsive containment, native-art ratios, and
  typed command routing. A test ID pattern is an inventory clue, not evidence
  that two product surfaces are duplicates.

## Remedy preference

1. Delete the strictly redundant branch when one path is clearly weaker.
2. Parameterize repeated local composition in `menu-overlay.tsx` with explicit
   typed props and stable accessible names.
3. Extend `src/ui/primitives.tsx` only for behavior shared by multiple Torch
   surfaces (dialog, tabs, menu, select, button).
4. Add a new reusable component only when three real callers share structure,
   states, and dismissal/focus behavior. Keep game-content composition local.

Preserve intentional differences: Inventory is an items-only square grid;
Equipment uses a paper-doll and tool rows; Abilities preserves native 3:4 art
and detail/selector flows; Map uses square explored cells; Settings uses
behavior-backed tabs; Action Hand cards are event-driven combat/gathering
feedback.

## Known signals

Use focused searches and visual review rather than matching names alone:

- Repeated `TorchDialog`, close-button, selector-back, or `data-testid`
  scaffolding in `src/ui/menu-overlay.tsx`; IDs alone do not establish
  duplicate structure or behavior.
- Repeated JSX/CSS for card grids, empty states, detail panes, or HUD controls
  with only labels/catalog data changed.
- Two paths that expose the same screen or selector but drift in Escape,
  backdrop, focus restoration, disabled state, or accessible naming.
- Duplicate layout constants in `src/styles.css` and `src/index.css`; route
  pure token duplication to the design-system audit.
- E2E assertions in `tests/e2e/first-light.spec.ts` that repeat the same
  semantic journey after a proposed collapse.

## Verification

For a surface collapse, run focused owner checks as needed, then use the
integrated gate once for a cross-layer change. `npm run verify` already runs
theme checking, typecheck, Vitest, build, and the browser suite; do not repeat
those constituent commands merely to duplicate verification. The focused
browser probes are:

```bash
npm run typecheck
npm test -- tests/context-action-hand.test.ts tests/input-bindings.test.ts
npm run test:e2e -- tests/e2e/first-light.spec.ts --reporter=line
npm run test:e2e -- tests/e2e/theme.spec.ts --reporter=line
npm run verify
```

Confirm focus restoration, Escape/backdrop dismissal, responsive containment,
42 px hit areas, native artwork ratios, and unchanged command routing. Report
which repeated paths were removed and any intentionally retained differences.
