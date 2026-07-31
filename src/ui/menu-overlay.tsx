import { useEffect, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import {
  Backpack,
  Check,
  CircleEllipsis,
  Coins,
  ChevronDown,
  FlaskConical,
  Gem,
  ListFilter,
  Menu as MenuIcon,
  PackageOpen,
  Shield,
  Sparkles,
  Sword,
  TreePine,
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
import { inventoryCategories, inventoryItems } from '../content/inventory';
import type { InventoryCategory, InventoryIconId } from '../content/inventory';

type MenuItem = {
  label: string;
  detail: string;
  available?: boolean;
};

type InventorySort = 'category' | 'name' | 'quantity';
type Screen = 'menu' | 'hero' | 'inventory' | 'equipment' | 'abilities' | 'settings';

const menuItems: MenuItem[] = [
  { label: 'Crafting', detail: 'Coming soon' },
  { label: 'Journal', detail: 'Coming soon' },
  { label: 'Talents', detail: 'Coming soon' },
  { label: 'Settings', detail: 'Controls & display', available: true },
];

const heroStats = [
  ['Strength', heroDefinitions.knight.primaryStats.strength],
  ['Agility', heroDefinitions.knight.primaryStats.agility],
  ['Toughness', heroDefinitions.knight.primaryStats.toughness],
  ['Wisdom', heroDefinitions.knight.primaryStats.wisdom],
  ['Intellect', heroDefinitions.knight.primaryStats.intellect],
] as const;

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

export function MenuOverlay(): ReactElement {
  const [open, setOpen] = useState(false);
  const [screen, setScreen] = useState<Screen>('menu');
  const [heroStatus, setHeroStatus] = useState(() => ({
    health: gameSession.state.hero.health,
    maxHealth: gameSession.state.hero.maxHealth,
  }));
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const unsubscribe = gameSession.subscribe((state) => {
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

  const openMenu = (nextScreen: Screen = 'menu'): void => {
    setScreen(nextScreen);
    setOpen(true);
  };

  const hpRatio = heroStatus.maxHealth > 0
    ? Math.max(0, Math.min(1, heroStatus.health / heroStatus.maxHealth))
    : 0;

  return (
    <>
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
            aria-label="Open equipment"
            aria-controls="torch-menu"
            data-testid="hud-equipment-button"
            onClick={() => openMenu('equipment')}
          >
            <Shield aria-hidden="true" />
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
            <div className="menu-header">
              <div>
                <p className="menu-kicker">Torch</p>
                <h1 id="menu-title">
                  {screen === 'menu' ? 'Menu' : screen === 'hero' ? 'Hero' : screen === 'inventory' ? 'Inventory' : screen === 'equipment' ? 'Equipment' : screen === 'abilities' ? 'Abilities' : 'Settings'}
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
              <HeroScreen />
            ) : screen === 'inventory' ? (
              <InventoryScreen />
            ) : screen === 'equipment' ? (
              <EquipmentScreen />
            ) : screen === 'abilities' ? (
              <AbilitiesScreen />
            ) : (
              <SettingsScreen />
            )}
          </section>
        </div>
      ) : null}
    </>
  );
}

function InventoryScreen(): ReactElement {
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

function HeroScreen(): ReactElement {
  return (
    <div className="hero-screen">
      <div className="hero-details">
        <img
          className="hero-art-full"
          src={heroAssets.knight.full}
          alt={heroAssets.knight.fullAlt}
          data-testid="hero-art-full"
        />

        <section className="stats-panel hero-stats-panel" aria-labelledby="hero-stats-title">
          <div className="stats-panel-header">
            <p className="stats-kicker">{heroDefinitions.knight.name}</p>
            <h2 id="hero-stats-title">Stats</h2>
          </div>
          <dl className="stats-list">
            {heroStats.map(([label, value]) => (
              <div className="stat-row" key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </div>
  );
}

function EquipmentScreen(): ReactElement {
  const [activeEquipmentSlot, setActiveEquipmentSlot] = useState<EquipmentSlotId>();
  const [pendingEquipmentId, setPendingEquipmentId] = useState<string>();
  const [equippedEquipment, setEquippedEquipment] = useState<Partial<Record<EquipmentSlotId, string>>>({});

  const equipmentItems = inventoryItems.filter((item) => item.category === 'equipment');
  const equipmentForSlot = activeEquipmentSlot === 'main-hand' ? equipmentItems : [];
  const activeEquipmentLabel = equipmentSlots.find((slot) => slot.id === activeEquipmentSlot)?.label;

  const openEquipmentSlot = (slot: EquipmentSlotId): void => {
    setActiveEquipmentSlot(slot);
    setPendingEquipmentId(equippedEquipment[slot]);
  };

  const equipItem = (): void => {
    if (!activeEquipmentSlot || !pendingEquipmentId) return;
    setEquippedEquipment((current) => ({ ...current, [activeEquipmentSlot]: pendingEquipmentId }));
    setActiveEquipmentSlot(undefined);
  };

  return (
    <div className="loadout-screen">
      <section className="loadout-panel dedicated-loadout" data-testid="equipment-screen" aria-labelledby="equipment-screen-title">
        <div className="loadout-section-header">
          <div>
            <p className="stats-kicker">Hero Loadout</p>
            <h2 id="equipment-screen-title">Equipment Slots</h2>
          </div>
          <span className="loadout-count">{Object.keys(equippedEquipment).length}/10</span>
        </div>
        {activeEquipmentSlot ? (
          <section className="loadout-picker" data-testid="equipment-picker" aria-label={`Choose ${activeEquipmentLabel}`}>
            <div className="loadout-picker-header">
              <h3>Choose {activeEquipmentLabel}</h3>
              <button type="button" className="loadout-picker-close" aria-label="Close equipment picker" onClick={() => setActiveEquipmentSlot(undefined)}><CloseIcon aria-hidden="true" /></button>
            </div>
            {equipmentForSlot.length ? (
              <div className="loadout-choice-list">
                {equipmentForSlot.map((item) => (
                  <button
                    className={`loadout-choice${pendingEquipmentId === item.id ? ' is-selected' : ''}`}
                    type="button"
                    key={item.id}
                    aria-pressed={pendingEquipmentId === item.id}
                    onClick={() => setPendingEquipmentId(item.id)}
                  >
                    <Sword aria-hidden="true" />
                    <span>{item.name}</span>
                    {pendingEquipmentId === item.id ? <Check aria-hidden="true" /> : null}
                  </button>
                ))}
              </div>
            ) : <p className="loadout-empty">No compatible items yet.</p>}
            <button className="loadout-confirm" type="button" disabled={!pendingEquipmentId} onClick={equipItem}>Equip</button>
          </section>
        ) : (
          <div className="equipment-slot-grid" role="list" aria-label="Equipment slots">
            {equipmentSlots.map((slot) => {
              const equippedId = equippedEquipment[slot.id];
              const equippedItem = inventoryItems.find((item) => item.id === equippedId);
              return (
                <button
                  className="loadout-slot"
                  type="button"
                  key={slot.id}
                  data-testid={`equipment-slot-${slot.id}`}
                  aria-label={`${slot.label}: ${equippedItem?.name ?? 'Empty'}`}
                  onClick={() => openEquipmentSlot(slot.id)}
                >
                  <span className="loadout-slot-label">{slot.label}</span>
                  <span className="loadout-slot-value">{equippedItem?.name ?? 'Empty'}</span>
                </button>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function AbilitiesScreen(): ReactElement {
  const [activeAbilitySlot, setActiveAbilitySlot] = useState<AbilitySlotId>();
  const [pendingAbilityId, setPendingAbilityId] = useState<string>();
  const [equippedAbilities, setEquippedAbilities] = useState<Partial<Record<AbilitySlotId, string>>>({});
  const activeAbilityLabel = abilitySlots.find((slot) => slot.id === activeAbilitySlot)?.label;

  const openAbilitySlot = (slot: AbilitySlotId): void => {
    setActiveAbilitySlot(slot);
    setPendingAbilityId(equippedAbilities[slot]);
  };

  const assignAbility = (): void => {
    if (!activeAbilitySlot || !pendingAbilityId) return;
    setEquippedAbilities((current) => ({ ...current, [activeAbilitySlot]: pendingAbilityId }));
    setActiveAbilitySlot(undefined);
  };

  return (
    <div className="loadout-screen">
      <section className="loadout-panel dedicated-loadout" data-testid="abilities-screen" aria-labelledby="abilities-screen-title">
        <div className="loadout-section-header">
          <div>
            <p className="stats-kicker">Hero Loadout</p>
            <h2 id="abilities-screen-title">Ability Slots</h2>
          </div>
          <span className="loadout-count">{Object.keys(equippedAbilities).length}/3</span>
        </div>
        {activeAbilitySlot ? (
          <section className="loadout-picker" data-testid="ability-picker" aria-label={`Choose ${activeAbilityLabel} ability`}>
            <div className="loadout-picker-header">
              <h3>Choose {activeAbilityLabel}</h3>
              <button type="button" className="loadout-picker-close" aria-label="Close ability picker" onClick={() => setActiveAbilitySlot(undefined)}><CloseIcon aria-hidden="true" /></button>
            </div>
            <div className="ability-choice-list">
              {abilities.filter((ability) => ability.slot === activeAbilitySlot).map((ability) => (
                <button
                  className={`ability-choice${pendingAbilityId === ability.id ? ' is-selected' : ''}`}
                  type="button"
                  key={ability.id}
                  data-testid={`ability-choice-${ability.id.replace('ability.', '')}`}
                  aria-pressed={pendingAbilityId === ability.id}
                  onClick={() => setPendingAbilityId(ability.id)}
                >
                  <img src={ability.assetPath} alt={ability.assetAlt} />
                  <span><strong>{ability.name}</strong><small>{ability.description}</small></span>
                  {pendingAbilityId === ability.id ? <Check aria-hidden="true" /> : null}
                </button>
              ))}
            </div>
            <button className="loadout-confirm" type="button" disabled={!pendingAbilityId} onClick={assignAbility}>Assign</button>
          </section>
        ) : (
          <div className="ability-slot-list" role="list" aria-label="Ability slots">
            {abilitySlots.map((slot) => {
              const equipped = abilities.find((ability) => ability.id === equippedAbilities[slot.id]);
              return (
                <button
                  className="ability-slot"
                  type="button"
                  key={slot.id}
                  data-testid={`ability-slot-${slot.id}`}
                  aria-label={`${slot.label} ability: ${equipped?.name ?? 'Empty'}`}
                  onClick={() => openAbilitySlot(slot.id)}
                >
                  {equipped ? <img src={equipped.assetPath} alt="" /> : <span className="ability-slot-placeholder">+</span>}
                  <span>
                    <strong>{slot.label}</strong>
                    <small>{equipped?.name ?? 'Empty'}</small>
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </section>
    </div>
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
