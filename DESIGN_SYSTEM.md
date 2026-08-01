# Torch UI Design System

This document is the stable contract for Torch's presentation layer. Phaser
renders the world; React renders menus, HUD, dialogs, and other semantic
surfaces. It defines the shared visual language, interaction behavior,
accessibility expectations, and boundary between those layers. Feature-specific
copy and temporary implementation notes belong in the owning feature spec.

The words **must** and **should** are normative: **must** is a system rule;
**should** is the default and may be overridden only with a documented reason.

## Product direction

Torch should feel like a focused field instrument for a fantasy expedition:
quiet charcoal surfaces, warm gold emphasis, clear hierarchy, and authored art
where game content carries the meaning. The system creates fantasy through
composition, contrast, framing, and restrained motion rather than ornamental
containers, extra typefaces, or decorative gradients.

- Use Inter for product UI. A diagnostic FPS readout may use its own compact
  technical face.
- Keep the board readable. The persistent HUD is compact; menus are centered
  overlays on large viewports and may become full-height surfaces on short or
  narrow viewports.
- Preserve native artwork ratios. Cropping is intentional only for a named
  thumbnail or world-token variant.
- Use Lucide React for generic interface actions. Use authored art when the art
  itself communicates game content.
- Every control must have at least a 42 px interaction footprint, even when its
  visible icon or label is smaller.
- Do not communicate state with color alone. Pair color with text, iconography,
  shape, position, or an explicit semantic state.

## Ownership and source of truth

The source-of-truth chain is:

```text
src/styles.css tokens
  -> src/index.css semantic variables
  -> src/ui/primitives.tsx behavior boundary
  -> feature composition
```

`src/styles.css` owns the canonical Torch values. `src/index.css` maps them to
the component vocabulary used by the checked-in shadcn source components.
`src/ui/primitives.tsx` is the only feature-facing boundary for shared Base
UI behavior. Features own game-content composition and screen-specific layout;
they must not create competing palette, radius, type, or motion systems.

Phaser may consume board-safe presentation tokens through
`src/game/presentation-colors.ts`. Terrain, entities, resources, HP feedback,
and authored artwork retain their semantic content colors; Gold/Charcoal is the
UI chrome palette, not a requirement to recolor the game world.

React owns semantic overlays, focus, menus, and UI preferences. Phaser owns
world-space rendering and effects. Gameplay rules remain in the simulation and
command boundary. Opening a menu or dialog must switch the session to UI input
mode, prevent world input from advancing the simulation, and restore the
previous focus/input context when dismissed.

## Token contract

New UI must consume the existing tokens. If a repeated semantic role is
missing, add a token in `src/styles.css` first and map it through the semantic
layer; do not add a feature-local literal as a substitute. The CSS variables
are authoritative when this document and the implementation drift. Prescribed
roles that are not yet present in the stylesheet are target contracts: an
implementation review should flag that gap rather than imply it is already
enforced.

### Color roles

| Role                         | Canonical token                                                                    | Current value           |
| ---------------------------- | ---------------------------------------------------------------------------------- | ----------------------- |
| Board/page background        | `--ui-color-background`                                                            | `#0c0b09`               |
| Menu/HUD shell               | `--ui-color-surface`                                                               | `#15130f`               |
| HUD surface                  | `--ui-color-surface-hud`                                                           | `#15130f`               |
| Panel/popover shell          | `--ui-color-surface-panel`                                                         | `#171511`               |
| Opaque content               | `--ui-color-surface-content`                                                       | `#201d18`               |
| Raised card/control          | `--ui-color-surface-content-raised`                                                | `#2b2720`               |
| Recessed content/empty state | `--ui-color-surface-content-deep`                                                  | `#0f0e0c`               |
| Primary text                 | `--ui-color-text`                                                                  | `#f5ead4`               |
| Heading text                 | `--ui-color-heading`                                                               | `#fff1d1`               |
| Muted text                   | `--ui-color-muted`                                                                 | `#b8ae9f`               |
| Accent                       | `--ui-color-accent`                                                                | `#f2c463`               |
| Strong accent/focus text     | `--ui-color-accent-strong`                                                         | `#ffd98a`               |
| Selected/pressed fill        | `--ui-color-accent-soft`                                                           | `rgb(242 196 99 / 14%)` |
| Text on accent               | `--ui-color-on-accent`                                                             | `#1b160c`               |
| Control / hover control      | `--ui-color-control`, `--ui-color-control-hover`                                   | `#2a261f`, `#3b342a`    |
| Modal scrim                  | `--ui-menu-backdrop`                                                               | `rgb(8 7 6 / 86%)`      |
| Phaser grid / fog            | `--ui-color-grid`, `--ui-color-fog`                                                | `#3a3328`, `#15130f`    |
| Semantic feedback            | `--ui-color-success`, `--ui-color-warning`, `--ui-color-danger`, `--ui-color-info` | semantic exceptions     |
| Disabled text                | `--ui-color-disabled`                                                              | `#827b6d`               |
| Borders / focus              | `--ui-border-subtle`, `--ui-border-strong`, `--ui-focus-ring`                      | semantic roles          |

Feedback colors are semantic exceptions to the gold/charcoal chrome palette;
they must not be reused as arbitrary feature accents.

Text must meet WCAG AA contrast against its actual surface (4.5:1 for normal
text and 3:1 for large text). Focus and selected indicators should meet the
3:1 non-text target and remain distinct from adjacent controls.

### Spacing, shape, and elevation

Use the 4 px spacing scale: `--ui-space-1` (4), `--ui-space-2` (8),
`--ui-space-3` (12), `--ui-space-4` (16), `--ui-space-5` (20), and
`--ui-space-6` (24). Prefer the named semantic roles over new values.

| Role                  | Token                 |                                        Value |
| --------------------- | --------------------- | -------------------------------------------: |
| Compact control       | `--ui-control-radius` |                                        12 px |
| Card/slot/content     | `--ui-card-radius`    |                                        14 px |
| Menu/HUD shell        | `--ui-panel-radius`   |                                        18 px |
| Panel padding         | `--ui-panel-padding`  |                                        20 px |
| Raised content shadow | `--ui-shadow-card`    |               `0 14px 32px rgb(0 0 0 / 28%)` |
| Overlay shadow        | `--ui-shadow-panel`   | `0 28px 80px rgb(0 0 0 / 48%)` plus hairline |

Use one visual container per meaningful surface. A nested card is justified
only when it communicates a distinct group, state, or interaction.

### Type and motion

Inter is the product typeface. Type roles must be explicit for display, page
title, section title, body, label, caption, and numeric/stat text; each role
needs a size, weight, line height, and letter spacing. Feature CSS must not
invent a parallel type scale. Long labels wrap or truncate only when their full
accessible name remains available.

Use `--ui-speed-fast` (140 ms) and `--ui-speed-medium` (220 ms) for routine
motion. Name transition properties explicitly; animate `transform` and
`opacity` by default, not layout. Never use `transition: all`. Honor both
`html[data-reduce-motion="true"]` and `prefers-reduced-motion: reduce` by
removing nonessential movement while preserving feedback and meaning.

The gameplay stack is named in the token layer: board 0, Action Hand 20, HUD
30, active hand state 40, transient feedback 50, and menus 60. Use
`--ui-layer-*` and `--ui-hand-tuck-depth` rather than feature-local z-indexes.
Within the menu layer, the scrim sits below the modal surface and popovers or
selectors sit above the modal surface. If a reusable sub-order is introduced,
add named semantic tokens before using it; do not scatter numeric z-indexes.

## Layout and responsive contracts

- `.menu-panel` is the shared overlay shell. Its text, artwork, and controls
  must sit on opaque content surfaces. Atmospheric blur belongs to the shell or
  scrim, never behind readable content.
- `.menu-panel-wide` is the detail surface for Hero, Inventory, Equipment,
  Abilities, Map, and Options. It owns the outer height and scroll contract.
  A dense sub-surface may own one documented scroll region when a compact
  layout stacks content; never add accidental competing scroll regions.
- Respect safe-area insets. Keep menus, HUD rails, dialogs, and Action Hand
  cards inside the usable viewport at every supported orientation.
- Use responsive layout or container queries based on minimum content width,
  not device-name breakpoints. Preserve readable text and artwork before
  compressing gaps.
- Keep the normal focused detail surface largely scroll-free at desktop sizes;
  stack or scroll on narrow/short viewports instead of shrinking below readable
  minimums.
- Hero artwork keeps its native ratio. `.hero-details` keeps artwork beside the
  stats list where space permits; `.stats-panel` is content-sized. A full art
  surface is a direct layout child when no visual card is intended.
- The map keeps explored cells square and may pad its rendered bounds with
  unexplored cells to fit the available viewport. It is presentation over
  `GameState.revealedTiles`, never a second map authority.

The review matrix is `1280x720`, `1170x624`, `390x844`, and `320x568`, plus
keyboard focus, pointer/touch, reduced motion, high-DPI rendering, and long
content. Fix clipping, overflow, unreachable actions, layout shifts, and
focus-ring clipping as defects.

## Interaction and accessibility contract

Use semantic HTML: buttons for actions, headings for hierarchy, sections for
groups, lists for collections, and definition lists for label/value stats.
Shared primitives must cover panels, cards, icon buttons, list rows, stat rows,
tabs, selectors, popovers, and dialogs before a feature adds a bespoke
behavior variant.

Every interactive primitive defines the states that apply to it:

| State         | Contract                                                               |
| ------------- | ---------------------------------------------------------------------- |
| Default       | Role, label, affordance, and reading order are clear.                  |
| Hover         | Pointer feedback without layout shift.                                 |
| Focus-visible | Persistent, high-contrast ring that is not clipped.                    |
| Pressed       | Immediate feedback without duplicate activation.                       |
| Selected      | Native state plus a visual treatment beyond color alone.               |
| Disabled      | Inert but readable, with a clear reason where useful.                  |
| Loading       | Progress is communicated without losing the accessible name.           |
| Empty/error   | Explain the state and provide a recoverable next action when possible. |

Icon-only controls require an `aria-label`; visible labels are preferred when
space permits. Tabs, menus, selectors, dialogs, toggles, and sliders must
expose their selected, expanded, checked, or disabled state through native
semantics or the shared behavior primitive. Keyboard order follows visual
reading order. Escape/backdrop dismissal is available where appropriate, and a
closed modal restores focus to its invoking control. Tooltips supplement labels;
they never replace them. Meaningful artwork gets an accessible name or an
explicitly decorative classification.

## Surface contracts

These are stable product decisions, not a replacement for a detailed feature
spec. If a surface develops substantial new behavior, move that detail into an
owning document and keep only the reusable pattern here.

### HUD and menu

The bottom HUD rail exposes Hero, HP, Inventory, Equipment, Abilities, and Menu
actions. It is compact, touch-friendly, and remains the readable foreground
surface. The Menu is an icon-first grid for secondary destinations such as Map,
Crafting, Journal, Talents, and Options. Use Lucide icons for generic actions;
use Backpack for Inventory, Swords for Equipment, Sparkles for Abilities, and
Menu for the menu action; reserve authored art for Hero and item content. Each
icon-only control still needs a stable accessible name.

### Hero

Hero details keep native-ratio Hero art beside a content-sized stats list when
the viewport permits. Narrow or short layouts may stack those regions and use
the owning surface's scroll behavior. The art surface is a direct layout child
when no visual card is intended; do not add decorative wrapper panels just to
make columns look equal.

### Inventory

Inventory is an items-only square grid with visible category tabs and a compact
sort popover. Tabs remain visible without horizontal scrolling and expose an
accessible label. Cells show icon and quantity; names and descriptions belong
in the selected Item Detail surface. The grid uses fixed responsive capacity
and explicit pagination rather than an inner scroll region. Desktop may keep a
persistent inspector; compact layouts may replace it with a detail subview.
Clicking the active category returns to all items. Drag-and-drop and manual
reordering are out of scope.

### Equipment and tools

Equipment is a dedicated HUD destination with native-ratio Hero art behind a
loadout. The paper doll uses a shared square slot size and the approved layout:
Helm; Main Hand / Body / Off-Hand; Gloves / Belt / Boots; followed by a single
jewelry row (Amulet, Trinket, Ring 1, Ring 2) and a single tools row (Axe,
Pickaxe, Hammer, Shovel). Empty slots remain actionable and readable.
Equipment and tool choices open focused selector submenus and return to the
loadout after selection.

### Abilities

Basic, Skill, and Ultimate are large native-ratio artwork cards. Ability art
keeps its native 3:4 ratio in loadout and selector views. Choosing a card opens
a focused selector; selection returns to the loadout, with selected state and
artwork carrying the hierarchy.

### Map

Map is a read-only, centered framed overlay on large viewports and an adaptive
full-height surface when needed. It distinguishes explored, remembered,
unexplored, and Hero states, keeps cells square, and does not let presentation
preferences redefine simulation semantics.

### Options

Options uses behavior-backed tabs for Display, Audio, Gameplay, Controls, and
Accessibility. Changes apply immediately and clearly report whether they are
saved locally or depend on a platform adapter. Show Grid remains a
client-side presentation preference. Key bindings keep Escape reserved for
dismissal. Reduce Motion changes presentation only, never simulation rules.

### Selectors and Action Hand

`.torch-select` and other selectors use shared behavior for focus, keyboard
navigation, outside dismissal, and Escape. Copy stays concise. The Action Hand
is anchored to the HUD rail; cards fan upward from behind it with a shallow
tuck. Hover, focus, press, and upward-drag states provide direct feedback, and
availability never relies on motion alone. A resolved card hands off to
transient feedback before the next stable layout is revealed. Reduced motion
shortens the handoff and removes decorative movement without changing action
semantics.

## React, Phaser, and library policy

Lucide React is the default generic icon library. Base UI supplies behavior for
dialogs, tabs, menus, popovers, and selectors. The checked-in shadcn source
components are Torch-owned, themeable source; they are not a remote black-box
design system.

Feature screens must import shared behavior through `src/ui/primitives.tsx`.
Keep standard interaction behavior in those primitives and keep game-specific
composition in the feature. Do not import the vendor package directly from a
feature or reimplement a combobox, listbox, dialog, or focus trap per screen.

## Content and artwork

Copy is sentence case, scannable, and resilient to long names, quantities,
localization, empty states, and errors. Do not truncate a meaningful label
without preserving a useful accessible name. Preserve authored artwork's
native ratio and use intentional thumbnail/world-token variants for crops.

## Governance and verification

Add a token when a value has a repeated semantic role or a state must be
consistent across surfaces. Add a primitive when behavior and accessibility
are shared by at least two surfaces. Record a documented exception when a
screen intentionally breaks a system default. Deprecate replaced tokens and
primitives with a migration note before removal.

For every new surface, review all applicable default, hover, focus-visible,
pressed, selected, disabled, loading, empty, error, long-content, keyboard,
touch, reduced-motion, portrait, landscape, and short-viewport states. Browser
checks should assert semantic labels, focus order, geometry, overflow,
dismissal/focus restoration, responsive behavior, and console cleanliness.
Capture screenshots for meaningful states and inspect high-DPI rendering when
artwork or fine borders matter. Run the closest unit/browser checks and
`npm run verify` before handoff. Do not claim a visual or performance result
without checking the rendered experience; review on real mobile hardware before
making device-feel claims.
