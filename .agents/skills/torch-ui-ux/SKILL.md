---
name: torch-ui-ux
description: Review, design, implement, and verify Torch React UI, CSS, accessibility, interaction, responsive layout, and visual-polish work. Use for any menu, HUD, dialog, inventory, hero, ability, map, settings, picker, context-action, or shared UI primitive change, including browser visual reviews.
---

# Torch UI/UX

Use this skill for every user-visible React UI change in Torch. Treat visual quality as a system: establish intent and tokens first, implement semantic and typed components when requested, then critique the rendered result at real viewport sizes.

## Scope and mode

Classify the request before taking action:

- **Review-only:** inspect source and, when requested, the rendered browser; report findings without editing.
- **Design/planning:** propose hierarchy, states, responsive behavior, and unresolved product decisions without editing unless asked.
- **Implementation:** make the requested changes, then run the browser critique and proportional verification.
- **Verification:** inspect an existing change and report evidence from the requested checks.

Review or planning requests do not authorize edits. Do not claim checks were run when they were not.

## Workflow

1. Read `AGENTS.md`, `DESIGN_SYSTEM.md`, and the relevant surface/component before editing or reviewing. Inspect the dirty tree and preserve unrelated work.
2. Map the applicable surface states before styling: default, hover, focus-visible, pressed, selected, disabled, empty, long-content, loading, error/feedback, keyboard, pointer/touch, reduced-motion, portrait, landscape, and short viewport. Record important not-applicable states rather than forcing irrelevant behavior.
3. Make a deliberate design pass. Choose a Torch composition consistent with the current design system and owning surface contract: hierarchy, typography, spacing rhythm, contrast, art treatment, and motion language. Prefer reusable tokens over one-off values.
4. Implement only when requested. Use semantic HTML and explicit typed props, Lucide for generic interface icons, authored art for game content, native aspect ratios, stable accessible names, visible focus, and a minimum 42px interaction footprint.
5. Keep React presentation separate from simulation rules. Route gameplay actions through the existing session/command boundary; UI preferences may use the existing presentation-settings adapters. Opening a modal or menu must enter UI input mode, prevent world input from advancing the simulation, and restore the previous focus/input context on dismissal.
6. Run a critique pass in the browser when the request calls for rendered review. Check `1280×720`, `1170×624`, `390×844`, and `320×568`. Inspect screenshots and computed geometry, not only the DOM. Fix clipping, accidental whitespace, misaligned baselines, weak contrast, duplicate affordances, and unclear focus order.
7. Verify proportionally. For implementation, run the closest unit and browser checks plus `npm run verify`; for review-only or planning, report only the checks actually run. Treat console errors, overflow, focus loss, clipped controls, layout shifts, and unreadable contrast as defects.

## Review output

For review-only work, report each finding with severity, surface and state,
viewport/input method, concrete evidence, user impact, and a recommended
correction. End with checks run, known limitations, and whether the working
tree was left unchanged.

## Torch defaults

- Extend canonical tokens in `src/styles.css`, map them to component semantic variables in `src/index.css`, and consume them through `src/ui/primitives.tsx`; do not introduce feature-local palette literals or competing radius systems.
- Use the shared Base UI-backed primitives from `src/ui/primitives.tsx`; feature screens must not import the vendor package directly for standard behavior.
- Keep the charcoal/gold foundation and Inter for product UI. Document any diagnostic-only typeface exception. Create fantasy signature through hierarchy, contrast, spacing, framing, and restrained motion.
- Preserve existing `data-testid` contracts unless a test and its semantic owner move together; prefer role, label, and state-based selectors for new browser tests.
- Prefer one visual container per meaningful surface. Remove decorative nested cards when they do not communicate grouping.
- Use explicit `transition-property` values; animate `transform` and `opacity`, not layout or `transition: all`. Honor `[data-reduce-motion]` and `prefers-reduced-motion`.
- Never hide focus rings, truncate without a useful label, rely on color alone, or place important controls below an unreachable scroll region.
- Read [review-checklist.md](references/review-checklist.md) for the complete surface and acceptance checklist.

## Coordination

Load `$torch-phaser` alongside this skill whenever a change touches Phaser scenes, the world board, HUD placement, scale/resize, camera, tile/grid rendering, Phaser input, Phaser-rendered assets, or tweens. Keep UI-overlay decisions and Phaser presentation decisions explicit at their boundary.
