# Torch UI/UX Review Checklist

Use this checklist during a full surface review. Record concrete findings and verify each finding in the rendered browser, not only in source. If implementing, verify each fix as well.

## System and primitives

- One canonical token layer for color, spacing, radius, type, elevation, and motion.
- Follow the source-of-truth chain: `src/styles.css` tokens -> `src/index.css` semantic variables -> `src/ui/primitives.tsx` shared behavior -> feature composition.
- Standard behavior uses the shared Base UI-backed primitives; feature screens do not import the vendor package directly.
- Charcoal/gold contrast remains intentional; muted text and disabled states remain readable.
- Product UI uses Inter with meaningful size/weight/letter-spacing differences; long labels wrap or truncate with an accessible name.
- Buttons, tabs, selects, dialogs, toggles, sliders, and close controls have semantic roles, visible focus, keyboard behavior, and 42px minimum interaction footprints.
- No `transition: all`; layout changes are not animated; reduced motion removes nonessential movement.
- No duplicate icons, nested decorative containers, accidental transparency, or focus outlines clipped by overflow.

## Surface states

Review every applicable default, hover, focus-visible, pressed, selected, disabled, empty, long-content, loading, and error/feedback state. Test Escape, backdrop, back, keyboard tab order, pointer/touch activation, focus restoration, and scroll reachability where the surface supports them. Record important not-applicable states.

## Surface contracts and boundaries

- Read the current surface contract in `DESIGN_SYSTEM.md` and any owning feature specification; do not replace those product decisions with checklist-specific rules.
- Keep React overlays, focus, menus, and UI preferences separate from Phaser world rendering and effects. Opening a modal or menu must enter UI input mode, block world advancement, and restore focus/input context on dismissal.
- Preserve authored artwork aspect ratios, explicit scroll ownership, safe-area insets, named visual layers, and responsive minimum widths.
- For world/HUD surfaces, verify that the board remains readable, overlays do not cover important actions, and presentation preferences do not silently redefine simulation semantics.

## Responsive and verification matrix

Check at `1280×720`, `1170×624`, `390×844`, and `320×568`. Also check keyboard focus, pointer/touch, reduced motion, high-DPI rendering, and long-content lists. Capture screenshots for meaningful states and assert semantic labels, geometry, overflow, dismissal/focus restoration, responsive behavior, and console cleanliness in Playwright.
