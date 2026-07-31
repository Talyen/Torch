import { Axe, Pickaxe, Sparkles, Sword } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactElement } from 'react';
import { abilities } from '../content/abilities';
import { gameSession } from '../game/session';
import { availableContextActionsAt, contextActionCardKey, contextualActionTargets, positionKey } from '../sim';
import type { ContextActionOption, GameState, Position, SimEvent } from '../sim';

interface ContextActionHandProps {
  state: GameState;
  events: SimEvent[];
  hidden?: boolean;
}

export interface HandMetrics {
  cardWidth: number;
  cardHeight: number;
  step: number;
  angleStep: number;
  tuckDepth: number;
}

interface CardRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface PlayingGhost {
  action: ContextActionOption;
  sourceRect?: CardRect;
}

const MIN_CARD_WIDTH = 72;
const MAX_CARD_WIDTH = 132;
const HAND_OVERLAP = 0.48;
const CARD_ASPECT_HEIGHT = 4 / 3;
const CARD_TUCK_RATIO = 0.1;
const PLAY_DURATION_MS = 560;
const REVEAL_DURATION_MS = 240;

export function ContextActionHand({ state, events, hidden = false }: ContextActionHandProps): ReactElement | null {
  const handRef = useRef<HTMLDivElement>(null);
  const [handElement, setHandElement] = useState<HTMLDivElement | null>(null);
  const [availableWidth, setAvailableWidth] = useState(0);
  const [focusedTargetKey, setFocusedTargetKey] = useState<string>();
  const [activatingId, setActivatingId] = useState<string>();
  const [playingAction, setPlayingAction] = useState<ContextActionOption>();
  const [playingGhost, setPlayingGhost] = useState<PlayingGhost>();
  const [replacingCardKey, setReplacingCardKey] = useState<string>();
  const [revealingCardKey, setRevealingCardKey] = useState<string>();
  const seenCardKeysRef = useRef(new Set<string>());
  const knownActionsRef = useRef(new Map<string, ContextActionOption>());
  const sourceRectsRef = useRef(new Map<string, CardRect>());
  const lastPlaybackSignatureRef = useRef<string | undefined>(undefined);
  const handCallbackRef = useCallback((element: HTMLDivElement | null): void => {
    handRef.current = element;
    setHandElement(element);
  }, []);

  const targets = contextualActionTargets(state);
  const focusedTarget = useMemo(() => {
    const current = focusedTargetKey ? parsePositionKey(focusedTargetKey) : undefined;
    if (current && targets.some((target) => target.x === current.x && target.y === current.y)) return current;
    return targets[0];
  }, [focusedTargetKey, targets]);

  useEffect(() => {
    if (!focusedTarget) {
      setFocusedTargetKey(undefined);
      return;
    }
    setFocusedTargetKey(positionKey(focusedTarget));
  }, [focusedTarget]);

  useEffect(() => {
    const element = handElement;
    if (!element) return;

    const measure = (): void => setAvailableWidth(element.clientWidth);
    measure();
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(measure);
    observer?.observe(element);
    window.addEventListener('resize', measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [handElement]);

  const actions = useMemo(
    () => availableContextActionsAt(state, focusedTarget),
    [focusedTarget, state],
  );
  const metrics = useMemo(() => calculateHandMetrics(availableWidth, actions.length), [actions.length, availableWidth]);
  const enteringCardKeys = useMemo(() => {
    const entering = new Set<string>();
    for (const action of actions) {
      const cardKey = contextActionCardKey(action);
      if (!seenCardKeysRef.current.has(cardKey)) entering.add(cardKey);
    }
    return entering;
  }, [actions]);

  useEffect(() => {
    actions.forEach((action) => seenCardKeysRef.current.add(contextActionCardKey(action)));
  }, [actions]);

  useEffect(() => {
    actions.forEach((action) => knownActionsRef.current.set(contextActionCardKey(action), action));
  }, [actions]);

  useEffect(() => {
    const resolvedEvent = [...events].reverse().find(
      (event): event is Extract<SimEvent, { type: 'action-resolved' | 'ability-used' }> => (
        event.type === 'action-resolved' || event.type === 'ability-used'
      ),
    );
    if (!resolvedEvent) return;

    const eventSignature = [
      state.turn,
      resolvedEvent.type,
      resolvedEvent.entityId,
      resolvedEvent.type === 'ability-used' ? resolvedEvent.abilityId : resolvedEvent.action,
      resolvedEvent.target.x,
      resolvedEvent.target.y,
    ].join(':');
    if (lastPlaybackSignatureRef.current === eventSignature) return;
    lastPlaybackSignatureRef.current = eventSignature;

    const cardKey = resolvedEvent.type === 'ability-used'
      ? `ability:${resolvedEvent.abilityId}`
      : resolvedEvent.action === 'ability'
        ? `ability:${resolvedEvent.abilityId ?? ''}`
        : `entity:${resolvedEvent.action}`;
    const rememberedAction = knownActionsRef.current.get(cardKey);
    const action = rememberedAction?.action.entityId === resolvedEvent.entityId
      ? rememberedAction
      : resolvedEvent.type === 'ability-used'
        ? actionForAbilityUsedEvent(state, resolvedEvent)
        : actionForResolvedEvent(state, resolvedEvent);
    if (!action) return;

    setPlayingAction(action);
    setPlayingGhost({ action, sourceRect: sourceRectsRef.current.get(cardKey) });
    setActivatingId(action.id);
    setReplacingCardKey(cardKey);
  }, [events, state]);

  useEffect(() => {
    if (!playingAction || !replacingCardKey) return;
    const playDuration = document.documentElement.dataset.reduceMotion === 'true'
      ? 80
      : PLAY_DURATION_MS;
    const timeout = window.setTimeout(() => {
      setPlayingAction(undefined);
      setActivatingId(undefined);
      setReplacingCardKey(undefined);
      setRevealingCardKey(replacingCardKey);
      setPlayingGhost(undefined);
    }, playDuration);
    return () => window.clearTimeout(timeout);
  }, [playingAction, replacingCardKey]);

  useEffect(() => {
    if (!revealingCardKey) return;
    const timeout = window.setTimeout(() => setRevealingCardKey(undefined), REVEAL_DURATION_MS);
    return () => window.clearTimeout(timeout);
  }, [revealingCardKey]);

  useEffect(() => {
    if (!hidden) return;
    setPlayingGhost(undefined);
    setPlayingAction(undefined);
    setActivatingId(undefined);
    setReplacingCardKey(undefined);
  }, [hidden]);

  const displayedActions = actionsDuringCardPlayback(actions, playingAction, replacingCardKey);
  const displayedPlayingId = playingAction?.id ?? activatingId;
  const handLayer = !hidden && displayedActions.length > 0 ? (
    <div
      ref={handCallbackRef}
      className="context-action-hand"
      data-testid="context-action-hand"
      aria-label="Available actions"
    >
      <div className="context-action-hand__cards" style={{ height: `${metrics.cardHeight + 42}px` }}>
        {displayedActions.map((action, index) => (
          <ContextActionCard
            action={action}
            index={index}
            count={displayedActions.length}
            metrics={metrics}
            entering={enteringCardKeys.has(contextActionCardKey(action)) || revealingCardKey === contextActionCardKey(action)}
            activating={displayedPlayingId === action.id}
            playing={playingAction?.id === action.id}
            key={contextActionCardKey(action)}
            onActivate={(activatedAction, rect) => {
              if (activatedAction.disabledReason) return;
              sourceRectsRef.current.set(contextActionCardKey(activatedAction), rect);
              gameSession.performAction(activatedAction.action);
            }}
          />
        ))}
      </div>
    </div>
  ) : null;

  const ghostLayer = !hidden && playingGhost && typeof document !== 'undefined'
    ? createPortal(<PlayGhost {...playingGhost} />, document.body)
    : null;

  if (!handLayer && !ghostLayer) return null;
  return <>{handLayer}{ghostLayer}</>;
}

/**
 * Keeps the played card in place while its animation runs. If the simulation
 * immediately projects a new card with the same presentation key (for
 * example, another Chop target), that replacement is withheld until the
 * playback timer ends so React cannot reuse the old card in place.
 */
export function actionsDuringCardPlayback(
  actions: ContextActionOption[],
  playingAction: ContextActionOption | undefined,
  replacingCardKey: string | undefined,
): ContextActionOption[] {
  const currentActions = replacingCardKey
    ? actions.filter((action) => contextActionCardKey(action) !== replacingCardKey)
    : actions;
  if (!playingAction) return currentActions;

  const playingCardKey = contextActionCardKey(playingAction);
  const replacementIndex = actions.findIndex((action) => contextActionCardKey(action) === playingCardKey);
  if (replacementIndex < 0) return [playingAction, ...currentActions];
  return [
    ...currentActions.slice(0, replacementIndex),
    playingAction,
    ...currentActions.slice(replacementIndex),
  ];
}

function ContextActionCard({
  action,
  index,
  count,
  metrics,
  entering,
  activating,
  playing,
  onActivate,
}: {
  action: ContextActionOption;
  index: number;
  count: number;
  metrics: HandMetrics;
  entering: boolean;
  activating: boolean;
  playing: boolean;
  onActivate: (action: ContextActionOption, rect: CardRect) => void;
}): ReactElement {
  const centeredIndex = index - (count - 1) / 2;
  const isDisabled = Boolean(action.disabledReason);
  const [pointerDown, setPointerDown] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [playArmed, setPlayArmed] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const pointerStartRef = useRef<{ x: number; y: number } | undefined>(undefined);
  const draggingRef = useRef(false);
  const playArmedRef = useRef(false);
  const didDragRef = useRef(false);

  const cardStyle = {
    '--action-width': `${metrics.cardWidth}px`,
    '--action-x': `${centeredIndex * metrics.step}px`,
    '--action-y': `${Math.abs(centeredIndex) * 7}px`,
    '--action-angle': `${centeredIndex * metrics.angleStep}deg`,
    '--action-delay': `${index * 38}ms`,
    '--action-drag-x': `${dragOffset.x}px`,
    '--action-drag-y': `${dragOffset.y}px`,
    zIndex: 20 + index,
  } as CSSProperties;

  const resetGesture = (): void => {
    pointerStartRef.current = undefined;
    draggingRef.current = false;
    playArmedRef.current = false;
    setPointerDown(false);
    setDragging(false);
    setPlayArmed(false);
    setDragOffset({ x: 0, y: 0 });
  };

  const activate = (element: HTMLButtonElement): void => {
    if (isDisabled || playing) return;
    const rect = element.getBoundingClientRect();
    onActivate(action, {
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
    });
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLButtonElement>): void => {
    if (isDisabled || playing || event.button !== 0) return;
    didDragRef.current = false;
    pointerStartRef.current = { x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
    setPointerDown(true);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLButtonElement>): void => {
    const start = pointerStartRef.current;
    if (!start || isDisabled || playing) return;
    const offset = { x: event.clientX - start.x, y: event.clientY - start.y };
    if (!draggingRef.current && Math.hypot(offset.x, offset.y) < 8) return;

    draggingRef.current = true;
    didDragRef.current = true;
    const armed = offset.y < -54 && Math.abs(offset.y) > Math.abs(offset.x) * 0.72;
    playArmedRef.current = armed;
    setDragging(true);
    setPlayArmed(armed);
    setDragOffset(offset);
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLButtonElement>): void => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (draggingRef.current && playArmedRef.current) activate(event.currentTarget);
    resetGesture();
  };

  const handlePointerCancel = (event: ReactPointerEvent<HTMLButtonElement>): void => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    resetGesture();
  };

  return (
    <button
      className={`context-action-card${entering ? ' is-entering' : ''}${isDisabled ? ' is-disabled' : ''}${activating ? ' is-activating' : ''}${playing ? ' is-playing' : ''}${pointerDown ? ' is-pressed' : ''}${dragging ? ' is-dragging' : ''}${playArmed ? ' is-play-armed' : ''}`}
      type="button"
      style={cardStyle}
      disabled={isDisabled || playing}
      aria-label={playing ? `${actionAriaLabel(action)}, resolving` : actionAriaLabel(action)}
      aria-disabled={isDisabled || playing}
      aria-busy={playing}
      data-testid={`context-action-card-${action.id.replaceAll(':', '-')}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onClick={(event) => {
        if (didDragRef.current) {
          event.preventDefault();
          didDragRef.current = false;
          return;
        }
        activate(event.currentTarget);
      }}
    >
      <span className="context-action-card__art" aria-hidden="true">
        <CardArtwork action={action} />
      </span>
      <span className="context-action-card__shade" aria-hidden="true" />
      <span className="context-action-card__meta">
        <strong>{action.label}</strong>
        <small>{action.source === 'ability' ? action.slot : action.entityName}</small>
      </span>
      {action.progress ? (
        <span className="context-action-card__progress" aria-label={`${action.progress.current} of ${action.progress.required}`}>
          {action.progress.current}/{action.progress.required}
        </span>
      ) : null}
      {action.disabledReason ? (
        <span className="context-action-card__cooldown">{action.cooldownRemaining}</span>
      ) : null}
    </button>
  );
}

function PlayGhost({ action, sourceRect }: PlayingGhost): ReactElement {
  const cardWidth = sourceRect?.width ?? 108;
  const cardHeight = sourceRect?.height ?? cardWidth * CARD_ASPECT_HEIGHT;
  const viewportWidth = typeof window === 'undefined' ? 390 : window.innerWidth;
  const viewportHeight = typeof window === 'undefined' ? 844 : window.innerHeight;
  const left = sourceRect?.left ?? viewportWidth / 2 - cardWidth / 2;
  const top = sourceRect?.top ?? viewportHeight - cardHeight - 74;
  const targetLeft = viewportWidth / 2 - cardWidth / 2;
  const targetTop = Math.max(72, viewportHeight * 0.38 - cardHeight / 2);
  const style = {
    '--ghost-left': `${left}px`,
    '--ghost-top': `${top}px`,
    '--ghost-width': `${cardWidth}px`,
    '--ghost-height': `${cardHeight}px`,
    '--ghost-travel-x': `${targetLeft - left}px`,
    '--ghost-travel-y': `${targetTop - top}px`,
  } as CSSProperties;

  return (
    <div
      className="context-action-play-ghost"
      style={style}
      data-testid="context-action-play-ghost"
      aria-hidden="true"
    >
      <span className="context-action-card__art"><CardArtwork action={action} /></span>
      <span className="context-action-card__shade" />
      <span className="context-action-card__meta">
        <strong>{action.label}</strong>
        <small>{action.source === 'ability' ? action.slot : action.entityName}</small>
      </span>
    </div>
  );
}

function CardArtwork({ action }: { action: ContextActionOption }): ReactElement {
  if (action.source === 'ability') {
    const ability = abilities.find((candidate) => candidate.id === action.abilityId);
    if (ability) {
      return <img src={ability.assetPath} alt="" loading="eager" />;
    }
    return <Sparkles aria-hidden="true" />;
  }

  if (action.action.kind === 'chop') return <Axe aria-hidden="true" />;
  if (action.action.kind === 'mine') return <Pickaxe aria-hidden="true" />;
  return <Sword aria-hidden="true" />;
}

function actionForAbilityUsedEvent(
  state: GameState,
  event: Extract<SimEvent, { type: 'ability-used' }>,
): ContextActionOption | undefined {
  const entityName = state.entities[event.entityId]?.name ?? 'Target';
  const ability = abilities.find((candidate) => candidate.id === event.abilityId);
  if (!ability) return undefined;

  return {
    id: `context:ability:${ability.id}`,
    label: ability.name,
    source: 'ability',
    entityName,
    abilityId: ability.id,
    slot: ability.slot,
    action: {
      kind: 'ability',
      entityId: event.entityId,
      target: { ...event.target },
      abilityId: ability.id,
    },
  };
}

function actionForResolvedEvent(
  state: GameState,
  event: Extract<SimEvent, { type: 'action-resolved' }>,
): ContextActionOption | undefined {
  if (event.action === 'ability') {
    const ability = abilities.find((candidate) => candidate.id === event.abilityId);
    if (!ability) return undefined;

    return {
      id: `context:ability:${ability.id}`,
      label: ability.name,
      source: 'ability',
      entityName: state.entities[event.entityId]?.name ?? 'Target',
      abilityId: ability.id,
      slot: ability.slot,
      action: {
        kind: 'ability',
        entityId: event.entityId,
        target: { ...event.target },
        abilityId: ability.id,
      },
    };
  }

  return {
    id: `context:entity:${event.entityId}:${event.action}`,
    label: event.action === 'attack' ? 'Attack' : event.action === 'chop' ? 'Chop' : 'Mine',
    source: 'entity',
    entityName: state.entities[event.entityId]?.name ?? 'Target',
    action: {
      kind: event.action,
      entityId: event.entityId,
      target: { ...event.target },
    },
  };
}

function actionAriaLabel(action: ContextActionOption): string {
  if (action.disabledReason) return `${action.label}, ${action.disabledReason}`;
  if (action.progress) return `${action.label} ${action.progress.current} of ${action.progress.required}`;
  return `${action.label} ${action.source === 'ability' ? 'against' : 'at'} ${action.entityName}`;
}

export function calculateHandMetrics(availableWidth: number, count: number): HandMetrics {
  if (count <= 0) {
    const cardHeight = MAX_CARD_WIDTH * CARD_ASPECT_HEIGHT;
    return {
      cardWidth: MAX_CARD_WIDTH,
      cardHeight,
      step: MAX_CARD_WIDTH,
      angleStep: 0,
      tuckDepth: cardHeight * CARD_TUCK_RATIO,
    };
  }
  const usableWidth = Math.max(220, availableWidth || 560) - 20;
  const cardWidth = Math.max(
    MIN_CARD_WIDTH,
    Math.min(MAX_CARD_WIDTH, usableWidth / (count - (count - 1) * HAND_OVERLAP)),
  );
  const cardHeight = cardWidth * CARD_ASPECT_HEIGHT;
  const angleStep = Math.min(8, Math.max(2.6, 24 / count));
  return {
    cardWidth,
    cardHeight,
    step: cardWidth * (1 - HAND_OVERLAP),
    angleStep,
    tuckDepth: cardHeight * CARD_TUCK_RATIO,
  };
}

function parsePositionKey(key: string): Position | undefined {
  const [x, y] = key.split(',').map(Number);
  return Number.isInteger(x) && Number.isInteger(y) ? { x, y } : undefined;
}
