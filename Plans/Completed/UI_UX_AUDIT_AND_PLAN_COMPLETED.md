# Torch UI/UX Audit and Improvement Plan

Archive status: completed for the current scope; deferred follow-ups are tracked
in `ROADMAP.md`.

Date: 2026-07-31

## Audit scope and method

This review covers the first playable slice's React overlay, Phaser board
presentation, HUD, action hand, menus, selectors, and settings. I reviewed the
source contracts in `AGENTS.md`, `DESIGN_SYSTEM.md`, and `ARCHITECTURE.md`, then
walked the running game in the in-app browser at the desktop viewport, taking a
screenshot after each meaningful state and interacting with the reachable
controls:

- gameplay board, movement, fog/terrain, Hero token, and contextual Chop card
- HUD Hero, HP, Inventory, Equipment, Abilities, and Main Menu actions
- Main Menu, Map, Settings, Inventory, Hero, Equipment, equipment/tool pickers,
  Abilities, and ability picker surfaces
- Inventory category tabs, sort menu, selection/detail state, Settings tabs,
  toggles, sliders, and key-binding presentation
- menu dismissal, back navigation, and action-card disabled feedback

Computer Use was initialized as requested, but the desktop safety layer does
not permit interaction with the Codex host application itself. The local game
was therefore reviewed through the in-app browser automation surface instead;
the visual screenshots and interaction states below are from the running game.

Severity: P0 blocks the primary journey; P1 is a visible functional or
accessibility defect; P2 is a meaningful usability or polish issue; P3 is a
refinement opportunity.

## Restoration completed in this pass

The global content-fit menu experiment has been superseded by the previous
fixed wide-menu contract:

- wide menus return to `min(94vw, 960px)` by `min(82dvh, 760px)`
- the board remains mounted behind an opaque menu scrim
- inner screens own scrolling instead of shrinking the modal to content
- Settings now has an explicit scroll owner for the long Key Bindings panel

This restores the earlier stable modal silhouette while preserving the newer
Equipment/charcoal work. The fixed shell intentionally leaves unused space on
short-content screens; the plan below addresses how to use that space well
without returning to globally auto-sized dialogs.

## Implementation completed from this plan

The stability and interaction portions of the audit are now implemented in the
working tree:

- Fixed wide modal shells now have explicit flex sizing and inner scroll owners;
  the board remains mounted behind the scrim during every menu transition.
- Inventory uses square cards, responsive labeled category tabs, a two-row
  narrow-width toolbar, finite responsive pages, and a useful empty state. On
  compact screens, item detail becomes a contained subview instead of adding a
  second scroll region.
- Hero uses equal art/stats columns on desktop, a stacked mobile composition,
  and native-ratio art containment at both sizes.
- Equipment is now a unified Equipment surface: the paper-doll, Jewelry, and
  Tools rows share centered square slots, with consistent empty/equip copy and
  Hammer/Shovel included.
- Ability, Equipment, and Tool selectors have stable card/empty states and
  explicit scroll boundaries instead of collapsing into horizontal pills.
- Settings Key Bindings has a bounded scroll list, live rebinding status, reset
  persistence, and clear pressed/capturing semantics.
- HUD controls expose concise native tooltips, menu close restores focus to the
  launching control, and action cards expose disabled/busy/resolving states.
- Narrow review widths were corrected for clipped Inventory tabs and portrait
  Hero layout; the FPS diagnostic remains development-only.

The remaining polish items are intentionally queued rather than hidden: the
historical duplicate CSS cascade still needs consolidation, Map's nested frame
can be simplified, and the next product pass should decide how much fixed-shell
whitespace is theatrical versus compositionally useful.

## Findings by surface

### 1. Gameplay board and visual foundation

Observed state: the board is immediately legible, the Knight marker is clear,
the revealed/unrevealed distinction reads, and the dark tile boundaries are
subordinate to terrain. The board remains visible under the scrim when menus
open; no unload/reload flash was observed during this pass.

- P2 — The `60 FPS` diagnostic is visible in the player-facing corner. Keep it
  behind a development flag or move it to a diagnostics-only presentation mode.
- P2 — The board currently reads as a large centered patch of lit terrain with
  substantial unused charcoal around it. A future board framing pass should
  clarify the playable camera region and make the Torch/visibility boundary
  feel intentional rather than like an empty canvas.
- P2 — Terrain colors are strong and readable, but the grass dominates the
  first impression. Add a slightly stronger material distinction for mountain,
  ore, and unexplored terrain while retaining the charcoal/gold UI palette.
- P3 — The Hero world token is readable but small at desktop scale. Consider a
  subtle selection/range halo that does not look like a second grid.

### 2. HUD rail and Hero controls

Observed state: the bottom rail has a strong silhouette, the HP bar is clear,
and the four actions are ordered logically. Icon-only controls are compact but
rely heavily on memory.

- P2 — Add tooltip or pressed-state labels for the three generic icon actions;
  the accessible names exist, but visual discovery is weak for a first-time
  player.
- P2 — Standardize the icon-button visual states. The Hero portrait, HP rail,
  and action buttons currently read as separate materials rather than one
  coherent control group.
- P2 — Verify the rail at 320×568 with safe-area insets and an open action hand;
  the action hand intentionally tucks behind the HP pane, but the interaction
  target and card edge must remain unambiguous.
- P3 — Consider a small active-destination treatment when a menu is open so the
  player can see which HUD action launched the current screen.

### 3. Contextual action hand

Observed state: moving beside the pine reveals a single `Chop / Old Pine` card;
the card is large, readable, and visually tucked behind the HP pane as intended.
After activation it becomes disabled while the action resolves.

- P1 — Add explicit resolving feedback beyond the disabled state: a short
  progress/impact treatment and a deterministic return to the ready state.
  This should be tested for gathering, combat, and ability cards.
- P2 — Make the card's hierarchy more immediate: action verb first, target
  second, and a consistent icon size/weight across Chop, Mine, Attack, and
  abilities.
- P2 — Define the two-card and three-card layouts explicitly. The single-card
  state is good, but the fan/overlap needs a visual review at narrow widths and
  with long target names.
- P3 — Add a visible focus treatment that is distinct from hover and remains
  readable over the board.

### 4. Main Menu

Observed state: the fixed menu has a clean header and five icon tiles. Map and
Settings are active; Crafting, Journal, and Talents are visibly disabled.

- P2 — The 3-column first row and 2-item second row leave the second row
  visually left-biased. Either use a deliberate centered last row or adopt a
  consistent two-column menu grid.
- P2 — Disabled destinations are dim but do not explain why they are disabled.
  Add a locked/coming-soon affordance or remove them until they have a useful
  destination.
- P2 — The icon tiles and labels need a single shared selected/hover/focus
  language. Active labels are bright; disabled labels are close to the muted
  background and lose hierarchy.
- P3 — The menu title and close button have strong visual weight; reduce the
  close control's ring prominence when it is not focused so it does not compete
  with the destination grid.

### 5. Inventory

Observed states: all-items grid, Resources filter, sort menu, selected item,
and Item Detail. Square item cards are consistent and rounded; the detail pane
has a clear kicker, icon, name, description, and quantity.

- P1 — The Inventory surface must keep a finite visible page at short heights.
  The fixed modal should never clip the final row or its quantity; when the
  collection exceeds the visible capacity, pagination is the navigation affordance.
- P2 — Category tabs are icon-only visually. Keep accessible labels, but add a
  tooltip, short label, or responsive label treatment so players do not have to
  guess sword/tree/flask/box meanings.
- P2 — The selected card's double gold treatment is visually heavy. Use one
  border plus a small inset/selected marker and reserve the strongest ring for
  keyboard focus.
- P2 — The sort trigger is compact and clear, but the menu needs stronger
  selected-state contrast and a predictable dismissal path on touch.
- P2 — The fixed shell leaves a large empty region when only a few items are
  visible. Preserve the fixed modal, but give the grid a stable content column
  and make Item Detail occupy a deliberate companion region rather than letting
  the whole surface feel unfinished.
- P3 — Add an explicit empty-state treatment for a category with no items,
  including a useful next action.

### 6. Hero

Observed state: native-ratio Knight art and a Stats pane are side-by-side, with
clear gold values and a readable one-column stat list. The fixed shell leaves
unused space below the art while the Stats pane stretches to the modal height.

- P1 — Equalize the visual panes without distorting art: use a shared art/stats
  frame height, contain the art inside it, and give the lower space a deliberate
  secondary content treatment or remove the unused area inside the fixed frame.
- P2 — Add a small Hero identity block (role, level/progression placeholder,
  or current equipment summary) so the Stats pane is not only five numbers.
- P2 — Make the artwork-to-stats relationship explicit with consistent internal
  padding and a single shared border treatment; the current art has no visible
  container while the Stats pane does.
- P3 — Define the portrait behavior at 390×844 and 320×568: preserve the art
  ratio, keep the stat values reachable, and avoid a barely readable two-column
  squeeze.

### 7. Equipment and selectors

Observed state: Equipment has native-ratio Hero art behind the paper-doll,
square equipment slots, a jewelry row, and a tool row containing Axe, Pickaxe,
Hammer, and Shovel. The overall charcoal/gold direction is coherent.

- P1 — The Tools row is not aligned to the same centerline as the Jewelry and
  paper-doll clusters. Make the three groups share one explicit grid width and
  center each row within it.
- P2 — Slot labels are very small over the art treatment. Increase minimum type
  size and use a consistent two-line label/value rule for equipped and empty
  states.
- P2 — Empty slots currently repeat `Empty` in an aria label but provide little
  visual guidance. Add a consistent empty-slot affordance and a short “Equip”
  hint on focus/hover.
- P2 — The blurred Hero backdrop is atmospheric but competes with slot edges at
  the lower rows. Keep the subtle blur request, but tune dimming and contrast so
  every border remains legible without a heavy dark veil.
- P1 — Equipment and Tool picker screens show one small choice card in a very
  large fixed surface. Their card geometry should be standardized and the empty
  space should be used intentionally (preview/detail) or given a dedicated
  compact selector layout while preserving the fixed top-level modal contract.
- P2 — Back buttons are semantically named and work, but the picker header does
  not visually communicate the parent path beyond the arrow. Add a compact
  breadcrumb/context label or consistent “Equipment → Main Hand” treatment.

### 8. Abilities and selectors

Observed state: the main loadout cards have strong authored art, a clear Basic /
Skill / Ultimate hierarchy, and native-ratio artwork. The fixed modal leaves a
large unused lower region.

- P1 — The Ability selector is visually broken: the selected/available ability
  renders as a thin horizontal pill with its artwork effectively missing.
  Restore the selector card's native-ratio art, name, description, and selected
  state before further polish.
- P2 — Long-press detail is discoverable only through behavior; add a visible
  affordance or secondary detail button while retaining touch hold support.
- P2 — Ability cards use strong art but small labels. Increase label legibility
  and ensure the role label and ability name remain distinct at compact scale.
- P2 — Give the fixed modal's unused space a deliberate role or keep the card
  grid vertically centered with a stable maximum width; avoid a top-heavy
  composition.
- P3 — Selector empty/loading/error states should use the same card language as
  Equipment pickers.

### 9. Map

Observed state: Map is framed with rounded corners, generous padding, no tile
grid lines, and a centered Hero token. The fixed modal now provides a stable
large map viewport.

- P2 — The map currently has several nested borders/shadows (modal, viewport,
  grid) that read as stacked frames. Keep one outer frame and one map frame;
  remove the least informative inner ring.
- P2 — The large unexplored charcoal area is readable but visually empty. Add a
  restrained legend or a subtle “unexplored” treatment without reintroducing a
  gameplay grid color.
- P2 — Confirm the map remains useful when explored bounds grow: map cell size,
  Hero token minimum size, and scroll/fit behavior need short-viewport tests.
- P3 — Add a concise map subtitle or explored-area count only if it helps the
  player understand what the frame represents; do not reintroduce a toolbar that
  competes with the map.

### 10. Settings

Observed states: Display, Audio, Gameplay, and Key Bindings tabs.

- P1 — Key Bindings content extends beyond the fixed panel. The panel needs a
  visible internal scroll region, a persistent Reset Defaults action, and a
  clear indication of which binding is waiting for replacement.
- P2 — Display controls are understandable, but the UI Scale combobox exposes a
  hidden textbox in the accessibility tree. Simplify the primitive so the
  combobox has one semantic control and one visible value.
- P2 — Audio sliders are visually strong; add keyboard value adjustment hints
  and ensure thumb/focus contrast remains clear at reduced motion and compact
  scale.
- P2 — Gameplay toggles are consistent, but “On/Off” buttons should share a
  clear pressed-state pattern with Show Grid and Reduce Motion.
- P2 — Key chips (`W`, `↑`, etc.) are visually compact but do not show an
  obvious edit affordance. Add focus/selected/rebinding states and a cancel
  path that is distinct from Escape's global dismissal behavior.
- P3 — The footer note is useful during development but should be shortened or
  moved to an About/help surface once settings persistence is implemented.

### 11. Cross-cutting interaction and accessibility review

- P1 — Each fixed-height screen that can exceed its frame needs one explicit
  scroll owner. Inventory is the exception: it uses finite pagination and a
  contained compact detail subview. Test all of these contracts at 1170×624,
  390×844, and 320×568.
- P1 — Focus restoration should be tested for open/close, Escape, backdrop,
  picker back, tabs, sort menu, and ability detail. Focus rings must remain
  inside the fixed modal without being clipped.
- P2 — Keep the source-of-truth chain centralized: token layer → semantic
  variables → shared primitives → feature layout. The stylesheet has many
  historical duplicate cascade blocks; consolidate them before adding more
  one-off overrides.
- P2 — Audit all feature-local color literals. Charcoal/gold should come from
  canonical tokens, with only authored terrain/art colors exempt.
- P2 — Verify all hit targets stay at least 42px, especially icon-only tabs,
  picker cards, key chips, slider thumbs, close/back buttons, and action cards.
- P3 — Run a reduced-motion pass and ensure only nonessential opacity/transform
  transitions are removed; layout must not shift during menu open/close.

## Recommended implementation plan

### Phase 0 — Restore stability and fix visible defects

1. Keep the fixed wide modal shell and document its size tokens.
2. Repair Ability selector card rendering and add a browser assertion for
   native-ratio artwork, selected state, and readable copy.
3. Add explicit scroll containers for Key Bindings and every selector that can
   exceed the fixed frame. Keep Inventory finite with pagination instead of an
   inner scroll region.
4. Align Equipment, Jewelry, and Tools to a shared grid width and verify all
   square slots at the four review viewports.
5. Hide the FPS diagnostic outside development builds.

### Phase 1 — Establish a fixed-modal composition system

1. Define fixed shell variants (standard, wide, map) using canonical tokens;
   keep content fit as an inner layout concern, never a global modal rule.
2. Define one reusable surface contract for title row, close control, content
   padding, scroll owner, empty state, and footer/action region.
3. Define one reusable square-slot contract for Inventory, Equipment, Tools,
   and selectors: size, radius, icon box, label/value, selected, hover, focus,
   disabled, and empty states.
4. Consolidate the historical duplicate CSS blocks into one final cascade per
   surface so fixes cannot be silently undone by later prototypes.

### Phase 2 — Information hierarchy and discoverability

1. Add visible/tooltip labels for icon-only Inventory categories and HUD actions.
2. Make disabled Main Menu destinations explain their state or remove them.
3. Give Hero, Equipment, and Ability surfaces a stronger identity/summary
   hierarchy, not just art plus controls.
4. Add explicit detail affordances for hold-to-open ability details.
5. Standardize picker headers and back/breadcrumb context.

### Phase 3 — Responsive, keyboard, and motion quality

1. Verify 1280×720, 1170×624, 390×844, and 320×568 with screenshots and
   geometry assertions.
2. Verify Tab order, Escape, backdrop dismissal, focus restoration, selected
   tabs, sort menu dismissal, sliders, toggles, and rebinding cancellation.
3. Verify reduced motion, long labels, empty categories, long inventories,
   missing artwork, and loading/error states.
4. Tune action-hand overlap and feedback across gathering, combat, and ability
   resolution without covering the HP value or blocking taps.

### Phase 4 — Visual polish and product decisions

1. Simplify Map's nested framing and establish a single visual grammar for
   modal/viewport/content borders.
2. Tune charcoal elevation levels and gold usage against contrast measurements.
3. Decide whether fixed modal whitespace is intentionally theatrical or whether
   each surface should have a stable internal composition template.
4. Decide whether Inventory category tabs remain icon-first or gain responsive
   text labels.
5. Decide whether locked Main Menu destinations remain visible in the first
   slice, and define their product copy.

## Acceptance criteria for the next UI pass

- No clipped controls, cards, labels, quantities, key bindings, or selector art
  at any review viewport.
- Every screen has one obvious scroll owner, or a finite pagination/detail
  contract, plus one obvious dismissal/back path.
- Equipment, Tools, Inventory, and Ability selectors share the same square-card
  geometry and state language where their content permits.
- Focus is visible, restored correctly, and never appears as browser-blue or a
  ring clipped by overflow.
- The board stays mounted and visually stable while every menu opens, closes,
  switches tabs, opens a picker, or opens a detail surface.
- The fixed modal shell is consistent, while each interior composition uses
  space deliberately instead of relying on accidental whitespace.

## Current verification and handoff

The fixed-size restoration and Settings scroll-owner adjustment were applied in
the working tree. The visual audit used the running local app and screenshots;
no commit or staging was performed. Existing unrelated work remains dirty and
was preserved.

Checks run:

- `npm run typecheck` — passed.
- `npm test` — passed, 9 files / 48 tests.
- `npm run build` — passed; Vite emitted the existing large-chunk warning.
- `git diff --check` — passed.
- `npm run verify` — passed, 6 browser tests; the browser
  emitted the existing development frame-hitch diagnostics while running.
- The Hero geometry test now asserts the fixed-shell contract: contained
  native-ratio art, equal desktop columns, and stacked portrait panes.
- The contextual-action test now activates the card directly, making the
  resolving-state assertion deterministic instead of depending on keyboard
  repeat timing.

The worktree remains intentionally uncommitted and contains prior unrelated
changes that were preserved.
