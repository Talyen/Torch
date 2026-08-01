# Torch UI Design System

Torch uses quiet charcoal surfaces, warm gold emphasis, clear hierarchy, and
authored art for game content. Phaser renders the world; React renders the HUD,
menus, dialogs, and other semantic UI.

## Foundations

- Use Inter for product UI and Lucide React for generic interface icons.
- Keep the board readable and persistent UI compact.
- Preserve artwork's native ratio. Crop only through an intentional thumbnail
  or world-token variant.
- Keep controls at least 42 px in each interactive dimension.
- Do not rely on color alone to communicate state.
- Prefer one meaningful visual container over layers of decorative cards.

## Ownership

```text
src/styles.css tokens
  -> src/index.css component mappings
  -> src/ui/primitives.tsx shared behavior
  -> feature composition
```

`src/styles.css` is the source of truth for the palette, spacing, type, shape,
motion, elevation, and layer values. Features use those tokens instead of
creating local systems. Add a token only when a semantic role repeats.

Shared interaction behavior belongs in `src/ui/primitives.tsx`; game-specific
composition belongs in the feature. Prefer the shared Base UI/shadcn primitives
for dialogs, tabs, menus, popovers, and selectors instead of rebuilding their
keyboard and focus behavior.

Feature screens must consume Torch-owned primitives rather than importing Base
UI directly or creating native selects. `TorchSelectField`, `TorchIconButton`,
`TorchArtworkCard`, and the Torch button variants provide the standard
selector, icon-control, authored-art-card, dialog-close, and pagination
contracts. Dropdowns use one charcoal popover surface with flat option rows;
gold is reserved for focus, selection indicators, and intentional emphasis.
`npm run check:ui-system` enforces the boundary and checks the contrast of body
text, muted text, charcoal controls, selected states, and gold emphasis. This
static check is a guardrail, not proof of rendered contrast or correct behavior;
opacity, artwork, overlays, blur, disabled styling, and nested surfaces still
require inspection in the rendered application.

Phaser may consume board-safe tokens through
`src/game/presentation-colors.ts`. Terrain, entities, resources, feedback, and
artwork keep the colors needed to communicate their game meaning.

## Shared primitive contracts

Torch-owned controls centralize styling without weakening platform behavior.
Every shared interactive primitive must have focused browser coverage for its
applicable contract:

- Semantic role, accessible name, and exposed selected, expanded, checked,
  disabled, loading, or error state.
- Keyboard navigation, visible focus, activation, and expected Escape behavior.
- Pointer and touch activation with a minimum 42 px interaction footprint.
- Outside-click or backdrop dismissal where appropriate, with focus restored to
  the control that opened the surface.
- Long labels, empty content, disabled options, viewport-edge positioning,
  compact layouts, and short viewports.
- Portal, stacking, scroll, and reduced-motion behavior without clipped content
  or focus indicators.

Feature code must not repair a shared primitive with local event handlers,
spacing patches, z-index values, or accessibility overrides. Fix the primitive
or add an explicit feature-specific composition when the interaction is
meaningfully different. A primitive contract change requires updating its
browser coverage and every affected semantic owner.

## Color, type, and motion

Use the existing semantic tokens for backgrounds, surfaces, text, accent,
controls, borders, focus, feedback, and disabled states. Use
`--ui-color-icon` for icon emphasis on charcoal controls and
`--ui-color-control-foreground` for readable text inside raised charcoal
controls; `--ui-color-on-accent` is reserved for dark text on gold-filled
controls. Gold and charcoal are the chrome palette; success, warning, danger,
info, and game-content colors are semantic exceptions.

Text must meet WCAG AA contrast against its actual surface. Focus and selection
indicators must remain visible against adjacent controls.

Use the existing 4 px spacing scale, type roles, radii, shadows, motion speeds,
and named layer tokens. Do not introduce parallel scales for a feature. Animate
`transform` and `opacity` when practical, name transition properties explicitly,
and avoid `transition: all`.

Honor both the in-app Reduce Motion setting and
`prefers-reduced-motion: reduce`. Reduced motion may remove decoration but must
preserve useful feedback and meaning.

## Layout

- Respect safe-area insets and keep important controls within the usable
  viewport.
- Use responsive or container-aware layout based on available space, not named
  devices.
- Prefer a single owning scroll region. On small or short viewports, stack or
  scroll instead of shrinking text, art, or controls below useful sizes.
- Overlays lock unintended page or world scrolling. A tall dialog owns its
  internal scroll region, keeps its title and dismissal path reachable, scrolls
  focused controls into view, and contains overscroll.
- Portaled surfaces use named layer tokens and remain inside the usable viewport.
  Do not fix stacking failures with feature-local z-index values.
- Keep readable content on opaque surfaces. Blur and atmosphere belong behind
  the content surface.
- Keep map cells and equipment slots square, and preserve authored art ratios.

Review changed surfaces at `1280x720`, `1170x624`, `390x844`, and `320x568`,
including live resize across every layout transition. Fix page-level accidental
overflow, clipped controls or focus rings, unreachable content, layout shifts,
and overlays that obstruct important board actions.

## Interaction and accessibility

Use semantic HTML and native behavior where possible: buttons for actions,
headings for hierarchy, lists for collections, and appropriate form controls.
Interactive UI should have a clear label and the states relevant to it, such as
hover, focus, pressed, selected, disabled, loading, empty, or error.

Icon-only controls require an accessible name. Keyboard order follows visual
reading order. Dialogs and popovers support appropriate dismissal and restore
focus when closed. Tooltips supplement labels rather than replace them.
Meaningful artwork has an accessible name; decorative artwork is hidden from
assistive technology.

Opening a menu or dialog switches the session to UI input mode, prevents world
input and simulation advancement, and restores the previous input and focus
context when dismissed. All overlays use the central session input-mode
mechanism rather than feature-local flags. Nested overlays retain the lock until
the final overlay closes. These behaviors require browser regression coverage
for keyboard, pointer, and dismissal paths.

## Required surface states

Before styling or reviewing a changed surface, enumerate its applicable states:
default, hover, focus-visible, pressed, selected, disabled, loading, empty,
error or feedback, long-content, keyboard, pointer or touch, reduced-motion,
portrait, landscape, and short viewport. Exercise every applicable state and
record important states that do not apply; do not silently omit them.

State combinations matter. In particular, inspect disabled and selected
controls, errors with long content, loading on a short viewport, focused items
inside scroll regions, and overlays opened near viewport edges. A polished
default state does not compensate for a broken secondary state.

## Common surface patterns

- The bottom HUD keeps primary play destinations visible; the main menu holds
  secondary destinations.
- Detail surfaces place native-ratio art beside content when space permits and
  stack on compact layouts.
- Inventory uses a readable grid with a focused item detail surface rather than
  putting all copy in every cell.
- Equipment uses clear, square, actionable slots. Ability artwork keeps its 3:4
  ratio.
- The map is a presentation of simulation-owned exploration state, never a
  second game-state authority.
- Selectors and the Action Hand use shared focus, keyboard, dismissal, and
  reduced-motion behavior.

Keep feature-specific layouts, exact slot arrangements, copy, and temporary
behavior in their owning code, tests, or feature spec rather than expanding this
system document.

## Verification

Every user-visible UI change must be rendered and visually inspected at
`1280x720`, `1170x624`, `390x844`, and `320x568`. Review the required surface
states, exercise keyboard and pointer input, and exercise touch behavior on
compact layouts. Check live resize, reduced motion, and long content. Use real
mobile hardware when behavior depends on mobile browser or device behavior.

For overlays and interactive controls, verify tab order, focus visibility,
keyboard activation, Escape and backdrop dismissal, focus restoration, scroll
reachability, world-input suppression, and accessible role, name, and state.
Inspect screenshots and computed geometry in addition to semantic DOM state.

Treat any console error or uncaught warning, accidental overflow, clipped focus
indicator or control, unreachable action, unintended layout shift, unreadable
contrast, duplicate affordance, broken dismissal, focus loss, or leaked world
input as a failed UI change.

Add or update the closest Playwright coverage for meaningful behavior. Use
geometry assertions or stable screenshots when role and state assertions cannot
catch visible breakage. Shared primitives, persistent HUD surfaces, major
dialogs, and compact layouts require screenshot review for their meaningful
states; update an intentional baseline only after inspecting the rendered
change.

Before handoff, run `npm run check:ui-system`, the closest browser tests, and
`npm run verify`. Report exactly which surfaces, states, viewport sizes, input
methods, screenshots, and commands were checked, along with any known
limitations or deliberately excluded states. A UI change is not complete when
required evidence is missing or any listed defect remains.
