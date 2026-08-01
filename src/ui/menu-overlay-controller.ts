import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameState, ProfileJournalState, SimEvent } from '../sim';
import type { RefObject } from 'react';
import { feedbackAnnouncementForBatch } from '../game/feedback-presenter';
import { OPEN_JOURNAL_EVENT, OPEN_MAP_EVENT } from '../game/input-bindings';
import { useGameRuntime } from './runtime-context';

export type MenuScreen =
  'menu' | 'hero' | 'inventory' | 'gear' | 'crafting' | 'abilities' | 'journal' | 'map' | 'settings';

export const menuScreenFocusSelector = (screen: MenuScreen): string | undefined => {
  switch (screen) {
    case 'inventory':
      return '[data-testid="inventory-filter"]';
    case 'gear':
      return '[data-testid="equipment-slot-helm"]';
    case 'crafting':
      return '[data-testid="crafting-search"]';
    case 'abilities':
      return '[data-testid="ability-card-basic"]';
    case 'journal':
      return '[data-testid="journal-tab-overview"]';
    case 'settings':
      return '[data-testid="settings-tab-display"]';
    default:
      return undefined;
  }
};

const screenTriggerTestIds: Partial<Record<MenuScreen, string>> = {
  hero: 'hud-hero-button',
  inventory: 'hud-inventory-button',
  gear: 'hud-gear-button',
  abilities: 'hud-abilities-button',
  menu: 'menu-button',
};

/**
 * Owns menu-session wiring, focus recovery, and overlay input mode. The shell
 * deliberately receives only this small controller surface so individual menu
 * screens remain presentation-only.
 */
export function useMenuOverlayController(): {
  open: boolean;
  screen: MenuScreen;
  setScreen: (screen: MenuScreen) => void;
  gameState: GameState;
  profileJournal: ProfileJournalState;
  gameEvents: SimEvent[];
  feedbackAnnouncement: string;
  heroStatus: { health: number; maxHealth: number };
  closeButtonRef: RefObject<HTMLButtonElement | null>;
  openMenu: (screen?: MenuScreen, invoker?: HTMLElement | null) => void;
  handleMenuOpenChange: (open: boolean) => void;
  scheduleMenuFocusRestore: () => void;
} {
  const runtime = useGameRuntime();
  const [open, setOpen] = useState(false);
  const [screen, setScreen] = useState<MenuScreen>('menu');
  const [gameState, setGameState] = useState(() => runtime.state);
  const [profileJournal, setProfileJournal] = useState<ProfileJournalState>(() => runtime.profileJournal);
  const [gameEvents, setGameEvents] = useState<SimEvent[]>([]);
  const [feedbackAnnouncement, setFeedbackAnnouncement] = useState('');
  const [heroStatus, setHeroStatus] = useState(() => ({
    health: runtime.state.hero.health,
    maxHealth: runtime.state.hero.maxHealth,
  }));
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const returnFocusTestIdRef = useRef<string | null>(null);
  const previousOpenRef = useRef(false);
  const previousScreenRef = useRef<MenuScreen>(screen);
  const hasOpenedMenuRef = useRef(false);
  const focusRestoreFramesRef = useRef<number[]>([]);
  const focusRestoreTimersRef = useRef<number[]>([]);

  const cancelMenuFocusRestore = useCallback((): void => {
    focusRestoreFramesRef.current.forEach((frame) => window.cancelAnimationFrame(frame));
    focusRestoreTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    focusRestoreFramesRef.current = [];
    focusRestoreTimersRef.current = [];
  }, []);

  const restoreMenuFocus = useCallback((): void => {
    const target =
      (returnFocusRef.current && document.contains(returnFocusRef.current) ? returnFocusRef.current : null) ??
      (returnFocusTestIdRef.current
        ? document.querySelector<HTMLElement>(`[data-testid="${returnFocusTestIdRef.current}"]`)
        : null);
    if (!target || !document.contains(target)) return;
    target.focus({ preventScroll: true });
  }, []);

  const scheduleMenuFocusRestore = useCallback((): void => {
    cancelMenuFocusRestore();
    const firstFrame = window.requestAnimationFrame(() => {
      const secondFrame = window.requestAnimationFrame(() => {
        focusRestoreFramesRef.current = focusRestoreFramesRef.current.filter((frame) => frame !== secondFrame);
        if (document.body.dataset.menuOpen === 'true') return;
        restoreMenuFocus();
        focusRestoreTimersRef.current.push(
          window.setTimeout(() => {
            if (document.body.dataset.menuOpen !== 'true') restoreMenuFocus();
          }, 120),
          window.setTimeout(() => {
            if (document.body.dataset.menuOpen !== 'true') restoreMenuFocus();
          }, 300),
        );
      });
      focusRestoreFramesRef.current.push(secondFrame);
    });
    focusRestoreFramesRef.current.push(firstFrame);
  }, [cancelMenuFocusRestore, restoreMenuFocus]);

  const openMenu = useCallback(
    (nextScreen: MenuScreen = 'menu', invoker?: HTMLElement | null): void => {
      cancelMenuFocusRestore();
      const triggerTestId = invoker?.dataset.testid ?? screenTriggerTestIds[nextScreen] ?? null;
      returnFocusTestIdRef.current = triggerTestId;
      returnFocusRef.current =
        invoker ??
        (triggerTestId ? document.querySelector<HTMLElement>(`[data-testid="${triggerTestId}"]`) : null) ??
        (document.activeElement instanceof HTMLElement ? document.activeElement : null);
      setScreen(nextScreen);
      setOpen(true);
      if (nextScreen === 'inventory') runtime.recordProfileObservation('open-inventory');
      if (nextScreen === 'journal') runtime.recordProfileObservation('open-journal');
    },
    [cancelMenuFocusRestore, runtime],
  );

  const handleMenuOpenChange = useCallback(
    (nextOpen: boolean): void => {
      if (nextOpen) cancelMenuFocusRestore();
      setOpen(nextOpen);
      if (!nextOpen) scheduleMenuFocusRestore();
    },
    [cancelMenuFocusRestore, scheduleMenuFocusRestore],
  );

  useEffect(() => {
    const unsubscribe = runtime.subscribeSnapshot((snapshot) => {
      setGameState(snapshot.state);
      setProfileJournal(snapshot.profileJournal);
      setGameEvents([...snapshot.events]);
      setHeroStatus({ health: snapshot.state.hero.health, maxHealth: snapshot.state.hero.maxHealth });
    });
    return unsubscribe;
  }, [runtime]);

  useEffect(
    () =>
      runtime.subscribeActionBatches((batch) => {
        const announcement = feedbackAnnouncementForBatch(batch);
        if (announcement) setFeedbackAnnouncement(announcement);
      }),
    [runtime],
  );

  useEffect(() => {
    runtime.setInputMode(open ? 'ui' : 'world');
    document.body.dataset.menuOpen = String(open);
    return () => {
      runtime.setInputMode('world');
      delete document.body.dataset.menuOpen;
    };
  }, [open, runtime]);

  useEffect(() => {
    // World shortcuts return to the durable HUD menu control, rather than the
    // canvas (which is not a useful keyboard-focus destination).
    const openFromWorldShortcut = (nextScreen: MenuScreen): void => {
      cancelMenuFocusRestore();
      returnFocusTestIdRef.current = 'menu-button';
      returnFocusRef.current = document.querySelector<HTMLElement>('[data-testid="menu-button"]');
      setScreen(nextScreen);
      setOpen(true);
      if (nextScreen === 'journal') runtime.recordProfileObservation('open-journal');
    };
    const handleOpenMap = (): void => openFromWorldShortcut('map');
    const handleOpenJournal = (): void => openFromWorldShortcut('journal');
    window.addEventListener(OPEN_MAP_EVENT, handleOpenMap);
    window.addEventListener(OPEN_JOURNAL_EVENT, handleOpenJournal);
    return () => {
      window.removeEventListener(OPEN_MAP_EVENT, handleOpenMap);
      window.removeEventListener(OPEN_JOURNAL_EVENT, handleOpenJournal);
    };
  }, [cancelMenuFocusRestore, runtime]);

  useEffect(() => {
    if (previousOpenRef.current && !open) scheduleMenuFocusRestore();
    previousOpenRef.current = open;
  }, [open, scheduleMenuFocusRestore]);

  useEffect(() => {
    const previousScreen = previousScreenRef.current;
    previousScreenRef.current = screen;
    if (!open || !hasOpenedMenuRef.current || previousScreen === screen || screen === 'menu') {
      if (open) hasOpenedMenuRef.current = true;
      return;
    }
    const frame = window.requestAnimationFrame(() => {
      if (document.body.dataset.menuOpen !== 'true') return;
      const selector = menuScreenFocusSelector(screen);
      const target = (selector ? document.querySelector<HTMLElement>(selector) : null) ?? closeButtonRef.current;
      target?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [open, screen]);

  useEffect(() => cancelMenuFocusRestore, [cancelMenuFocusRestore]);

  return {
    open,
    screen,
    setScreen,
    gameState,
    profileJournal,
    gameEvents,
    feedbackAnnouncement,
    heroStatus,
    closeButtonRef,
    openMenu,
    handleMenuOpenChange,
    scheduleMenuFocusRestore,
  };
}
