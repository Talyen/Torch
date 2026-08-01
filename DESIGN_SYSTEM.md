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
text, muted text, charcoal controls, selected states, and gold emphasis.

Phaser may consume board-safe tokens through
`src/game/presentation-colors.ts`. Terrain, entities, resources, feedback, and
artwork keep the colors needed to communicate their game meaning.

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
- Keep readable content on opaque surfaces. Blur and atmosphere belong behind
  the content surface.
- Keep map cells and equipment slots square, and preserve authored art ratios.

Review changed surfaces at representative wide, narrow, tall, and short sizes,
including live resize. Fix clipping, overflow, unreachable controls, layout
shifts, and clipped focus rings.

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
input, and restores the previous input and focus context when dismissed.

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

For meaningful UI changes, check the rendered result with keyboard and pointer
input at representative viewport sizes. Add or update the closest browser test
for behavior that matters. Check reduced motion, touch, long content, and real
mobile hardware when the change actually depends on them.
