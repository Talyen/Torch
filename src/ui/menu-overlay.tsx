import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, ReactElement } from 'react';
import {
  Axe,
  Accessibility,
  Backpack,
  ArrowLeft,
  BookOpen,
  Check,
  CircleEllipsis,
  Coins,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FlaskConical,
  Filter,
  Gem,
  Gamepad2,
  Hammer,
  Keyboard,
  ListFilter,
  Map as MapIcon,
  Menu as MenuIcon,
  Monitor,
  PackageOpen,
  Pin,
  Pickaxe,
  RotateCcw,
  Settings2,
  Shield,
  Shovel,
  Sparkles,
  Swords,
  Sword,
  TreePine,
  Volume2,
  X as CloseIcon,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { gameSession } from '../game/session';
import { heroAssets } from '../content/hero-assets';
import { heroDefinitions } from '../content/heroes';
import { abilities, abilitySlots } from '../content/abilities';
import type { AbilitySlotId } from '../content/abilities';
import { equipmentSlots } from '../content/equipment';
import type { EquipmentSlotId } from '../content/equipment';
import { toolSlots, tools } from '../content/tools';
import type { ToolSlotId } from '../content/tools';
import { inventoryCategories, inventoryItemsForState } from '../content/inventory';
import type { InventoryCategory, InventoryIconId, InventoryItemDefinition } from '../content/inventory';
import { itemDefinition } from '../content/items';
import type { ItemDefinition } from '../content/items';
import {
  clampInventoryPage,
  filterAndSortInventoryItems,
  inventoryLayoutForViewport,
  inventoryPageCount,
  inventoryPageItems,
  inventoryPageRange,
  inventoryDetailVisible,
} from './inventory-pagination';
import type { InventoryLayout, InventorySort } from './inventory-pagination';
import { mapFitForViewport } from './responsive-layout';
import { useElementSize } from './use-element-size';
import { abilityActionDefinition, positionKey, resolvedWaypointPosition, tileAt } from '../sim';
import type { GameState, Position, ProfileJournalState, SimEvent } from '../sim';
import { journalEntryDefinition } from '../content/journal';
import {
  PRESENTATION_SETTINGS_EVENT,
  readPresentationSettings,
  resetPresentationSettings,
  setPresentationSetting,
} from '../game/presentation-settings';
import type { PresentationSettings, PresentationSettingKey } from '../game/presentation-settings';
import { ContextActionHand } from './context-action-hand';
import { feedbackAnnouncementForBatch } from '../game/feedback-presenter';
import { CraftingScreen } from './crafting-screen';
import { JournalScreen } from './journal-screen';
import {
  TorchButton,
  TorchArtworkCard,
  TorchDialog,
  TorchIconButton,
  TorchMenuContent,
  TorchMenuRadioGroup,
  TorchMenuRadioItem,
  TorchMenuRoot,
  TorchMenuTrigger,
  TorchSelectField,
  TorchTabsContent,
  TorchTabsList,
  TorchTabsRoot,
  TorchTabsTab,
} from './primitives';
import {
  formatBindingKey,
  defaultKeyBindings,
  keyBindingDefinitions,
  KEY_BINDINGS_EVENT,
  OPEN_JOURNAL_EVENT,
  OPEN_MAP_EVENT,
  readKeyBindings,
  setKeyBindings,
  updateKeyBinding,
} from '../game/input-bindings';
import type { KeyBindingAction, KeyBindings } from '../game/input-bindings';

type MenuItem = {
  label: string;
  icon: LucideIcon;
  screen: Screen;
  available?: boolean;
  disabledReason?: string;
  testId?: string;
};

type Screen = 'menu' | 'hero' | 'inventory' | 'gear' | 'crafting' | 'abilities' | 'journal' | 'map' | 'settings';

const menuItems: MenuItem[] = [
  { label: 'Map', icon: MapIcon, screen: 'map', available: true },
  { label: 'Crafting', icon: Hammer, screen: 'crafting', available: true, testId: 'menu-crafting' },
  { label: 'Journal', icon: BookOpen, screen: 'journal', available: true, testId: 'menu-journal' },
  { label: 'Talents', icon: Sparkles, screen: 'menu', disabledReason: 'Coming in a later phase' },
  { label: 'Options', icon: Settings2, screen: 'settings', available: true, testId: 'menu-settings' },
];

const HERO_STAT_LABELS = {
  strength: 'Strength',
  agility: 'Agility',
  toughness: 'Toughness',
  wisdom: 'Wisdom',
  intellect: 'Intellect',
} as const;

const SCREEN_TITLES: Record<Screen, string> = {
  menu: 'Menu',
  hero: 'Hero',
  inventory: 'Inventory',
  gear: 'Equipment',
  crafting: 'Crafting',
  abilities: 'Abilities',
  journal: 'Journal',
  map: 'Map',
  settings: 'Options',
};

const SCREEN_TRIGGER_TEST_IDS: Partial<Record<Screen, string>> = {
  hero: 'hud-hero-button',
  inventory: 'hud-inventory-button',
  gear: 'hud-gear-button',
  abilities: 'hud-abilities-button',
  menu: 'menu-button',
};

const sortOptions = [
  { value: 'category', label: 'Default' },
  { value: 'name', label: 'Name' },
  { value: 'quantity', label: 'Quantity' },
] as const;

const inventoryIcons: Record<InventoryIconId, LucideIcon> = {
  sword: Sword,
  tree: TreePine,
  flask: FlaskConical,
  gem: Gem,
  sparkles: Sparkles,
  coins: Coins,
  package: PackageOpen,
  ellipsis: CircleEllipsis,
};

const equipmentSlotIcons: Record<EquipmentSlotId, LucideIcon> = {
  'main-hand': Sword,
  'off-hand': Shield,
  helm: Shield,
  body: Shield,
  gloves: Sparkles,
  boots: PackageOpen,
  belt: CircleEllipsis,
  'ring-1': Gem,
  amulet: Gem,
  trinket: Sparkles,
};

const toolSlotIcons: Record<ToolSlotId, LucideIcon> = {
  axe: Axe,
  pickaxe: Pickaxe,
  hammer: Hammer,
  shovel: Shovel,
};

export function MenuOverlay(): ReactElement {
  const [open, setOpen] = useState(false);
  const [screen, setScreen] = useState<Screen>('menu');
  const [gameState, setGameState] = useState(() => gameSession.state);
  const [profileJournal, setProfileJournal] = useState<ProfileJournalState>(() => gameSession.profileJournal);
  const [gameEvents, setGameEvents] = useState<SimEvent[]>([]);
  const [feedbackAnnouncement, setFeedbackAnnouncement] = useState('');
  const [heroStatus, setHeroStatus] = useState(() => ({
    health: gameSession.state.hero.health,
    maxHealth: gameSession.state.hero.maxHealth,
  }));
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const returnFocusTestIdRef = useRef<string | null>(null);
  const previousOpenRef = useRef(false);
  const gameplayHudRef = useRef<HTMLDivElement>(null);
  const hudRailRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsubscribe = gameSession.subscribe((state, events, profile) => {
      setGameState(state);
      setProfileJournal(profile);
      setGameEvents(events);
      setHeroStatus({
        health: state.hero.health,
        maxHealth: state.hero.maxHealth,
      });
    });
    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    const unsubscribe = gameSession.subscribeActionBatches((batch) => {
      const announcement = feedbackAnnouncementForBatch(batch);
      if (announcement) setFeedbackAnnouncement(announcement);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    gameSession.setInputMode(open ? 'ui' : 'world');
    document.body.dataset.menuOpen = String(open);

    return () => {
      gameSession.setInputMode('world');
      delete document.body.dataset.menuOpen;
    };
  }, [open]);

  useEffect(() => {
    const handleOpenMap = (): void => {
      setScreen('map');
      setOpen(true);
    };
    const handleOpenJournal = (): void => {
      gameSession.recordProfileObservation('open-journal');
      setScreen('journal');
      setOpen(true);
    };
    window.addEventListener(OPEN_MAP_EVENT, handleOpenMap);
    window.addEventListener(OPEN_JOURNAL_EVENT, handleOpenJournal);
    return () => {
      window.removeEventListener(OPEN_MAP_EVENT, handleOpenMap);
      window.removeEventListener(OPEN_JOURNAL_EVENT, handleOpenJournal);
    };
  }, []);

  const openMenu = (nextScreen: Screen = 'menu', invoker?: HTMLElement | null): void => {
    const triggerTestId = invoker?.dataset.testid ?? SCREEN_TRIGGER_TEST_IDS[nextScreen] ?? null;
    returnFocusTestIdRef.current = triggerTestId;
    returnFocusRef.current =
      invoker ??
      (triggerTestId ? document.querySelector<HTMLElement>(`[data-testid="${triggerTestId}"]`) : null) ??
      (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    setScreen(nextScreen);
    setOpen(true);
    if (nextScreen === 'inventory') gameSession.recordProfileObservation('open-inventory');
    if (nextScreen === 'journal') gameSession.recordProfileObservation('open-journal');
  };

  const restoreMenuFocus = useCallback((): void => {
    const target =
      returnFocusRef.current ??
      (returnFocusTestIdRef.current
        ? document.querySelector<HTMLElement>(`[data-testid="${returnFocusTestIdRef.current}"]`)
        : null);
    if (!target || !document.contains(target)) return;
    target.focus({ preventScroll: true });
  }, []);

  const scheduleMenuFocusRestore = useCallback((): void => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        restoreMenuFocus();
        window.setTimeout(restoreMenuFocus, 120);
        window.setTimeout(restoreMenuFocus, 300);
      });
    });
  }, [restoreMenuFocus]);

  const handleMenuOpenChange = (nextOpen: boolean): void => {
    setOpen(nextOpen);
    if (!nextOpen) scheduleMenuFocusRestore();
  };

  useEffect(() => {
    if (previousOpenRef.current && !open) scheduleMenuFocusRestore();
    previousOpenRef.current = open;
  }, [open, scheduleMenuFocusRestore]);

  useEffect(() => {
    const host = gameplayHudRef.current;
    const rail = hudRailRef.current;
    if (!host || !rail) return;

    const syncRailHeight = (): void => {
      host.style.setProperty('--hud-rail-height', `${rail.getBoundingClientRect().height}px`);
    };
    syncRailHeight();
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(syncRailHeight);
    observer?.observe(rail);
    window.addEventListener('resize', syncRailHeight);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', syncRailHeight);
    };
  }, [open]);

  const hpRatio = heroStatus.maxHealth > 0 ? Math.max(0, Math.min(1, heroStatus.health / heroStatus.maxHealth)) : 0;

  return (
    <>
      <div ref={gameplayHudRef} className="gameplay-hud" data-testid="gameplay-hud">
        <div className="sr-only" role="status" aria-live="polite" data-testid="combat-feedback-announcement">
          {feedbackAnnouncement}
        </div>
        <ContextActionHand state={gameState} events={gameEvents} hidden={open} />
        {!open ? (
          <>
            <JournalTracker state={gameState} onOpen={() => openMenu('journal')} />
            <div ref={hudRailRef} className="hud-rail" data-testid="hud-rail" aria-label="Hero controls">
              <TorchButton
                className="hud-icon-button hud-hero-button"
                type="button"
                aria-label="Open hero"
                title="Hero"
                aria-controls="torch-menu"
                data-testid="hud-hero-button"
                onClick={(event) => openMenu('hero', event.currentTarget)}
              >
                <img src={heroAssets.knight.hud} alt="" />
              </TorchButton>

              <div
                className="hud-hp"
                data-testid="hero-hp"
                aria-label={`Hero HP ${heroStatus.health} of ${heroStatus.maxHealth}`}
              >
                <div className="hud-hp-meta">
                  <span>HP</span>
                  <span>
                    {heroStatus.health}/{heroStatus.maxHealth}
                  </span>
                </div>
                <div className="hud-hp-track" aria-hidden="true">
                  <span className="hud-hp-fill" style={{ width: `${hpRatio * 100}%` }} />
                </div>
              </div>

              <TorchButton
                className="hud-icon-button"
                type="button"
                aria-label="Open inventory"
                title="Inventory"
                aria-controls="torch-menu"
                data-testid="hud-inventory-button"
                onClick={(event) => openMenu('inventory', event.currentTarget)}
              >
                <Backpack aria-hidden="true" />
              </TorchButton>

              <TorchButton
                className="hud-icon-button"
                type="button"
                aria-label="Open gear"
                title="Equipment"
                aria-controls="torch-menu"
                data-testid="hud-gear-button"
                onClick={(event) => openMenu('gear', event.currentTarget)}
              >
                <Swords aria-hidden="true" />
              </TorchButton>

              <TorchButton
                className="hud-icon-button"
                type="button"
                aria-label="Open abilities"
                title="Abilities"
                aria-controls="torch-menu"
                data-testid="hud-abilities-button"
                onClick={(event) => openMenu('abilities', event.currentTarget)}
              >
                <Sparkles aria-hidden="true" />
              </TorchButton>

              <TorchButton
                className="hud-icon-button"
                type="button"
                aria-label="Open menu"
                title="Menu"
                aria-controls="torch-menu"
                aria-expanded={open}
                data-testid="menu-button"
                onClick={(event) => openMenu('menu', event.currentTarget)}
              >
                <MenuIcon aria-hidden="true" />
              </TorchButton>
            </div>
          </>
        ) : null}
      </div>

      <TorchDialog.Root open={open} onOpenChange={handleMenuOpenChange}>
        <TorchDialog.Portal>
          <div className="menu-layer">
            <TorchDialog.Backdrop className="menu-backdrop" data-testid="menu-backdrop" />
            <TorchDialog.Viewport className="menu-viewport">
              <TorchDialog.Popup
                id="torch-menu"
                className={`menu-panel${screen !== 'menu' ? ' menu-panel-wide' : ''}`}
                initialFocus={closeButtonRef}
              >
                <div className="menu-header">
                  <div className="menu-header-main">
                    <TorchDialog.Title id="menu-title">{SCREEN_TITLES[screen]}</TorchDialog.Title>
                  </div>
                  <TorchDialog.Close
                    ref={closeButtonRef}
                    render={
                      <TorchButton
                        variant="ghost"
                        size="icon-lg"
                        className="menu-close"
                        aria-label="Close menu"
                        data-testid="close-menu"
                      />
                    }
                    onPointerDown={() => {
                      const triggerTestId = returnFocusTestIdRef.current;
                      if (triggerTestId) {
                        window.setTimeout(() => {
                          document.querySelector<HTMLElement>(`[data-testid="${triggerTestId}"]`)?.focus();
                        }, 180);
                      }
                    }}
                    onClick={scheduleMenuFocusRestore}
                  >
                    <CloseIcon aria-hidden="true" />
                  </TorchDialog.Close>
                </div>

                {screen === 'menu' ? (
                  <nav className="menu-grid" aria-label="Game menu">
                    {menuItems.map((item) => {
                      const Icon = item.icon;
                      return (
                        <TorchButton
                          variant="outline"
                          size="lg"
                          className="menu-item"
                          type="button"
                          disabled={!item.available}
                          aria-label={`${item.label}${item.available ? '' : ', coming soon'}`}
                          aria-describedby={item.available ? undefined : `menu-${item.label.toLowerCase()}-status`}
                          title={item.available ? undefined : (item.disabledReason ?? 'Coming soon')}
                          data-testid={item.testId ?? `menu-${item.label.toLowerCase()}`}
                          key={item.label}
                          onClick={item.available ? () => setScreen(item.screen) : undefined}
                        >
                          <span className="menu-item-icon" aria-hidden="true">
                            <Icon />
                          </span>
                          <span className="menu-item-label">{item.label}</span>
                          {!item.available ? (
                            <span className="menu-item-status" id={`menu-${item.label.toLowerCase()}-status`}>
                              {item.disabledReason ?? 'Coming soon'}
                            </span>
                          ) : null}
                        </TorchButton>
                      );
                    })}
                  </nav>
                ) : screen === 'hero' ? (
                  <HeroScreen state={gameState} />
                ) : screen === 'inventory' ? (
                  <InventoryScreen state={gameState} />
                ) : screen === 'gear' ? (
                  <GearPanel state={gameState} />
                ) : screen === 'crafting' ? (
                  <CraftingScreen state={gameState} events={gameEvents} />
                ) : screen === 'abilities' ? (
                  <AbilitiesScreen />
                ) : screen === 'journal' ? (
                  <JournalScreen state={gameState} profile={profileJournal} onOpenMap={() => setScreen('map')} />
                ) : screen === 'map' ? (
                  <MapScreen />
                ) : (
                  <SettingsScreen />
                )}
              </TorchDialog.Popup>
            </TorchDialog.Viewport>
          </div>
        </TorchDialog.Portal>
      </TorchDialog.Root>
    </>
  );
}

function JournalTracker({ state, onOpen }: { state: GameState; onOpen: () => void }): ReactElement | null {
  const entryId = state.journal.focusedEntryId;
  if (!entryId) return null;
  const definition = journalEntryDefinition(entryId);
  const runtime = state.journal.entries[entryId];
  if (!definition || !runtime || runtime.status === 'locked') return null;
  const objective = definition.objectives.find((candidate) => (runtime.progress[candidate.id] ?? 0) < candidate.target);
  if (!objective) return null;
  const current = runtime.progress[objective.id] ?? 0;

  return (
    <TorchButton
      variant="ghost"
      className="journal-tracker"
      type="button"
      aria-label={`Open Journal: ${definition.title}`}
      data-testid="journal-tracker"
      onClick={onOpen}
    >
      <BookOpen aria-hidden="true" />
      <span>
        <strong>{definition.title}</strong>
        <small>
          {objective.label} · {current}/{objective.target}
        </small>
      </span>
      <ChevronRight aria-hidden="true" />
    </TorchButton>
  );
}

function InventoryScreen({ state }: { state: GameState }): ReactElement {
  return <InventoryItemsPanel items={inventoryItemsForState(state)} />;
}

function inventoryItemFromDefinition(definition: ItemDefinition | undefined): InventoryItemDefinition | undefined {
  if (!definition) return undefined;
  const category =
    definition.category === 'consumable'
      ? 'consumables'
      : definition.category === 'equipment'
        ? 'equipment'
        : definition.category === 'misc'
          ? 'misc'
          : 'resources';
  return {
    id: definition.id,
    category,
    name: definition.name,
    quantity: 1,
    description: definition.description,
    icon: definition.icon,
  };
}

function InventoryItemsPanel({ items }: { items: InventoryItemDefinition[] }): ReactElement {
  const [category, setCategory] = useState<InventoryCategory | undefined>();
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [sort, setSort] = useState<InventorySort>('category');
  const [sortOpen, setSortOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [pageIndex, setPageIndex] = useState(0);
  const [detailOpen, setDetailOpen] = useState(false);
  const inventoryScreenRef = useRef<HTMLDivElement>(null);
  const measuredInventorySize = useElementSize(inventoryScreenRef);
  const itemButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const viewport =
    measuredInventorySize.width > 0 && measuredInventorySize.height > 0
      ? measuredInventorySize
      : { width: 1280, height: 720 };

  const layout = useMemo<InventoryLayout>(
    () => inventoryLayoutForViewport(viewport.width, viewport.height),
    [viewport.height, viewport.width],
  );
  const filteredItems = useMemo(() => filterAndSortInventoryItems(items, category, sort), [category, items, sort]);
  const pageCount = inventoryPageCount(filteredItems.length, layout.pageSize);
  const safePageIndex = clampInventoryPage(pageIndex, pageCount);
  const pageItems = inventoryPageItems(filteredItems, safePageIndex, layout.pageSize);
  const isCompactLayout = layout.profile === 'compact' || layout.profile === 'tiny';
  const selectedItem = pageItems.find((item) => item.id === selectedId);
  const selectedItemFromFilteredItems = filteredItems.find((item) => item.id === selectedId);
  const SelectedIcon = selectedItemFromFilteredItems ? inventoryIcons[selectedItemFromFilteredItems.icon] : undefined;
  const hasSelectedDetail = inventoryDetailVisible(Boolean(selectedItem && SelectedIcon), isCompactLayout, detailOpen);
  const activeCategoryLabel = inventoryCategories.find((item) => item.id === category)?.label;

  useEffect(() => {
    if (safePageIndex !== pageIndex) setPageIndex(safePageIndex);
    if (selectedId && !selectedItemFromFilteredItems) {
      setSelectedId(undefined);
      setDetailOpen(false);
    }
  }, [pageIndex, safePageIndex, selectedId, selectedItemFromFilteredItems]);

  const selectCategory = (nextCategory: InventoryCategory): void => {
    setCategory((currentCategory) => (currentCategory === nextCategory ? undefined : nextCategory));
    setSelectedId(undefined);
    setPageIndex(0);
    setDetailOpen(false);
  };

  const selectSort = (nextSort: InventorySort): void => {
    setSort(nextSort);
    setPageIndex(0);
    setSelectedId(undefined);
    setDetailOpen(false);
  };

  const goToPage = (nextPageIndex: number): void => {
    const nextPage = clampInventoryPage(nextPageIndex, pageCount);
    if (nextPage === safePageIndex) return;
    setPageIndex(nextPage);
    setSelectedId(undefined);
    setDetailOpen(false);
  };

  const moveItemFocus = (itemIndex: number, direction: 'left' | 'right' | 'up' | 'down' | 'first' | 'last'): void => {
    let nextIndex = itemIndex;
    if (direction === 'left') nextIndex -= 1;
    if (direction === 'right') nextIndex += 1;
    if (direction === 'up') nextIndex -= layout.columns;
    if (direction === 'down') nextIndex += layout.columns;
    if (direction === 'first') nextIndex = 0;
    if (direction === 'last') nextIndex = pageItems.length - 1;
    const nextItem = pageItems[nextIndex];
    if (!nextItem) return;
    itemButtonRefs.current[nextItem.id]?.focus();
  };

  return (
    <div
      ref={inventoryScreenRef}
      className={`inventory-screen inventory-layout-${layout.profile}${detailOpen && isCompactLayout ? ' is-detail-open' : ''}`}
      style={{ '--inventory-columns': layout.columns, '--inventory-rows': layout.rows } as CSSProperties}
    >
      <div className="inventory-heading-row">
        <div>
          <p className="inventory-kicker">Items</p>
          <p className="inventory-range" aria-live="polite">
            {inventoryPageRange(filteredItems.length, safePageIndex, layout.pageSize)}
          </p>
        </div>
        <span className="inventory-page-status" aria-live="polite">
          Page {safePageIndex + 1} of {pageCount}
        </span>
      </div>

      <div className="inventory-toolbar">
        <TorchMenuRoot open={categoryOpen} onOpenChange={setCategoryOpen}>
          <TorchMenuTrigger
            render={
              <TorchIconButton
                label={activeCategoryLabel ? `Filter inventory: ${activeCategoryLabel}` : 'Filter inventory'}
                data-testid="inventory-filter"
              >
                <Filter aria-hidden="true" />
              </TorchIconButton>
            }
            className={`inventory-filter-trigger${category ? ' is-active' : ''}`}
            aria-label={activeCategoryLabel ? `Filter inventory: ${activeCategoryLabel}` : 'Filter inventory'}
          />
          <TorchMenuContent
            container={typeof document === 'undefined' ? null : document.getElementById('torch-menu')}
            className="inventory-filter-menu"
            aria-label="Filter inventory"
            side="bottom"
            align="start"
            sideOffset={6}
          >
            <TorchMenuRadioGroup
              value={category ?? 'all'}
              onValueChange={(value) => {
                if (value === 'all') {
                  setCategory(undefined);
                  setSelectedId(undefined);
                  setPageIndex(0);
                  setDetailOpen(false);
                  return;
                }
                if (inventoryCategories.some((item) => item.id === value)) selectCategory(value as InventoryCategory);
              }}
            >
              <TorchMenuRadioItem
                className="inventory-filter-option"
                value="all"
                data-testid="inventory-tab-all"
                closeOnClick
              >
                <Filter aria-hidden="true" />
                <span>All items</span>
              </TorchMenuRadioItem>
              {inventoryCategories.map(({ id, label, icon }) => {
                const Icon = inventoryIcons[icon];
                return (
                  <TorchMenuRadioItem
                    className="inventory-filter-option"
                    value={id}
                    data-testid={`inventory-tab-${id}`}
                    key={id}
                    closeOnClick
                  >
                    <Icon aria-hidden="true" />
                    <span>{label}</span>
                  </TorchMenuRadioItem>
                );
              })}
            </TorchMenuRadioGroup>
          </TorchMenuContent>
        </TorchMenuRoot>

        <TorchMenuRoot open={sortOpen} onOpenChange={setSortOpen}>
          <div className={`inventory-sort${sortOpen ? ' is-open' : ''}`}>
            <TorchMenuTrigger
              render={<TorchButton variant="outline" size="lg" />}
              className="inventory-sort-trigger"
              aria-label="Sort inventory"
              data-testid="inventory-sort"
            >
              <ListFilter aria-hidden="true" />
              <span>{sortOptions.find((option) => option.value === sort)?.label}</span>
              <ChevronDown aria-hidden="true" />
            </TorchMenuTrigger>
            <TorchMenuContent
              container={typeof document === 'undefined' ? null : document.getElementById('torch-menu')}
              className="inventory-sort-menu"
              aria-label="Sort inventory by"
              side="bottom"
              align="end"
              sideOffset={6}
            >
              <TorchMenuRadioGroup value={sort} onValueChange={(value) => selectSort(value as InventorySort)}>
                {sortOptions.map((option) => (
                  <TorchMenuRadioItem
                    className="inventory-sort-option"
                    value={option.value}
                    key={option.value}
                    closeOnClick
                  >
                    <span>{option.label}</span>
                  </TorchMenuRadioItem>
                ))}
              </TorchMenuRadioGroup>
            </TorchMenuContent>
          </div>
        </TorchMenuRoot>
      </div>

      <div className={`inventory-content${hasSelectedDetail ? ' has-detail' : ''}`}>
        <div
          className="inventory-grid"
          data-testid="inventory-grid"
          role="grid"
          aria-label={`${category ?? 'all'} items`}
          aria-colcount={layout.columns}
          aria-rowcount={Math.max(1, Math.ceil(pageItems.length / layout.columns))}
        >
          {pageItems.map((item, itemIndex) => {
            const Icon = inventoryIcons[item.icon];
            return (
              <div
                className="inventory-cell"
                role="gridcell"
                aria-rowindex={Math.floor(itemIndex / layout.columns) + 1}
                aria-colindex={(itemIndex % layout.columns) + 1}
                key={item.id}
              >
                <TorchButton
                  className={`inventory-item${selectedId === item.id ? ' is-selected' : ''}`}
                  type="button"
                  aria-label={`${item.name}, quantity ${item.quantity}`}
                  aria-pressed={selectedId === item.id}
                  data-testid={`inventory-item-${item.id}`}
                  ref={(element) => {
                    itemButtonRefs.current[item.id] = element;
                  }}
                  onClick={() => {
                    setSelectedId(item.id);
                    if (isCompactLayout) setDetailOpen(true);
                  }}
                  onKeyDown={(event) => {
                    const navigation: Record<string, 'left' | 'right' | 'up' | 'down' | 'first' | 'last'> = {
                      ArrowLeft: 'left',
                      ArrowRight: 'right',
                      ArrowUp: 'up',
                      ArrowDown: 'down',
                      Home: 'first',
                      End: 'last',
                    };
                    const direction = navigation[event.key];
                    if (!direction) return;
                    event.preventDefault();
                    moveItemFocus(itemIndex, direction);
                  }}
                >
                  <span className="inventory-item-icon">
                    <Icon aria-hidden="true" />
                  </span>
                  <span className="inventory-item-quantity">×{item.quantity}</span>
                </TorchButton>
              </div>
            );
          })}
          {pageItems.length === 0 ? (
            <div className="inventory-empty-state" role="status">
              <PackageOpen aria-hidden="true" />
              <strong>
                {category
                  ? `No ${inventoryCategories.find((item) => item.id === category)?.label.toLowerCase() ?? 'items'} yet`
                  : 'Your inventory is empty'}
              </strong>
              <span>{category ? 'Items you find will appear here.' : 'Items you discover will appear here.'}</span>
              {category ? (
                <TorchButton variant="outline" size="sm" type="button" onClick={() => selectCategory(category)}>
                  View all items
                </TorchButton>
              ) : null}
            </div>
          ) : null}
        </div>

        {hasSelectedDetail && selectedItem && SelectedIcon ? (
          <section
            className="inventory-detail has-item"
            data-testid="inventory-detail"
            aria-label="Item detail"
            aria-live="polite"
          >
            {isCompactLayout ? (
              <TorchButton
                variant="ghost"
                size="sm"
                className="inventory-detail-back"
                type="button"
                data-testid="inventory-detail-back"
                onClick={() => setDetailOpen(false)}
              >
                <ArrowLeft aria-hidden="true" />
                Back to items
              </TorchButton>
            ) : null}
            <p className="inventory-detail-kicker">Item detail</p>
            <div className="inventory-detail-heading">
              <SelectedIcon aria-hidden="true" />
              <h2>{selectedItem.name}</h2>
            </div>
            <span className="inventory-detail-category">
              {inventoryCategories.find((item) => item.id === selectedItem.category)?.label}
            </span>
            <p>{selectedItem.description}</p>
            <span className="inventory-detail-quantity">Quantity {selectedItem.quantity}</span>
          </section>
        ) : null}
      </div>

      <div className="inventory-pagination" aria-label="Inventory pagination">
        <TorchButton
          variant="outline"
          size="sm"
          type="button"
          className="inventory-page-button"
          aria-label="Previous inventory page"
          data-testid="inventory-page-previous"
          disabled={safePageIndex === 0}
          onClick={() => goToPage(safePageIndex - 1)}
        >
          <ChevronLeft aria-hidden="true" />
          <span className="inventory-page-button-label">Previous</span>
        </TorchButton>
        <span className="inventory-pagination-label" aria-live="polite">
          Page {safePageIndex + 1} of {pageCount}
        </span>
        <TorchButton
          variant="outline"
          size="sm"
          type="button"
          className="inventory-page-button"
          aria-label="Next inventory page"
          data-testid="inventory-page-next"
          disabled={safePageIndex >= pageCount - 1}
          onClick={() => goToPage(safePageIndex + 1)}
        >
          <span className="inventory-page-button-label">Next</span>
          <ChevronRight aria-hidden="true" />
        </TorchButton>
      </div>
    </div>
  );
}

function HeroScreen({ state }: { state: GameState }): ReactElement {
  const heroDefinition =
    Object.values(heroDefinitions).find((definition) => definition.id === state.hero.heroId) ?? heroDefinitions.knight;
  const heroAsset = Object.values(heroAssets).find((asset) => asset.id === state.hero.heroId) ?? heroAssets.knight;

  return (
    <div className="hero-screen">
      <div className="hero-details">
        <img className="hero-art-full" src={heroAsset.full} alt={heroAsset.fullAlt} data-testid="hero-art-full" />

        <section className="stats-panel hero-stats-panel" aria-labelledby="hero-stats-title">
          <div className="stats-panel-header">
            <p className="stats-kicker">{heroDefinition.name}</p>
            <h2 id="hero-stats-title">Stats</h2>
          </div>
          <div className="hero-summary" aria-label="Hero status">
            <span>
              <small>Health</small>
              <strong>
                {state.hero.health}/{state.hero.maxHealth}
              </strong>
            </span>
            <span>
              <small>Turn</small>
              <strong>{state.turn}</strong>
            </span>
          </div>
          <dl className="stats-list">
            {(Object.keys(HERO_STAT_LABELS) as Array<keyof typeof HERO_STAT_LABELS>).map((stat) => (
              <div className="stat-row" key={stat}>
                <dt>{HERO_STAT_LABELS[stat]}</dt>
                <dd>{state.hero.primaryStats[stat]}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </div>
  );
}

interface MapBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

function parsePositionKey(key: string): Position | undefined {
  const [x, y] = key.split(',').map(Number);
  return Number.isInteger(x) && Number.isInteger(y) ? { x, y } : undefined;
}

function mapBounds(state: GameState): MapBounds {
  const explored = Object.keys(state.revealedTiles)
    .map(parsePositionKey)
    .filter((position): position is Position => position !== undefined);
  const positions = explored.length > 0 ? explored : [state.hero.position];
  const waypoint = resolvedWaypointPosition(state);
  const xs = [...positions.map(({ x }) => x), state.hero.position.x, ...(waypoint ? [waypoint.x] : [])];
  const ys = [...positions.map(({ y }) => y), state.hero.position.y, ...(waypoint ? [waypoint.y] : [])];
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
}

function MapScreen(): ReactElement {
  const [mapState, setMapState] = useState(() => gameSession.state);
  const mapViewportRef = useRef<HTMLDivElement>(null);
  const measuredMapViewport = useElementSize(mapViewportRef);

  useEffect(() => {
    const unsubscribe = gameSession.subscribe((state) => setMapState(state));
    return () => unsubscribe();
  }, []);

  const mapViewportSize = useMemo(() => {
    const viewport = mapViewportRef.current;
    if (!viewport) return measuredMapViewport;
    const styles = getComputedStyle(viewport);
    const horizontalPadding = Number.parseFloat(styles.paddingLeft) + Number.parseFloat(styles.paddingRight);
    const verticalPadding = Number.parseFloat(styles.paddingTop) + Number.parseFloat(styles.paddingBottom);
    return {
      width: Math.max(0, measuredMapViewport.width - horizontalPadding),
      height: Math.max(0, measuredMapViewport.height - verticalPadding),
    };
  }, [measuredMapViewport]);

  const bounds = mapBounds(mapState);
  const waypoint = resolvedWaypointPosition(mapState);
  const exploredColumns = bounds.maxX - bounds.minX + 1;
  const exploredRows = bounds.maxY - bounds.minY + 1;
  const mapSizing = mapFitForViewport(mapViewportSize.width, mapViewportSize.height, exploredColumns, exploredRows);
  const cellSize = mapSizing?.cellSize;
  const columns = mapSizing?.columns ?? exploredColumns;
  const rows = mapSizing?.rows ?? exploredRows;
  const renderBounds: MapBounds = {
    minX: bounds.minX - Math.floor((columns - exploredColumns) / 2),
    maxX: bounds.minX - Math.floor((columns - exploredColumns) / 2) + columns - 1,
    minY: bounds.minY - Math.floor((rows - exploredRows) / 2),
    maxY: bounds.minY - Math.floor((rows - exploredRows) / 2) + rows - 1,
  };
  const mapStyle = {
    '--map-columns': columns,
    '--map-rows': rows,
    '--map-cell-size': cellSize ? `${cellSize}px` : undefined,
    width: cellSize ? `${cellSize * columns}px` : undefined,
    height: cellSize ? `${cellSize * rows}px` : undefined,
  } as CSSProperties;

  const cells: Position[] = [];
  for (let y = renderBounds.minY; y <= renderBounds.maxY; y += 1) {
    for (let x = renderBounds.minX; x <= renderBounds.maxX; x += 1) {
      cells.push({ x, y });
    }
  }

  return (
    <div className="map-screen" data-testid="map-screen">
      <div className="map-viewport" ref={mapViewportRef}>
        <div
          className="map-grid"
          data-testid="map-grid"
          role="img"
          aria-label={`Explored terrain map with Hero at ${mapState.hero.position.x}, ${mapState.hero.position.y}${waypoint ? ` and waypoint at ${waypoint.x}, ${waypoint.y}` : ''}`}
          style={mapStyle}
        >
          {cells.map((position) => {
            const key = positionKey(position);
            const revealed = mapState.revealedTiles[key] === true;
            const terrain = tileAt(mapState.seed, position);
            const isHero = position.x === mapState.hero.position.x && position.y === mapState.hero.position.y;
            const isWaypoint = waypoint?.x === position.x && waypoint.y === position.y;
            return (
              <div className={`map-tile ${revealed ? `is-${terrain}` : 'is-unexplored'}`} key={key} aria-hidden="true">
                {isHero ? (
                  <span className="map-hero-token">
                    <img src={heroAssets.knight.marker} alt="Hero" />
                  </span>
                ) : null}
                {isWaypoint ? (
                  <span className="map-waypoint-token" aria-hidden="true">
                    <Pin />
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
      <div className="map-legend" aria-label="Map legend">
        <span className="map-legend-item">
          <span className="map-legend-icon" aria-hidden="true">
            <Shield />
          </span>
          Hero
        </span>
        <span className="map-legend-item">
          <span className="map-legend-icon" aria-hidden="true">
            <Pin />
          </span>
          Waypoint
        </span>
        <span className="map-legend-item">
          <span className="map-legend-swatch is-grass" aria-hidden="true" />
          Explored
        </span>
        <span className="map-legend-item">
          <span className="map-legend-swatch is-unexplored" aria-hidden="true" />
          Unexplored
        </span>
      </div>
    </div>
  );
}

function GearPanel({ state }: { state: GameState }): ReactElement {
  type GearTab = 'equipment' | 'tools';

  const [activeEquipmentSlot, setActiveEquipmentSlot] = useState<EquipmentSlotId>();
  const [selectedToolSlot, setSelectedToolSlot] = useState<ToolSlotId>();
  const [activeTab, setActiveTab] = useState<GearTab>('equipment');
  const ownedItems = inventoryItemsForState(state);

  if (activeEquipmentSlot) {
    const activeSlot = equipmentSlots.find((slot) => slot.id === activeEquipmentSlot);
    const equippedId = state.hero.equippedItems[activeEquipmentSlot];
    const equipmentForSlot = ownedItems.filter(
      (item) => itemDefinition(item.id)?.equipmentSlot === activeEquipmentSlot,
    );
    if (equippedId && !equipmentForSlot.some((item) => item.id === equippedId)) {
      const definition = itemDefinition(equippedId);
      const equippedItem = inventoryItemFromDefinition(definition);
      if (equippedItem) equipmentForSlot.push({ ...equippedItem, quantity: 0 });
    }
    return (
      <EquipmentSelectorScreen
        slot={activeSlot}
        items={equipmentForSlot}
        selectedId={equippedId}
        onBack={() => setActiveEquipmentSlot(undefined)}
        onSelect={(itemId) => {
          gameSession.equipItem(activeEquipmentSlot, itemId);
          setActiveEquipmentSlot(undefined);
        }}
        onUnequip={() => {
          gameSession.unequipItem(activeEquipmentSlot);
          setActiveEquipmentSlot(undefined);
        }}
      />
    );
  }

  if (selectedToolSlot) {
    const activeSlot = toolSlots.find((slot) => slot.id === selectedToolSlot);
    const equippedId = state.hero.equippedTools[selectedToolSlot];
    return (
      <ToolSelectorScreen
        slot={activeSlot}
        items={tools.filter(
          (tool) =>
            tool.action === activeSlot?.action && ((state.hero.inventory[tool.id] ?? 0) > 0 || equippedId === tool.id),
        )}
        selectedId={equippedId}
        onBack={() => setSelectedToolSlot(undefined)}
        onSelect={(toolId) => {
          gameSession.equipItem(selectedToolSlot, toolId);
          setSelectedToolSlot(undefined);
        }}
        onUnequip={() => {
          gameSession.unequipItem(selectedToolSlot);
          setSelectedToolSlot(undefined);
        }}
      />
    );
  }

  const equipmentButton = (slotId: EquipmentSlotId): ReactElement => {
    const slot = equipmentSlots.find((candidate) => candidate.id === slotId);
    if (!slot) return <span key={slotId} />;
    const equippedItemId = state.hero.equippedItems[slot.id];
    const equippedItem = equippedItemId ? inventoryItemFromDefinition(itemDefinition(equippedItemId)) : undefined;
    const Icon = equippedItem ? inventoryIcons[equippedItem.icon] : equipmentSlotIcons[slot.id];
    return (
      <TorchButton
        className={`equipment-slot equipment-slot-${slot.id}${equippedItem ? ' is-equipped' : ''}`}
        type="button"
        key={slot.id}
        data-testid={`equipment-slot-${slot.id}`}
        aria-label={`${slot.label}: ${equippedItem?.name ?? 'Empty'}`}
        title={equippedItem ? `${slot.label}: ${equippedItem.name}` : `Equip ${slot.label}`}
        onClick={() => setActiveEquipmentSlot(slot.id)}
      >
        <span className="equipment-slot-art">
          <Icon aria-hidden="true" />
        </span>
        <span className="equipment-slot-copy">
          <span className="loadout-slot-label">{slot.label}</span>
          {equippedItem ? (
            <strong className="loadout-slot-value">{equippedItem.name}</strong>
          ) : (
            <small className="loadout-slot-empty">Empty</small>
          )}
        </span>
      </TorchButton>
    );
  };

  return (
    <TorchTabsRoot
      className="loadout-screen gear-screen"
      value={activeTab}
      onValueChange={(value) => {
        if (typeof value === 'string') setActiveTab(value as GearTab);
      }}
      data-testid="equipment-screen"
      aria-label="Equipment and tools"
    >
      <TorchTabsList className="gear-tabs" aria-label="Loadout sections">
        <TorchTabsTab value="equipment" data-testid="equipment-tab">
          Equipment
        </TorchTabsTab>
        <TorchTabsTab value="tools" data-testid="tools-tab">
          Tools
        </TorchTabsTab>
      </TorchTabsList>

      <TorchTabsContent className="gear-tab-panel" value="equipment">
        <section className="gear-loadout-pane" aria-label="Equipment slots">
          <div className="paper-doll-grid" role="group" aria-label="Equipment slots">
            {(
              [
                'helm',
                'amulet',
                'main-hand',
                'body',
                'off-hand',
                'gloves',
                'belt',
                'ring-1',
                'trinket',
                'boots',
              ] as const
            ).map(equipmentButton)}
          </div>
        </section>
      </TorchTabsContent>

      <TorchTabsContent className="gear-tab-panel" value="tools">
        <section className="gear-loadout-pane gear-tools-pane" aria-label="Tool slots">
          <div className="tool-loadout-grid" role="group" aria-label="Tool slots">
            {toolSlots.map((slot) => {
              const equippedTool = tools.find((tool) => tool.id === state.hero.equippedTools[slot.id]);
              const Icon = toolSlotIcons[slot.id];
              return (
                <TorchButton
                  className={`tool-slot${equippedTool ? ' is-equipped' : ''}`}
                  type="button"
                  key={slot.id}
                  data-testid={`tool-slot-${slot.id}`}
                  aria-label={`${slot.label}: ${equippedTool?.name ?? 'Empty'}`}
                  title={equippedTool ? `${slot.label}: ${equippedTool.name}` : `Equip ${slot.label}`}
                  onClick={() => setSelectedToolSlot(slot.id)}
                >
                  <span className="tool-slot-art">
                    <Icon aria-hidden="true" />
                  </span>
                  <span className="tool-slot-copy">
                    <span className="loadout-slot-label">{slot.label}</span>
                    {equippedTool ? (
                      <strong className="loadout-slot-value">{equippedTool.name}</strong>
                    ) : (
                      <small className="loadout-slot-empty">Empty</small>
                    )}
                  </span>
                </TorchButton>
              );
            })}
          </div>
        </section>
      </TorchTabsContent>
    </TorchTabsRoot>
  );
}

function EquipmentSelectorScreen({
  slot,
  items,
  selectedId,
  onBack,
  onSelect,
  onUnequip,
}: {
  slot: (typeof equipmentSlots)[number] | undefined;
  items: InventoryItemDefinition[];
  selectedId: string | undefined;
  onBack: () => void;
  onSelect: (itemId: string) => void;
  onUnequip: () => void;
}): ReactElement {
  return (
    <div
      className="loadout-screen selector-screen"
      data-testid="equipment-picker"
      aria-label={`Choose ${slot?.label ?? 'Equipment'}`}
    >
      <header className="selector-header">
        <TorchButton
          type="button"
          className="selector-back"
          aria-label="Back to Equipment"
          data-testid="equipment-picker-back"
          onClick={onBack}
        >
          <ArrowLeft aria-hidden="true" />
        </TorchButton>
        <h2>{slot?.label}</h2>
      </header>
      {selectedId ? (
        <TorchButton
          variant="outline"
          size="lg"
          type="button"
          className="selector-unequip"
          data-testid="equipment-unequip"
          onClick={onUnequip}
        >
          Unequip current item
        </TorchButton>
      ) : null}
      {items.length ? (
        <div
          className="equipment-choice-grid selector-grid"
          role="list"
          aria-label={`${slot?.label ?? 'Equipment'} choices`}
        >
          {items.map((item) => {
            const Icon = inventoryIcons[item.icon];
            return (
              <TorchButton
                className={`equipment-choice${selectedId === item.id ? ' is-selected' : ''}`}
                type="button"
                key={item.id}
                aria-label={item.name}
                aria-pressed={selectedId === item.id}
                data-testid={`equipment-choice-${item.id}`}
                onClick={() => onSelect(item.id)}
              >
                <span className="equipment-choice-art">
                  <Icon aria-hidden="true" />
                </span>
                <span className="equipment-choice-copy">
                  <strong>{item.name}</strong>
                </span>
                {selectedId === item.id ? <Check aria-hidden="true" /> : null}
              </TorchButton>
            );
          })}
        </div>
      ) : (
        <div className="selector-empty" role="status">
          No equipment
        </div>
      )}
    </div>
  );
}

function ToolSelectorScreen({
  slot,
  items,
  selectedId,
  onBack,
  onSelect,
  onUnequip,
}: {
  slot: (typeof toolSlots)[number] | undefined;
  items: typeof tools;
  selectedId: string | undefined;
  onBack: () => void;
  onSelect: (toolId: string) => void;
  onUnequip: () => void;
}): ReactElement {
  return (
    <div
      className="loadout-screen selector-screen"
      data-testid="tool-picker"
      aria-label={`Choose ${slot?.label ?? 'Tool'}`}
    >
      <header className="selector-header">
        <TorchButton
          type="button"
          className="selector-back"
          aria-label="Back to Equipment"
          data-testid="tool-picker-back"
          onClick={onBack}
        >
          <ArrowLeft aria-hidden="true" />
        </TorchButton>
        <h2>{slot?.label}</h2>
      </header>
      {selectedId ? (
        <TorchButton
          variant="outline"
          size="lg"
          type="button"
          className="selector-unequip"
          data-testid="tool-unequip"
          onClick={onUnequip}
        >
          Unequip current tool
        </TorchButton>
      ) : null}
      <div className="tool-choice-grid selector-grid" role="list" aria-label={`${slot?.label ?? 'Tool'} choices`}>
        {items.map((tool) => {
          const Icon =
            tool.icon === 'axe' ? Axe : tool.icon === 'pickaxe' ? Pickaxe : tool.icon === 'hammer' ? Hammer : Shovel;
          return (
            <TorchButton
              className={`tool-choice${selectedId === tool.id ? ' is-selected' : ''}`}
              type="button"
              key={tool.id}
              aria-label={tool.name}
              aria-pressed={selectedId === tool.id}
              data-testid={`tool-choice-${tool.id}`}
              onClick={() => onSelect(tool.id)}
            >
              <span className="tool-choice-art">
                <Icon aria-hidden="true" />
              </span>
              <span className="tool-choice-copy">
                <strong>{tool.name}</strong>
              </span>
              {selectedId === tool.id ? <Check aria-hidden="true" /> : null}
            </TorchButton>
          );
        })}
      </div>
    </div>
  );
}

function AbilitiesScreen(): ReactElement {
  const [pickerSlot, setPickerSlot] = useState<AbilitySlotId>();
  const [detailAbility, setDetailAbility] = useState<(typeof abilities)[number]>();
  const [equippedAbilities, setEquippedAbilities] = useState<Partial<Record<AbilitySlotId, string>>>({
    ...gameSession.state.hero.equippedAbilities,
  });

  useEffect(
    () =>
      gameSession.subscribe((state) => {
        setEquippedAbilities({ ...state.hero.equippedAbilities });
      }),
    [],
  );

  const selectAbility = (slotId: AbilitySlotId, abilityId: string): void => {
    gameSession.equipAbility(slotId, abilityId);
    setPickerSlot(undefined);
    setDetailAbility(undefined);
  };

  if (pickerSlot) {
    const picker = abilitySlots.find((slot) => slot.id === pickerSlot);
    return (
      <>
        <AbilitySelectorScreen
          slot={picker}
          abilities={abilities.filter((ability) => ability.slot === pickerSlot)}
          selectedId={equippedAbilities[pickerSlot]}
          onBack={() => setPickerSlot(undefined)}
          onView={setDetailAbility}
        />
        {detailAbility ? (
          <AbilityDetailDialog
            ability={detailAbility}
            onClose={() => setDetailAbility(undefined)}
            onSelect={() => selectAbility(pickerSlot, detailAbility.id)}
          />
        ) : null}
      </>
    );
  }

  return (
    <div className="loadout-screen abilities-loadout-screen">
      <section
        className="abilities-screen abilities-summary-screen"
        data-testid="abilities-screen"
        aria-label="Ability loadout"
      >
        <div className="ability-loadout-grid" role="list" aria-label="Equipped abilities">
          {abilitySlots.map((slot) => {
            const equipped = abilities.find((ability) => ability.id === equippedAbilities[slot.id]);
            return (
              <div
                className="ability-loadout-card"
                role="listitem"
                key={slot.id}
                data-testid={`ability-slot-${slot.id}`}
              >
                <TorchArtworkCard
                  artSrc={equipped?.assetPath}
                  artAlt={equipped?.assetAlt}
                  eyebrow={slot.label}
                  title={equipped?.name ?? 'Empty slot'}
                  ariaLabel={`${slot.label}: ${equipped?.name ?? 'Empty slot'}`}
                  className="ability-art-button"
                  testId={`ability-card-${slot.id}`}
                  onClick={() => setPickerSlot(slot.id)}
                />
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function AbilityChoiceButton({
  ability,
  selected,
  onView,
}: {
  ability: (typeof abilities)[number];
  selected: boolean;
  onView: () => void;
}): ReactElement {
  return (
    <TorchArtworkCard
      artSrc={ability.assetPath}
      artAlt={ability.assetAlt}
      eyebrow={ability.slot}
      title={ability.name}
      ariaLabel={`${ability.name}: ${ability.description}`}
      className={`ability-choice${selected ? ' is-selected' : ''}`}
      testId={`ability-choice-${ability.id.replace('ability.', '')}`}
      selected={selected}
      onClick={onView}
    />
  );
}

function AbilityDetailDialog({
  ability,
  onClose,
  onSelect,
}: {
  ability: (typeof abilities)[number];
  onClose: () => void;
  onSelect: () => void;
}): ReactElement {
  const closeRef = useRef<HTMLButtonElement>(null);
  const cooldown = abilityActionDefinition(ability.id)?.cooldown ?? 0;

  return (
    <TorchDialog.Root
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <TorchDialog.Portal>
        <div className="ability-detail-layer" data-testid="ability-detail">
          <TorchDialog.Backdrop className="ability-detail-backdrop" />
          <TorchDialog.Viewport className="ability-detail-viewport">
            <TorchDialog.Popup
              className="ability-detail-dialog"
              aria-label={`${ability.name} details`}
              initialFocus={closeRef}
            >
              <TorchDialog.Close
                ref={closeRef}
                render={
                  <TorchButton
                    variant="ghost"
                    size="icon-lg"
                    className="ability-detail-close"
                    aria-label="Close ability details"
                    data-testid="ability-detail-close"
                  />
                }
              >
                <CloseIcon aria-hidden="true" />
              </TorchDialog.Close>
              <div className="ability-detail-art">
                <img src={ability.assetPath} alt={ability.assetAlt} />
              </div>
              <div className="ability-detail-copy">
                <p className="stats-kicker">{ability.slot}</p>
                <TorchDialog.Title className="ability-detail-title">{ability.name}</TorchDialog.Title>
                <p>{ability.description}</p>
                <dl className="ability-detail-metadata">
                  <div>
                    <dt>Cooldown</dt>
                    <dd>{cooldown > 0 ? `${cooldown} actions` : 'No cooldown'}</dd>
                  </div>
                </dl>
                <TorchButton
                  type="button"
                  className="ability-detail-select"
                  data-testid="ability-detail-select"
                  onClick={onSelect}
                >
                  Select Ability
                </TorchButton>
              </div>
            </TorchDialog.Popup>
          </TorchDialog.Viewport>
        </div>
      </TorchDialog.Portal>
    </TorchDialog.Root>
  );
}

function AbilitySelectorScreen({
  slot,
  abilities: choices,
  selectedId,
  onBack,
  onView,
}: {
  slot: (typeof abilitySlots)[number] | undefined;
  abilities: typeof abilities;
  selectedId: string | undefined;
  onBack: () => void;
  onView: (ability: (typeof abilities)[number]) => void;
}): ReactElement {
  return (
    <div
      className="loadout-screen selector-screen ability-selector-screen"
      data-testid="ability-picker"
      aria-label={`Choose ${slot?.label ?? 'Ability'}`}
    >
      <header className="selector-header">
        <div>
          <p className="stats-kicker">Abilities → {slot?.label ?? 'Slot'}</p>
          <h2>Choose an ability</h2>
        </div>
        <TorchButton
          type="button"
          className="selector-back"
          aria-label="Back to Abilities"
          data-testid="ability-picker-back"
          onClick={onBack}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              onBack();
            }
          }}
        >
          <ArrowLeft aria-hidden="true" />
        </TorchButton>
      </header>
      <div className="ability-choice-grid selector-grid" role="list" aria-label={`${slot?.label ?? 'Ability'} choices`}>
        {choices.length > 0 ? (
          choices.map((ability) => (
            <AbilityChoiceButton
              ability={ability}
              selected={selectedId === ability.id}
              onView={() => onView(ability)}
              key={ability.id}
            />
          ))
        ) : (
          <div className="selector-empty" role="status">
            No abilities available for this slot.
          </div>
        )}
      </div>
    </div>
  );
}

type SettingsTab = 'display' | 'audio' | 'gameplay' | 'controls' | 'accessibility';

type OptionsTabDefinition = {
  id: SettingsTab;
  label: string;
  description: string;
  icon: LucideIcon;
  testId: string;
};

const optionsTabs: readonly OptionsTabDefinition[] = [
  {
    id: 'display',
    label: 'Display',
    description: 'Window and board presentation',
    icon: Monitor,
    testId: 'settings-tab-display',
  },
  { id: 'audio', label: 'Audio', description: 'Soundscape levels', icon: Volume2, testId: 'settings-tab-audio' },
  {
    id: 'gameplay',
    label: 'Gameplay',
    description: 'Comfort and interaction',
    icon: Gamepad2,
    testId: 'settings-tab-gameplay',
  },
  {
    id: 'controls',
    label: 'Controls',
    description: 'Keyboard bindings',
    icon: Keyboard,
    testId: 'settings-tab-bindings',
  },
  {
    id: 'accessibility',
    label: 'Accessibility',
    description: 'Motion and readability',
    icon: Accessibility,
    testId: 'settings-tab-accessibility',
  },
];

function SettingsScreen(): ReactElement {
  const [activeTab, setActiveTab] = useState<SettingsTab>('display');
  const [settings, setSettings] = useState<PresentationSettings>(readPresentationSettings);
  const [fullscreen, setFullscreen] = useState(
    () => typeof document !== 'undefined' && Boolean(document.fullscreenElement),
  );
  const [status, setStatus] = useState('Changes save locally; connected adapters update immediately.');
  const [confirmReset, setConfirmReset] = useState(false);
  const optionsBodyRef = useRef<HTMLDivElement>(null);
  const optionsBodySize = useElementSize(optionsBodyRef);
  const optionsOrientation = optionsBodySize.width > 0 && optionsBodySize.width <= 720 ? 'horizontal' : 'vertical';

  useEffect(() => {
    const handleSettingsChange = (event: Event): void => {
      const detail = (event as CustomEvent<PresentationSettings>).detail;
      setSettings(detail ?? readPresentationSettings());
    };
    const handleFullscreenChange = (): void => setFullscreen(Boolean(document.fullscreenElement));
    window.addEventListener(PRESENTATION_SETTINGS_EVENT, handleSettingsChange);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      window.removeEventListener(PRESENTATION_SETTINGS_EVENT, handleSettingsChange);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  const updateSetting = <K extends PresentationSettingKey>(key: K, value: PresentationSettings[K]): void => {
    const next = setPresentationSetting(key, value);
    setSettings(next);
    setStatus('Saved locally; connected adapters updated.');
    setConfirmReset(false);
  };

  const toggleFullscreen = async (): Promise<void> => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      }
      setStatus('Display mode updated.');
    } catch {
      setFullscreen(Boolean(document.fullscreenElement));
      setStatus('Fullscreen is unavailable in this browser window.');
    }
  };

  const resetAll = (): void => {
    const next = resetPresentationSettings();
    setSettings(next);
    const nextBindings = defaultKeyBindings();
    setKeyBindings(nextBindings);
    setConfirmReset(false);
    setStatus('All options restored to their defaults.');
  };

  return (
    <TorchTabsRoot
      className="settings-screen options-screen"
      value={activeTab}
      orientation={optionsOrientation}
      onValueChange={(value) => {
        if (typeof value === 'string') setActiveTab(value as SettingsTab);
      }}
      data-testid="settings-screen"
    >
      <div className="options-heading">
        <div>
          <p className="stats-kicker">Game preferences</p>
          <p className="options-subtitle">Tune Torch for your expedition. Preferences are saved as you change them.</p>
        </div>
      </div>

      <div className="options-body" ref={optionsBodyRef}>
        <TorchTabsList className="settings-tabs options-nav" aria-label="Options sections" variant="line">
          {optionsTabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <TorchTabsTab value={tab.id} data-testid={tab.testId} key={tab.id}>
                <Icon aria-hidden="true" />
                <span className="options-nav-copy">
                  <strong>{tab.label}</strong>
                  <small>{tab.description}</small>
                </span>
              </TorchTabsTab>
            );
          })}
        </TorchTabsList>

        <div className="options-content">
          <TorchTabsContent className="settings-tab-panel" value="display">
            <OptionsGroup
              eyebrow="Presentation"
              title="Display"
              description="Keep the board readable at the size and brightness that suits you."
            >
              <SettingRow label="Fullscreen" description="Use the whole display for Torch.">
                <SettingSwitch
                  label="Fullscreen"
                  value={fullscreen}
                  onChange={toggleFullscreen}
                  testId="settings-fullscreen"
                />
              </SettingRow>
              <SettingRow label="UI Scale" description="Adjust interface density independently of the board.">
                <TorchSelectField
                  value={settings.uiScale}
                  options={[
                    { value: 'auto', label: 'Auto' },
                    { value: 'compact', label: 'Compact' },
                    { value: 'large', label: 'Large' },
                  ]}
                  onValueChange={(value) => updateSetting('uiScale', value as PresentationSettings['uiScale'])}
                  ariaLabel="UI Scale"
                  testId="settings-ui-scale"
                />
              </SettingRow>
              <SettingRow label="Show Grid" description="Display tile boundaries across the lit Torch area.">
                <SettingSwitch
                  label="Show Grid"
                  value={settings.showGrid}
                  onChange={() => updateSetting('showGrid', !settings.showGrid)}
                  testId="settings-show-grid"
                />
              </SettingRow>
            </OptionsGroup>
          </TorchTabsContent>

          <TorchTabsContent className="settings-tab-panel" value="audio">
            <OptionsGroup
              eyebrow="Soundscape"
              title="Audio"
              description="Balance the sounds that accompany each action."
            >
              <SettingRange
                label="Master Volume"
                description="Overall Torch volume."
                value={settings.masterVolume}
                onChange={(value) => updateSetting('masterVolume', value)}
                testId="settings-master-volume"
              />
              <SettingRange
                label="Music Volume"
                description="Ambient music and exploration themes."
                value={settings.musicVolume}
                onChange={(value) => updateSetting('musicVolume', value)}
              />
              <SettingRange
                label="Effects Volume"
                description="Combat, gathering, and interface sounds."
                value={settings.sfxVolume}
                onChange={(value) => updateSetting('sfxVolume', value)}
              />
            </OptionsGroup>
          </TorchTabsContent>

          <TorchTabsContent className="settings-tab-panel" value="gameplay">
            <OptionsGroup
              eyebrow="Comfort"
              title="Gameplay"
              description="Shape how much feedback Torch gives you during play."
            >
              <SettingRow label="Screen Shake" description="Emphasize impactful actions and attacks.">
                <SettingSwitch
                  label="Screen Shake"
                  value={settings.screenShake}
                  onChange={() => updateSetting('screenShake', !settings.screenShake)}
                />
              </SettingRow>
              <SettingRow label="Interaction Hints" description="Show contextual action affordances near the Hero.">
                <SettingSwitch
                  label="Interaction Hints"
                  value={settings.interactionHints}
                  onChange={() => updateSetting('interactionHints', !settings.interactionHints)}
                />
              </SettingRow>
              <SettingRow
                label="Confirm Context Actions"
                description="Ask before gathering, mining, or attacking from a blocked move."
              >
                <SettingSwitch
                  label="Confirm Context Actions"
                  value={settings.confirmActions}
                  onChange={() => updateSetting('confirmActions', !settings.confirmActions)}
                />
              </SettingRow>
            </OptionsGroup>
          </TorchTabsContent>

          <TorchTabsContent className="settings-tab-panel" value="controls">
            <KeyBindingsPanel onStatus={setStatus} />
          </TorchTabsContent>

          <TorchTabsContent className="settings-tab-panel" value="accessibility">
            <OptionsGroup
              eyebrow="Readability"
              title="Accessibility"
              description="Reduce visual intensity without changing the simulation rules."
            >
              <SettingRow label="Reduce Motion" description="Use shorter transitions and less camera movement.">
                <SettingSwitch
                  label="Reduce Motion"
                  value={settings.reduceMotion}
                  onChange={() => updateSetting('reduceMotion', !settings.reduceMotion)}
                />
              </SettingRow>
              <div className="options-info" role="note">
                <Accessibility aria-hidden="true" />
                <p>
                  More accessibility options will be added as the corresponding presentation adapters become available.
                </p>
              </div>
            </OptionsGroup>
          </TorchTabsContent>
        </div>
      </div>

      <div className="options-footer">
        <div className="options-status" role="status" aria-live="polite">
          <Check aria-hidden="true" />
          <span>{status}</span>
        </div>
        <div className="options-footer-actions">
          {confirmReset ? (
            <div className="options-reset-confirm" role="group" aria-label="Confirm reset options">
              <span>Reset all options?</span>
              <TorchButton
                variant="destructive"
                size="sm"
                type="button"
                data-testid="options-reset-confirm"
                onClick={resetAll}
              >
                Reset
              </TorchButton>
              <TorchButton
                variant="ghost"
                size="sm"
                type="button"
                data-testid="options-reset-cancel"
                onClick={() => setConfirmReset(false)}
              >
                Cancel
              </TorchButton>
            </div>
          ) : (
            <TorchButton
              variant="ghost"
              size="sm"
              type="button"
              data-testid="options-reset"
              onClick={() => setConfirmReset(true)}
            >
              <RotateCcw aria-hidden="true" />
              Reset defaults
            </TorchButton>
          )}
          <TorchButton
            variant="default"
            size="sm"
            type="button"
            className="options-done"
            onClick={() => document.querySelector<HTMLElement>('[data-testid="close-menu"]')?.click()}
          >
            Done
          </TorchButton>
        </div>
      </div>
    </TorchTabsRoot>
  );
}

function OptionsGroup({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactElement | ReactElement[];
}): ReactElement {
  return (
    <section
      className="settings-group options-group"
      aria-labelledby={`options-${title.toLowerCase().replaceAll(' ', '-')}-title`}
    >
      <div className="settings-group-heading options-group-heading">
        <p className="stats-kicker">{eyebrow}</p>
        <h2 id={`options-${title.toLowerCase().replaceAll(' ', '-')}-title`}>{title}</h2>
        <p>{description}</p>
      </div>
      <div className="options-group-rows">{children}</div>
    </section>
  );
}

function SettingRow({
  label,
  description,
  children,
}: {
  label: string;
  description: string;
  children: ReactElement;
}): ReactElement {
  return (
    <div className="settings-row options-row">
      <div className="options-row-copy">
        <strong>{label}</strong>
        <small>{description}</small>
      </div>
      <div className="options-row-control">{children}</div>
    </div>
  );
}

function SettingSwitch({
  label,
  value,
  onChange,
  testId,
}: {
  label: string;
  value: boolean;
  onChange: () => void;
  testId?: string;
}): ReactElement {
  return (
    <TorchButton
      variant="outline"
      size="sm"
      className="settings-switch"
      type="button"
      role="switch"
      aria-label={label}
      aria-checked={value}
      data-testid={testId}
      onClick={onChange}
    >
      <span className="settings-switch-track" aria-hidden="true">
        <span />
      </span>
      <span>{value ? 'On' : 'Off'}</span>
    </TorchButton>
  );
}

const keyBindingGroups: readonly { label: string; actions: readonly KeyBindingAction[] }[] = [
  { label: 'Movement', actions: ['move-north', 'move-south', 'move-west', 'move-east'] },
  { label: 'Actions', actions: ['wait', 'gather'] },
  { label: 'Navigation', actions: ['map'] },
];

function KeyBindingsPanel({ onStatus }: { onStatus: (message: string) => void }): ReactElement {
  const [bindings, setBindings] = useState<KeyBindings>(readKeyBindings);
  const [capturing, setCapturing] = useState<{ action: KeyBindingAction; slot: number }>();

  useEffect(() => {
    const handleBindingsChange = (): void => setBindings(readKeyBindings());
    window.addEventListener(KEY_BINDINGS_EVENT, handleBindingsChange);
    return () => window.removeEventListener(KEY_BINDINGS_EVENT, handleBindingsChange);
  }, []);

  useEffect(() => {
    if (!capturing) return;
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setCapturing(undefined);
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const next = updateKeyBinding(bindings, capturing.action, capturing.slot, event.key);
      setBindings(next);
      setKeyBindings(next);
      setCapturing(undefined);
      onStatus('Controls saved locally.');
      event.preventDefault();
      event.stopPropagation();
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [bindings, capturing, onStatus]);

  return (
    <section className="settings-group key-bindings-group options-group" aria-labelledby="settings-bindings-title">
      <div className="settings-group-heading key-bindings-heading">
        <div>
          <p className="stats-kicker">Keyboard</p>
          <h2 id="settings-bindings-title">Controls</h2>
          <p>Choose the keys that feel natural for moving through the dark.</p>
        </div>
        <TorchButton
          variant="ghost"
          size="sm"
          type="button"
          data-testid="reset-key-bindings"
          onClick={() => {
            const next = defaultKeyBindings();
            setBindings(next);
            setKeyBindings(next);
            setCapturing(undefined);
            onStatus('Keyboard bindings restored to defaults.');
          }}
        >
          Reset defaults
        </TorchButton>
      </div>
      <p className="key-bindings-help">
        Select a key, then press a replacement. Escape cancels rebinding. Conflicts swap safely so every action keeps a
        key.
      </p>
      {capturing ? (
        <p className="key-bindings-status" role="status" aria-live="polite">
          Press a replacement key for{' '}
          {keyBindingDefinitions.find((definition) => definition.id === capturing.action)?.label ?? 'this binding'}.
          Escape cancels.
        </p>
      ) : null}
      <div className="key-bindings-list">
        {keyBindingGroups.map((group) => (
          <section
            className="key-binding-group"
            aria-labelledby={`key-binding-group-${group.label.toLowerCase()}`}
            key={group.label}
          >
            <h3 id={`key-binding-group-${group.label.toLowerCase()}`}>{group.label}</h3>
            {group.actions.map((action) => {
              const definition = keyBindingDefinitions.find((candidate) => candidate.id === action);
              if (!definition) return null;
              return (
                <div className="key-binding-row" key={definition.id}>
                  <div>
                    <strong>{definition.label}</strong>
                    <small>{definition.description}</small>
                  </div>
                  <div className="key-binding-keys">
                    {(bindings[definition.id] ?? []).map((key, slot) => {
                      const isCapturing = capturing?.action === definition.id && capturing.slot === slot;
                      return (
                        <TorchButton
                          variant={isCapturing ? 'default' : 'outline'}
                          size="sm"
                          type="button"
                          className="key-binding-key"
                          key={`${definition.id}-${slot}`}
                          data-testid={`key-binding-${definition.id}-${slot}`}
                          aria-label={`${definition.label} key ${formatBindingKey(key)}${isCapturing ? ', press a replacement' : ''}`}
                          aria-pressed={isCapturing}
                          data-capturing={isCapturing ? 'true' : undefined}
                          onClick={() => setCapturing({ action: definition.id, slot })}
                        >
                          {isCapturing ? 'Press key…' : formatBindingKey(key)}
                        </TorchButton>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </section>
        ))}
      </div>
    </section>
  );
}

function SettingRange({
  label,
  description,
  value,
  onChange,
  testId,
}: {
  label: string;
  description: string;
  value: number;
  onChange: (value: number) => void;
  testId?: string;
}): ReactElement {
  const controlId = testId ?? `settings-${label.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-')}`;
  return (
    <label className="settings-range-row">
      <span className="options-row-copy">
        <strong>{label}</strong>
        <small>{description}</small>
      </span>
      <span className="options-range-control">
        <output htmlFor={controlId}>{value}%</output>
        <input
          aria-label={label}
          data-testid={testId}
          className="settings-range"
          id={controlId}
          type="range"
          min="0"
          max="100"
          value={value}
          aria-valuetext={`${value}%`}
          aria-describedby={`${controlId}-description`}
          onChange={(event) => onChange(Number(event.target.value))}
        />
      </span>
      <span id={`${controlId}-description`} className="sr-only">
        Use the arrow keys to adjust in 1 percent steps.
      </span>
    </label>
  );
}
