import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactElement } from 'react';
import {
  Axe,
  Backpack,
  ArrowLeft,
  Check,
  CircleEllipsis,
  Coins,
  ChevronDown,
  FlaskConical,
  Gem,
  ListFilter,
  Map as MapIcon,
  Menu as MenuIcon,
  PackageOpen,
  Pickaxe,
  Shield,
  Sparkles,
  Sword,
  TreePine,
  Wrench,
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
import { inventoryCategories, inventoryItems } from '../content/inventory';
import type { InventoryCategory, InventoryIconId } from '../content/inventory';
import { abilityActionDefinition, positionKey, tileAt } from '../sim';
import type { GameState, Position } from '../sim';
import {
  SHOW_GRID_EVENT,
  readShowGridPreference,
  setShowGridPreference,
} from '../game/presentation-settings';
import { ContextActionHand } from './context-action-hand';

type MenuItem = {
  label: string;
  detail: string;
  available?: boolean;
};

type InventorySort = 'category' | 'name' | 'quantity';
type Screen = 'menu' | 'hero' | 'inventory' | 'abilities' | 'map' | 'settings';
type InventorySection = 'inventory' | 'gear' | 'tools';

const menuItems: MenuItem[] = [
  { label: 'Crafting', detail: 'Coming soon' },
  { label: 'Journal', detail: 'Coming soon' },
  { label: 'Talents', detail: 'Coming soon' },
  { label: 'Settings', detail: 'Controls & display', available: true },
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
  abilities: 'Abilities',
  map: 'Map',
  settings: 'Settings',
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
  'ring-2': Gem,
  amulet: Gem,
  trinket: Sparkles,
};

const toolSlotIcons: Record<ToolSlotId, LucideIcon> = {
  axe: Axe,
  pickaxe: Pickaxe,
};

export function MenuOverlay(): ReactElement {
  const [open, setOpen] = useState(false);
  const [screen, setScreen] = useState<Screen>('menu');
  const [inventorySection, setInventorySection] = useState<InventorySection>('inventory');
  const [gameState, setGameState] = useState(() => gameSession.state);
  const [heroStatus, setHeroStatus] = useState(() => ({
    health: gameSession.state.hero.health,
    maxHealth: gameSession.state.hero.maxHealth,
  }));
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const unsubscribe = gameSession.subscribe((state) => {
      setGameState(state);
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
    gameSession.setInputMode(open ? 'ui' : 'world');
    document.body.dataset.menuOpen = String(open);

    return () => {
      gameSession.setInputMode('world');
      delete document.body.dataset.menuOpen;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    closeButtonRef.current?.focus();
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  const openMenu = (nextScreen: Screen = 'menu', nextInventorySection: InventorySection = 'inventory'): void => {
    setScreen(nextScreen);
    setInventorySection(nextInventorySection);
    setOpen(true);
  };

  const hpRatio = heroStatus.maxHealth > 0
    ? Math.max(0, Math.min(1, heroStatus.health / heroStatus.maxHealth))
    : 0;

  return (
    <>
      <ContextActionHand state={gameState} hidden={open} />
      {!open ? (
        <div className="hud-rail" aria-label="Hero controls">
          <button
            className="hud-icon-button hud-hero-button"
            type="button"
            aria-label="Open hero"
            aria-controls="torch-menu"
            data-testid="hud-hero-button"
            onClick={() => openMenu('hero')}
          >
            <img src={heroAssets.knight.hud} alt="" />
          </button>

          <div className="hud-hp" data-testid="hero-hp" aria-label={`Hero HP ${heroStatus.health} of ${heroStatus.maxHealth}`}>
            <div className="hud-hp-meta">
              <span>HP</span>
              <span>{heroStatus.health}/{heroStatus.maxHealth}</span>
            </div>
            <div className="hud-hp-track" aria-hidden="true">
              <span className="hud-hp-fill" style={{ width: `${hpRatio * 100}%` }} />
            </div>
          </div>

          <button
            className="hud-icon-button"
            type="button"
            aria-label="Open inventory"
            aria-controls="torch-menu"
            data-testid="hud-inventory-button"
            onClick={() => openMenu('inventory')}
          >
            <Backpack aria-hidden="true" />
          </button>

          <button
            className="hud-icon-button"
            type="button"
            aria-label="Open abilities"
            aria-controls="torch-menu"
            data-testid="hud-abilities-button"
            onClick={() => openMenu('abilities')}
          >
            <Sparkles aria-hidden="true" />
          </button>

          <button
            className="hud-icon-button"
            type="button"
            aria-label="Open map"
            aria-controls="torch-menu"
            data-testid="hud-map-button"
            onClick={() => openMenu('map')}
          >
            <MapIcon aria-hidden="true" />
          </button>

          <button
            className="hud-icon-button"
            type="button"
            aria-label="Open menu"
            aria-controls="torch-menu"
            aria-expanded={open}
            data-testid="menu-button"
            onClick={() => openMenu()}
          >
            <MenuIcon aria-hidden="true" />
          </button>
        </div>
      ) : null}

      {open ? (
        <div className="menu-layer">
          <button
            className="menu-backdrop"
            type="button"
            aria-label="Close menu"
            data-testid="menu-backdrop"
            onClick={() => setOpen(false)}
          />

          <section
            id="torch-menu"
            className={`menu-panel${screen !== 'menu' ? ' menu-panel-wide' : ''}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="menu-title"
          >
            <div className={`menu-header${screen === 'inventory' ? ' inventory-menu-header' : ''}`}>
              <div className="menu-header-main">
                <p className="menu-kicker">Torch</p>
                <h1 id="menu-title">
                  {SCREEN_TITLES[screen]}
                </h1>
              </div>
              <button
                ref={closeButtonRef}
                className="menu-close"
                type="button"
                aria-label="Close menu"
                data-testid="close-menu"
                onClick={() => setOpen(false)}
              >
                <CloseIcon aria-hidden="true" />
              </button>
              {screen === 'inventory' ? (
                <InventorySectionTabs section={inventorySection} onSectionChange={setInventorySection} />
              ) : null}
            </div>

            {screen === 'menu' ? (
              <nav className="menu-list" aria-label="Game menu">
                {menuItems.map((item) => (
                  <button
                    className="menu-item"
                    type="button"
                    disabled={!item.available}
                    data-testid={item.available ? `menu-${item.label.toLowerCase()}` : undefined}
                    key={item.label}
                    onClick={item.available ? () => setScreen(item.label === 'Settings' ? 'settings' : 'menu') : undefined}
                  >
                    <span className="menu-item-label">{item.label}</span>
                    <span className="menu-item-detail">{item.detail}</span>
                  </button>
                ))}
              </nav>
            ) : screen === 'hero' ? (
              <HeroScreen state={gameState} />
            ) : screen === 'inventory' ? (
              <InventoryScreen section={inventorySection} />
            ) : screen === 'abilities' ? (
              <AbilitiesScreen />
            ) : screen === 'map' ? (
              <MapScreen />
            ) : (
              <SettingsScreen />
            )}
          </section>
        </div>
      ) : null}
    </>
  );
}

function InventoryScreen({
  section,
}: {
  section: InventorySection;
}): ReactElement {
  return (
    <div className="inventory-screen" data-testid="inventory-screen">
      {section === 'inventory' ? <InventoryItemsPanel /> : null}
      {section === 'gear' ? <GearPanel /> : null}
      {section === 'tools' ? <ToolsPanel /> : null}
    </div>
  );
}

function InventorySectionTabs({
  section,
  onSectionChange,
}: {
  section: InventorySection;
  onSectionChange: (section: InventorySection) => void;
}): ReactElement {
  return (
    <nav className="inventory-section-tabs" role="tablist" aria-label="Inventory sections" data-testid="inventory-section-tabs">
      {([
        { id: 'inventory' as const, label: 'Inventory', icon: Backpack },
        { id: 'gear' as const, label: 'Gear', icon: Shield },
        { id: 'tools' as const, label: 'Tools', icon: Wrench },
      ]).map(({ id, label, icon: Icon }) => (
        <button
          className={`inventory-section-tab${section === id ? ' is-active' : ''}`}
          type="button"
          role="tab"
          aria-selected={section === id}
          data-testid={`inventory-section-tab-${id}`}
          key={id}
          onClick={() => onSectionChange(id)}
        >
          <Icon aria-hidden="true" />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}

function InventoryItemsPanel(): ReactElement {
  const [category, setCategory] = useState<InventoryCategory | undefined>();
  const [sort, setSort] = useState<InventorySort>('category');
  const [sortOpen, setSortOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const sortRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sortOpen) return;

    const handlePointerDown = (event: PointerEvent): void => {
      if (!sortRef.current?.contains(event.target as Node)) setSortOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setSortOpen(false);
    };

    document.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [sortOpen]);

  const visibleItems = inventoryItems
    .filter((item) => !category || item.category === category)
    .sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name);
      if (sort === 'quantity') return b.quantity - a.quantity || a.name.localeCompare(b.name);
      return a.id.localeCompare(b.id);
  });
  const selectedItem = visibleItems.find((item) => item.id === selectedId);
  const SelectedIcon = selectedItem ? inventoryIcons[selectedItem.icon] : undefined;

  const selectCategory = (nextCategory: InventoryCategory): void => {
    setCategory((currentCategory) => currentCategory === nextCategory ? undefined : nextCategory);
    setSelectedId(undefined);
  };

  return (
    <div className="inventory-screen">
      <div className="inventory-toolbar">
        <div className="inventory-tabs" role="tablist" aria-label="Inventory categories">
          {inventoryCategories.map(({ id, label, icon }) => {
            const Icon = inventoryIcons[icon];
            return (
              <button
                className={`inventory-tab${category === id ? ' is-active' : ''}`}
                type="button"
                role="tab"
                aria-selected={category === id}
                aria-label={label}
                title={label}
                data-testid={`inventory-tab-${id}`}
                key={id}
                onClick={() => selectCategory(id)}
              >
                <Icon aria-hidden="true" />
              </button>
            );
          })}
        </div>

        <div className={`inventory-sort${sortOpen ? ' is-open' : ''}`} ref={sortRef}>
          <button
            className="inventory-sort-trigger"
            type="button"
            aria-label="Sort inventory"
            aria-haspopup="menu"
            aria-expanded={sortOpen}
            data-testid="inventory-sort"
            onClick={() => setSortOpen((open) => !open)}
          >
            <ListFilter aria-hidden="true" />
            <span>{sortOptions.find((option) => option.value === sort)?.label}</span>
            <ChevronDown aria-hidden="true" />
          </button>
          {sortOpen ? (
            <div className="inventory-sort-menu" role="menu" aria-label="Sort inventory by">
              {sortOptions.map((option) => (
                <button
                  className="inventory-sort-option"
                  type="button"
                  role="menuitemradio"
                  aria-checked={sort === option.value}
                  key={option.value}
                  onClick={() => {
                    setSort(option.value);
                    setSortOpen(false);
                  }}
                >
                  <span>{option.label}</span>
                  {sort === option.value ? <Check aria-hidden="true" /> : null}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <div className={`inventory-content${selectedItem && SelectedIcon ? ' has-detail' : ''}`}>
        <div className="inventory-grid" data-testid="inventory-grid" role="grid" aria-label={`${category ?? 'all'} items`}>
          {visibleItems.map((item) => {
            const Icon = inventoryIcons[item.icon];
            return (
              <div className="inventory-cell" role="gridcell" key={item.id}>
                <button
                  className={`inventory-item${selectedId === item.id ? ' is-selected' : ''}`}
                  type="button"
                  aria-label={`${item.name}, quantity ${item.quantity}`}
                  data-testid={`inventory-item-${item.id}`}
                  onClick={() => setSelectedId(item.id)}
                >
                  <span className="inventory-item-icon"><Icon aria-hidden="true" /></span>
                </button>
                <span className="inventory-item-quantity">×{item.quantity}</span>
              </div>
            );
          })}
        </div>

        {selectedItem && SelectedIcon ? (
          <section className="inventory-detail" data-testid="inventory-detail" aria-label="Item detail">
            <p className="inventory-detail-kicker">Item Detail</p>
            <div className="inventory-detail-heading">
              <SelectedIcon aria-hidden="true" />
              <h2>{selectedItem.name}</h2>
            </div>
            <p>{selectedItem.description}</p>
            <span className="inventory-detail-quantity">Quantity {selectedItem.quantity}</span>
          </section>
        ) : null}
      </div>
    </div>
  );
}

function HeroScreen({ state }: { state: GameState }): ReactElement {
  const heroDefinition = Object.values(heroDefinitions).find((definition) => definition.id === state.hero.heroId)
    ?? heroDefinitions.knight;
  const heroAsset = Object.values(heroAssets).find((asset) => asset.id === state.hero.heroId)
    ?? heroAssets.knight;

  return (
    <div className="hero-screen">
      <div className="hero-details">
        <img
          className="hero-art-full"
          src={heroAsset.full}
          alt={heroAsset.fullAlt}
          data-testid="hero-art-full"
        />

        <section className="stats-panel hero-stats-panel" aria-labelledby="hero-stats-title">
          <div className="stats-panel-header">
            <p className="stats-kicker">{heroDefinition.name}</p>
            <h2 id="hero-stats-title">Stats</h2>
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
  const xs = [...positions.map(({ x }) => x), state.hero.position.x];
  const ys = [...positions.map(({ y }) => y), state.hero.position.y];
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
}

function MapScreen(): ReactElement {
  const [mapState, setMapState] = useState(() => gameSession.state);
  const [showGrid, setShowGrid] = useState(readShowGridPreference);
  const [mapViewportSize, setMapViewportSize] = useState({ width: 0, height: 0 });
  const mapViewportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsubscribe = gameSession.subscribe((state) => setMapState(state));
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const handleShowGridChange = (event: Event): void => {
      const enabled = (event as CustomEvent<{ enabled?: boolean }>).detail?.enabled;
      setShowGrid(enabled ?? readShowGridPreference());
    };
    window.addEventListener(SHOW_GRID_EVENT, handleShowGridChange);
    return () => window.removeEventListener(SHOW_GRID_EVENT, handleShowGridChange);
  }, []);

  useEffect(() => {
    const viewport = mapViewportRef.current;
    if (!viewport) return;

    const measure = (): void => {
      const styles = getComputedStyle(viewport);
      const horizontalPadding = Number.parseFloat(styles.paddingLeft) + Number.parseFloat(styles.paddingRight);
      const verticalPadding = Number.parseFloat(styles.paddingTop) + Number.parseFloat(styles.paddingBottom);
      setMapViewportSize({
        width: Math.max(0, viewport.clientWidth - horizontalPadding),
        height: Math.max(0, viewport.clientHeight - verticalPadding),
      });
    };
    measure();
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(measure);
    observer?.observe(viewport);
    return () => observer?.disconnect();
  }, []);

  const bounds = mapBounds(mapState);
  const exploredColumns = bounds.maxX - bounds.minX + 1;
  const exploredRows = bounds.maxY - bounds.minY + 1;
  const mapSizing = mapViewportSize.width > 0 && mapViewportSize.height > 0
    ? (() => {
      const baseCellSize = Math.max(1, Math.floor(Math.min(mapViewportSize.width / exploredColumns, mapViewportSize.height / exploredRows)));
      const expandedColumns = Math.max(exploredColumns, Math.ceil(mapViewportSize.width / baseCellSize));
      const expandedRows = Math.max(exploredRows, Math.ceil(mapViewportSize.height / baseCellSize));
      const candidates = [
        { columns: expandedColumns, rows: exploredRows },
        { columns: exploredColumns, rows: expandedRows },
        { columns: expandedColumns, rows: expandedRows },
      ].map((candidate) => ({
        ...candidate,
        cellSize: Math.min(mapViewportSize.width / candidate.columns, mapViewportSize.height / candidate.rows),
      }));
      return candidates.reduce((best, candidate) => {
        const bestArea = best.cellSize * best.columns * best.cellSize * best.rows;
        const candidateArea = candidate.cellSize * candidate.columns * candidate.cellSize * candidate.rows;
        return candidateArea > bestArea ? candidate : best;
      });
    })()
    : undefined;
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
          className={`map-grid${showGrid ? ' is-grid-visible' : ''}`}
          data-testid="map-grid"
          role="img"
          aria-label={`Explored terrain map with Hero at ${mapState.hero.position.x}, ${mapState.hero.position.y}`}
          style={mapStyle}
        >
          {cells.map((position) => {
            const key = positionKey(position);
            const revealed = mapState.revealedTiles[key] === true;
            const terrain = tileAt(mapState.seed, position);
            const isHero = position.x === mapState.hero.position.x && position.y === mapState.hero.position.y;
            return (
              <div
                className={`map-tile ${revealed ? `is-${terrain}` : 'is-unexplored'}`}
                key={key}
                aria-hidden="true"
              >
                {isHero ? (
                  <span className="map-hero-token">
                    <img src={heroAssets.knight.marker} alt="Hero" />
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function GearPanel(): ReactElement {
  const [activeEquipmentSlot, setActiveEquipmentSlot] = useState<EquipmentSlotId>();
  const [equippedEquipment, setEquippedEquipment] = useState<Partial<Record<EquipmentSlotId, string>>>({});
  const equipmentItems = inventoryItems.filter((item) => item.category === 'equipment');

  if (activeEquipmentSlot) {
    const activeSlot = equipmentSlots.find((slot) => slot.id === activeEquipmentSlot);
    const equipmentForSlot = activeEquipmentSlot === 'main-hand' ? equipmentItems : [];
    return (
      <EquipmentSelectorScreen
        slot={activeSlot}
        items={equipmentForSlot}
        selectedId={equippedEquipment[activeEquipmentSlot]}
        onBack={() => setActiveEquipmentSlot(undefined)}
        onSelect={(itemId) => {
          setEquippedEquipment((current) => ({ ...current, [activeEquipmentSlot]: itemId }));
          setActiveEquipmentSlot(undefined);
        }}
      />
    );
  }

  return (
    <section className="loadout-screen equipment-screen" data-testid="equipment-screen" aria-label="Gear loadout">
      <div className="equipment-paper-doll" role="list" aria-label="Gear slots">
        {equipmentSlots.map((slot) => {
          const equippedItem = inventoryItems.find((item) => item.id === equippedEquipment[slot.id]);
          const Icon = equipmentSlotIcons[slot.id];
          return (
            <button
              className={`equipment-slot equipment-slot-${slot.id}`}
              type="button"
              key={slot.id}
              data-testid={`equipment-slot-${slot.id}`}
              aria-label={`${slot.label}: ${equippedItem?.name ?? 'Empty'}`}
              onClick={() => setActiveEquipmentSlot(slot.id)}
            >
              <span className="equipment-slot-art">{equippedItem ? <Sword aria-hidden="true" /> : <Icon aria-hidden="true" />}</span>
              <span className="equipment-slot-copy">
                <span className="loadout-slot-label">{slot.label}</span>
                {equippedItem ? <strong className="loadout-slot-value">{equippedItem.name}</strong> : null}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function ToolsPanel(): ReactElement {
  const [activeToolSlot, setActiveToolSlot] = useState<ToolSlotId>();
  const [equippedTools, setEquippedTools] = useState<Partial<Record<ToolSlotId, string>>>({});

  if (activeToolSlot) {
    const activeSlot = toolSlots.find((slot) => slot.id === activeToolSlot);
    const toolChoices = tools.filter((tool) => tool.action === activeSlot?.action);
    return (
      <ToolSelectorScreen
        slot={activeSlot}
        items={toolChoices}
        selectedId={equippedTools[activeToolSlot]}
        onBack={() => setActiveToolSlot(undefined)}
        onSelect={(toolId) => {
          setEquippedTools((current) => ({ ...current, [activeToolSlot]: toolId }));
          setActiveToolSlot(undefined);
        }}
      />
    );
  }

  return (
    <section className="loadout-screen tools-screen" data-testid="tools-screen" aria-label="Tool loadout">
      <div className="tool-loadout-grid" role="list" aria-label="Tool slots">
        {toolSlots.map((slot) => {
          const equippedTool = tools.find((tool) => tool.id === equippedTools[slot.id]);
          const Icon = toolSlotIcons[slot.id];
          return (
            <button
              className="tool-slot"
              type="button"
              key={slot.id}
              data-testid={`tool-slot-${slot.id}`}
              aria-label={`${slot.label}: ${equippedTool?.name ?? 'Empty'}`}
              onClick={() => setActiveToolSlot(slot.id)}
            >
              <span className="tool-slot-art"><Icon aria-hidden="true" /></span>
              <span className="tool-slot-copy">
                <span className="loadout-slot-label">{slot.label}</span>
                {equippedTool ? <strong className="loadout-slot-value">{equippedTool.name}</strong> : null}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function EquipmentSelectorScreen({
  slot,
  items,
  selectedId,
  onBack,
  onSelect,
}: {
  slot: (typeof equipmentSlots)[number] | undefined;
  items: typeof inventoryItems;
  selectedId: string | undefined;
  onBack: () => void;
  onSelect: (itemId: string) => void;
}): ReactElement {
  return (
    <div className="loadout-screen selector-screen" data-testid="equipment-picker" aria-label={`Choose ${slot?.label ?? 'Equipment'}`}>
      <header className="selector-header">
        <button type="button" className="selector-back" aria-label="Back to Gear" data-testid="equipment-picker-back" onClick={onBack}>
          <ArrowLeft aria-hidden="true" />
        </button>
        <h2>{slot?.label}</h2>
      </header>
      {items.length ? (
        <div className="equipment-choice-grid selector-grid" role="list" aria-label={`${slot?.label ?? 'Equipment'} choices`}>
          {items.map((item) => (
            <button
              className={`equipment-choice${selectedId === item.id ? ' is-selected' : ''}`}
              type="button"
              role="listitem"
              key={item.id}
              aria-label={item.name}
              aria-pressed={selectedId === item.id}
              data-testid={`equipment-choice-${item.id}`}
              onClick={() => onSelect(item.id)}
            >
              <span className="equipment-choice-art"><Sword aria-hidden="true" /></span>
              <span className="equipment-choice-copy"><strong>{item.name}</strong></span>
              {selectedId === item.id ? <Check aria-hidden="true" /> : null}
            </button>
          ))}
        </div>
      ) : (
        <div className="selector-empty" role="status">No equipment</div>
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
}: {
  slot: (typeof toolSlots)[number] | undefined;
  items: typeof tools;
  selectedId: string | undefined;
  onBack: () => void;
  onSelect: (toolId: string) => void;
}): ReactElement {
  return (
    <div className="loadout-screen selector-screen" data-testid="tool-picker" aria-label={`Choose ${slot?.label ?? 'Tool'}`}>
      <header className="selector-header">
        <button type="button" className="selector-back" aria-label="Back to Tools" data-testid="tool-picker-back" onClick={onBack}>
          <ArrowLeft aria-hidden="true" />
        </button>
        <h2>{slot?.label}</h2>
      </header>
      <div className="tool-choice-grid selector-grid" role="list" aria-label={`${slot?.label ?? 'Tool'} choices`}>
        {items.map((tool) => {
          const Icon = tool.icon === 'axe' ? Axe : Pickaxe;
          return (
            <button
              className={`tool-choice${selectedId === tool.id ? ' is-selected' : ''}`}
              type="button"
              key={tool.id}
              aria-label={tool.name}
              aria-pressed={selectedId === tool.id}
              data-testid={`tool-choice-${tool.id}`}
              onClick={() => onSelect(tool.id)}
            >
              <span className="tool-choice-art"><Icon aria-hidden="true" /></span>
              <span className="tool-choice-copy"><strong>{tool.name}</strong></span>
              {selectedId === tool.id ? <Check aria-hidden="true" /> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function AbilitiesScreen(): ReactElement {
  const [activeAbilitySlot, setActiveAbilitySlot] = useState<AbilitySlotId>();
  const [detailAbility, setDetailAbility] = useState<typeof abilities[number]>();
  const [equippedAbilities, setEquippedAbilities] = useState<Partial<Record<AbilitySlotId, string>>>({
    ...gameSession.state.hero.equippedAbilities,
  });

  useEffect(() => gameSession.subscribe((state) => {
    setEquippedAbilities({ ...state.hero.equippedAbilities });
  }), []);

  if (activeAbilitySlot) {
    const activeSlot = abilitySlots.find((slot) => slot.id === activeAbilitySlot);
    return (
      <AbilitySelectorScreen
        slot={activeSlot}
        abilities={abilities.filter((ability) => ability.slot === activeAbilitySlot)}
        selectedId={equippedAbilities[activeAbilitySlot]}
        onBack={() => setActiveAbilitySlot(undefined)}
        onShowDetail={setDetailAbility}
        detailAbility={detailAbility}
        onCloseDetail={() => setDetailAbility(undefined)}
        onSelect={(abilityId) => {
          gameSession.equipAbility(activeAbilitySlot, abilityId);
          setActiveAbilitySlot(undefined);
        }}
      />
    );
  }

  return (
    <>
      <div className="loadout-screen">
        <section className="abilities-screen" data-testid="abilities-screen" aria-label="Ability loadout">
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
                  <AbilityArtButton
                    ability={equipped}
                    className="ability-art-button"
                    ariaLabel={`${slot.label}: ${equipped?.name ?? 'Empty'}`}
                    onClick={() => setActiveAbilitySlot(slot.id)}
                    onHold={equipped ? () => setDetailAbility(equipped) : undefined}
                  />
                  <div className="ability-loadout-label">
                    <strong>{slot.label}</strong>
                    {equipped ? <small>{equipped.name}</small> : null}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
      {detailAbility ? <AbilityDetailDialog ability={detailAbility} onClose={() => setDetailAbility(undefined)} /> : null}
    </>
  );
}

function useAbilityHold(onHold: (() => void) | undefined): {
  onPointerDown: () => void;
  onPointerUp: () => void;
  onPointerCancel: () => void;
  onPointerLeave: () => void;
  consumeClick: () => boolean;
} {
  const timerRef = useRef<number | undefined>(undefined);
  const heldRef = useRef(false);

  useEffect(() => () => {
    if (timerRef.current !== undefined) window.clearTimeout(timerRef.current);
  }, []);

  const clearTimer = (): void => {
    if (timerRef.current !== undefined) {
      window.clearTimeout(timerRef.current);
      timerRef.current = undefined;
    }
  };

  return {
    onPointerDown: () => {
      heldRef.current = false;
      clearTimer();
      if (!onHold) return;
      timerRef.current = window.setTimeout(() => {
        heldRef.current = true;
        onHold();
      }, 520);
    },
    onPointerUp: clearTimer,
    onPointerCancel: () => {
      clearTimer();
      heldRef.current = false;
    },
    onPointerLeave: () => {
      if (!heldRef.current) clearTimer();
    },
    consumeClick: () => {
      if (!heldRef.current) return false;
      heldRef.current = false;
      return true;
    },
  };
}

function AbilityArtButton({
  ability,
  className,
  ariaLabel,
  onClick,
  onHold,
}: {
  ability: typeof abilities[number] | undefined;
  className: string;
  ariaLabel: string;
  onClick: () => void;
  onHold?: () => void;
}): ReactElement {
  const hold = useAbilityHold(onHold);
  return (
    <button
      className={className}
      type="button"
      aria-label={ariaLabel}
      onPointerDown={hold.onPointerDown}
      onPointerUp={hold.onPointerUp}
      onPointerCancel={hold.onPointerCancel}
      onPointerLeave={hold.onPointerLeave}
      onContextMenu={(event) => event.preventDefault()}
      onClick={() => {
        if (!hold.consumeClick()) onClick();
      }}
    >
      {ability ? <img src={ability.assetPath} alt={ability.assetAlt} /> : <span className="ability-loadout-placeholder">+</span>}
    </button>
  );
}

function AbilityChoiceButton({
  ability,
  selected,
  onClick,
  onHold,
}: {
  ability: typeof abilities[number];
  selected: boolean;
  onClick: () => void;
  onHold: () => void;
}): ReactElement {
  const hold = useAbilityHold(onHold);
  return (
    <button
      className={`ability-choice${selected ? ' is-selected' : ''}`}
      type="button"
      role="listitem"
      aria-label={ability.name}
      aria-pressed={selected}
      data-testid={`ability-choice-${ability.id.replace('ability.', '')}`}
      onPointerDown={hold.onPointerDown}
      onPointerUp={hold.onPointerUp}
      onPointerCancel={hold.onPointerCancel}
      onPointerLeave={hold.onPointerLeave}
      onContextMenu={(event) => event.preventDefault()}
      onClick={() => {
        if (!hold.consumeClick()) onClick();
      }}
    >
      <img src={ability.assetPath} alt={ability.assetAlt} />
      <span className="ability-choice-copy"><strong>{ability.name}</strong></span>
      {selected ? <Check aria-hidden="true" /> : null}
    </button>
  );
}

function AbilityDetailDialog({
  ability,
  onClose,
}: {
  ability: typeof abilities[number];
  onClose: () => void;
}): ReactElement {
  const closeRef = useRef<HTMLButtonElement>(null);
  const cooldown = abilityActionDefinition(ability.id)?.cooldown ?? 0;

  useEffect(() => {
    closeRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="ability-detail-layer" data-testid="ability-detail">
      <button className="ability-detail-backdrop" type="button" aria-label="Close ability details" onClick={onClose} />
      <section className="ability-detail-dialog" role="dialog" aria-modal="true" aria-label={`${ability.name} details`}>
        <button ref={closeRef} className="ability-detail-close" type="button" aria-label="Close ability details" data-testid="ability-detail-close" onClick={onClose}>
          <CloseIcon aria-hidden="true" />
        </button>
        <div className="ability-detail-art">
          <img src={ability.assetPath} alt={ability.assetAlt} />
        </div>
        <div className="ability-detail-copy">
          <p className="stats-kicker">{ability.slot}</p>
          <h2>{ability.name}</h2>
          <p>{ability.description}</p>
          <small>{cooldown > 0 ? `${cooldown} Action cooldown` : 'No cooldown'}</small>
        </div>
      </section>
    </div>
  );
}

function AbilitySelectorScreen({
  slot,
  abilities: choices,
  selectedId,
  onBack,
  onSelect,
  onShowDetail,
  detailAbility,
  onCloseDetail,
}: {
  slot: (typeof abilitySlots)[number] | undefined;
  abilities: typeof abilities;
  selectedId: string | undefined;
  onBack: () => void;
  onSelect: (abilityId: string) => void;
  onShowDetail: (ability: typeof abilities[number]) => void;
  detailAbility: typeof abilities[number] | undefined;
  onCloseDetail: () => void;
}): ReactElement {
  return (
    <>
      <div className="loadout-screen selector-screen" data-testid="ability-picker" aria-label={`Choose ${slot?.label ?? 'Ability'}`}>
        <header className="selector-header">
          <button type="button" className="selector-back" aria-label="Back to Abilities" data-testid="ability-picker-back" onClick={onBack}>
            <ArrowLeft aria-hidden="true" />
          </button>
          <h2>{slot?.label}</h2>
        </header>
        <div className="ability-choice-grid selector-grid" role="list" aria-label={`${slot?.label ?? 'Ability'} choices`}>
          {choices.map((ability) => (
            <AbilityChoiceButton
              ability={ability}
              selected={selectedId === ability.id}
              onClick={() => onSelect(ability.id)}
              onHold={() => onShowDetail(ability)}
              key={ability.id}
            />
          ))}
        </div>
      </div>
      {detailAbility ? <AbilityDetailDialog ability={detailAbility} onClose={onCloseDetail} /> : null}
    </>
  );
}

type TorchSelectOption = {
  value: string;
  label: string;
};

type TorchSelectProps = {
  value: string;
  options: readonly TorchSelectOption[];
  onChange: (value: string) => void;
  ariaLabel: string;
  testId: string;
};

function TorchSelect({ value, options, onChange, ariaLabel, testId }: TorchSelectProps): ReactElement {
  const [open, setOpen] = useState(false);
  const selectRef = useRef<HTMLDivElement>(null);
  const selectedOption = options.find((option) => option.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent): void => {
      if (!selectRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  return (
    <div className={`torch-select${open ? ' is-open' : ''}`} ref={selectRef}>
      <button
        className="torch-select-trigger"
        type="button"
        role="combobox"
        aria-label={ariaLabel}
        aria-controls={`${testId}-options`}
        aria-expanded={open}
        data-testid={testId}
        onClick={() => setOpen((current) => !current)}
      >
        <span>{selectedOption?.label}</span>
        <ChevronDown aria-hidden="true" />
      </button>
      {open ? (
        <div className="torch-select-menu" id={`${testId}-options`} role="listbox" aria-label={ariaLabel}>
          {options.map((option) => (
            <button
              className="torch-select-option"
              type="button"
              role="option"
              aria-selected={option.value === value}
              key={option.value}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
            >
              <span>{option.label}</span>
              {option.value === value ? <Check aria-hidden="true" /> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function SettingsScreen(): ReactElement {
  const [fullscreen, setFullscreen] = useState(false);
  const [uiScale, setUiScale] = useState('auto');
  const [showGrid, setShowGrid] = useState(readShowGridPreference);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [screenShake, setScreenShake] = useState(true);
  const [interactionHints, setInteractionHints] = useState(true);
  const [confirmActions, setConfirmActions] = useState(false);
  const [masterVolume, setMasterVolume] = useState(80);
  const [musicVolume, setMusicVolume] = useState(70);
  const [sfxVolume, setSfxVolume] = useState(85);

  const toggleFullscreen = async (): Promise<void> => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        setFullscreen(false);
      } else if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
        setFullscreen(true);
      }
    } catch {
      setFullscreen(Boolean(document.fullscreenElement));
    }
  };

  return (
    <div className="settings-screen" data-testid="settings-screen">
      <section className="settings-group" aria-labelledby="settings-display-title">
        <div className="settings-group-heading"><p className="stats-kicker">Presentation</p><h2 id="settings-display-title">Display</h2></div>
        <div className="settings-row"><div><strong>Fullscreen</strong><small>Use the whole display for Torch.</small></div><button className="settings-action" type="button" onClick={toggleFullscreen}>{fullscreen ? 'On' : 'Off'}</button></div>
        <div className="settings-row"><span><strong>UI Scale</strong><small>Adjust interface density independently of the board.</small></span><TorchSelect value={uiScale} options={[{ value: 'auto', label: 'Auto' }, { value: 'compact', label: 'Compact' }, { value: 'large', label: 'Large' }]} onChange={setUiScale} ariaLabel="UI Scale" testId="settings-ui-scale" /></div>
        <div className="settings-row"><div><strong>Reduce Motion</strong><small>Use shorter transitions and less camera movement.</small></div><button className="settings-toggle" type="button" aria-pressed={reduceMotion} onClick={() => setReduceMotion((value) => !value)}>{reduceMotion ? 'On' : 'Off'}</button></div>
        <div className="settings-row"><div><strong>Show Grid</strong><small>Display tile boundaries across the lit Torch area.</small></div><button className="settings-toggle" type="button" aria-pressed={showGrid} data-testid="settings-show-grid" onClick={() => setShowGrid((value) => { const next = !value; setShowGridPreference(next); return next; })}>{showGrid ? 'On' : 'Off'}</button></div>
      </section>
      <section className="settings-group" aria-labelledby="settings-audio-title">
        <div className="settings-group-heading"><p className="stats-kicker">Soundscape</p><h2 id="settings-audio-title">Audio</h2></div>
        <SettingRange label="Master Volume" value={masterVolume} onChange={setMasterVolume} testId="settings-master-volume" />
        <SettingRange label="Music Volume" value={musicVolume} onChange={setMusicVolume} />
        <SettingRange label="Effects Volume" value={sfxVolume} onChange={setSfxVolume} />
      </section>
      <section className="settings-group" aria-labelledby="settings-gameplay-title">
        <div className="settings-group-heading"><p className="stats-kicker">Comfort</p><h2 id="settings-gameplay-title">Gameplay</h2></div>
        <div className="settings-row"><div><strong>Screen Shake</strong><small>Emphasize impactful actions and attacks.</small></div><button className="settings-toggle" type="button" aria-pressed={screenShake} onClick={() => setScreenShake((value) => !value)}>{screenShake ? 'On' : 'Off'}</button></div>
        <div className="settings-row"><div><strong>Interaction Hints</strong><small>Show contextual action affordances near the Hero.</small></div><button className="settings-toggle" type="button" aria-pressed={interactionHints} onClick={() => setInteractionHints((value) => !value)}>{interactionHints ? 'On' : 'Off'}</button></div>
        <div className="settings-row"><div><strong>Confirm Context Actions</strong><small>Ask before gathering, mining, or attacking from a blocked move.</small></div><button className="settings-toggle" type="button" aria-pressed={confirmActions} onClick={() => setConfirmActions((value) => !value)}>{confirmActions ? 'On' : 'Off'}</button></div>
      </section>
      <p className="settings-note">These controls are a local prototype. Save-backed preferences and platform adapters will be added with the settings service.</p>
    </div>
  );
}

function SettingRange({ label, value, onChange, testId }: { label: string; value: number; onChange: (value: number) => void; testId?: string }): ReactElement {
  return (
    <label className="settings-range-row">
      <span><strong>{label}</strong><small>{value}%</small></span>
      <input data-testid={testId} className="settings-range" type="range" min="0" max="100" value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );
}
