# Torch UI Design System

Torch has two presentation layers: Phaser renders the world and React renders menus, HUD, dialogs, and other interface surfaces. The React layer should feel like one game UI, not a collection of unrelated screens.

## Direction

- Use a dark charcoal surface system with warm gold accents.
- Use Inter for all product UI typography. The development FPS diagnostic may
  use a compact technical face independently of the product UI.
- Keep the game board unobstructed; persistent HUD is compact and menus are centered overlays.
- Prefer readable, touch-friendly controls with a minimum 42 px hit target.
- Preserve artwork aspect ratios. Crop only when a component explicitly calls for a thumbnail or world token.
- Use Lucide icons for generic interface actions. Use authored art only when the art itself communicates game content.

## Tokens

Shared spacing, radii, borders, surfaces, and typography tokens live in `src/styles.css` under `:root` (`--ui-space-*`, `--ui-panel-*`, and `--ui-*`). New UI should consume those tokens instead of introducing one-off pixel values.

Core color tokens include:

| Token | Value | Use |
| --- | --- | --- |
| `--ui-color-background` | `#080b10` | board/page background |
| `--ui-color-surface` | `rgb(12 17 24 / 92%)` | centered menu surfaces |
| `--ui-color-surface-panel` | `rgb(12 17 24 / 88%)` | controlled glass surface for menu panes and popovers |
| `--ui-color-surface-hud` | `rgb(12 17 24 / 84%)` | bottom HUD rail, including the Hero HP area |
| `--ui-color-accent` | `#f2c463` | gold headings, labels, values, and emphasis |
| `--ui-color-text` | `#f5ead4` | primary body text |
| `--ui-color-heading` | `#fff1d1` | major headings and selected text |
| `--ui-color-muted` | `#aeb9c0` | secondary text |

Alpha variants of the gold accent and border color should remain visually
consistent with these tokens rather than introducing a new gold hue.

The current spacing scale is 4 px based:

| Token | Value | Typical use |
| --- | ---: | --- |
| `--ui-space-1` | 4 px | tight inline spacing |
| `--ui-space-2` | 8 px | icon/control gaps |
| `--ui-space-3` | 12 px | compact card padding |
| `--ui-space-4` | 16 px | section gaps |
| `--ui-space-5` | 20 px | panel padding |
| `--ui-space-6` | 24 px | large section spacing |

## Layout contracts

- `.menu-panel` is the shared centered dialog surface. Its glass treatment is
  controlled by `--ui-color-surface-panel` and
  `--ui-panel-backdrop-filter`; keep the opacity and blur moderate so the map
  adds atmosphere without reducing content legibility.
- `.menu-panel-wide` is the responsive detail surface for screens such as Hero and Inventory.
- `.hero-details` owns responsive art/stat composition; full artwork and the stats card remain side by side in both landscape and portrait layouts, shrinking their columns as needed.
- In every Hero layout, full artwork and the stats card share the details region's left/right content edges while the artwork preserves its native aspect ratio.
- `.stats-panel` is a content-sized card and should not stretch merely to match artwork height.
- A full artwork surface should be a direct layout child when no visual card is intended. Do not add decorative wrapper panels around it.
- Inventory uses a square responsive grid. It defaults to all items; clicking the active category tab toggles back to all items. Cells show an icon and quantity only; item names and descriptions belong in the selected Item Detail surface.
- Inventory category tabs are icon-first and always carry an accessible label. Sorting is a compact custom popover control aligned with the tab row. Drag-and-drop and manual reordering are intentionally out of scope.
- The main menu contains secondary destinations only. Hero, Inventory, Equipment, and Abilities are dedicated HUD actions.
- Hero details keep only the native-ratio Hero art beside Stats at every orientation and target a no-scroll experience in normal device viewports. Equipment and Abilities each have a dedicated centered screen: Equipment uses a human-centric paper-doll slot layout, while Abilities uses a readable slot list. Clicking a slot opens an inline picker without leaving the loadout context, and both screens reserve larger art surfaces for future authored assets. Ability art is always rendered with its native 3:4 ratio, including previews and picker cards.
- `.torch-select` is the shared dark/gold select primitive for settings and other small option lists. It uses a semantic combobox/listbox, a compact popover, visible selected state, Escape dismissal, and outside-click dismissal instead of browser-native select styling.
- Settings uses the same centered wide panel and groups controls by Display, Audio, and Gameplay. Prototype controls should clearly indicate when persistence or platform adapters are not yet connected.

## Component and accessibility rules

- Use semantic buttons, headings, sections, and definition lists where appropriate.
- Every icon-only button needs an accessible `aria-label`.
- Keep focus states visible and preserve Escape/backdrop dismissal for modal surfaces.
- Keep reusable primitives small: panel, card, icon button, list row, stat row, and modal behaviors should be shared before introducing screen-specific variants.
- Add a responsive browser test whenever a screen has a landscape/portrait contract.

## Library policy

Lucide React is the default icon library. We are intentionally keeping the visual system as Torch-owned CSS tokens and primitives rather than adopting a full web admin design system. A component kit such as Radix or shadcn/ui can be added later for complex accessible interactions (tabs, popovers, command menus), but its defaults must consume Torch tokens and remain subordinate to the game UI.
