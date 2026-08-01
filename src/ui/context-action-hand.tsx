import { Axe, Pickaxe, Sparkles, Sword } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactElement } from 'react';
import { createPortal } from 'react-dom';
import { abilities } from '../content/abilities';
import { availableContextActionsAt, contextActionCardKey, contextualActionTargets, positionKey } from '../sim';
import type { ContextActionOption, GameState, Position, SimEvent } from '../sim';
import { setCardPlayPlaybackActive, useCardPlayLabState } from '../dev/card-play-lab-store';
import {
  animationDurationForPhase,
  cardAnimationPresetForId,
  DEFAULT_CARD_ANIMATION_PRESET,
  snapshotForCardAnimation,
} from './card-animation';
import type { CardAnimationPreset, CardAnimationPresetId, CardAnimationSnapshot, CardRect } from './card-animation';
import { presentationGate } from '../game/presentation-gate';
import { useGameRuntime } from './runtime-context';

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

const MIN_CARD_WIDTH = 72;
const MAX_CARD_WIDTH = 132;
const CARD_ASPECT_HEIGHT = 4 / 3;
const CARD_TUCK_RATIO = 0.1;
// Keep the keyed slot mounted through the final compositor frame. The card is
// already visually dissolved and non-interactive by this point, but retaining
// the node prevents slow input delivery from racing its cleanup.
const PLAYBACK_SETTLE_MS = 240;

interface ActivePlayback {
  cardKey: string;
  action: ContextActionOption;
  origin: Position;
  originalIndex: number;
  token: number;
}

export function ContextActionHand({ state, events, hidden = false }: ContextActionHandProps): ReactElement | null {
  const runtime = useGameRuntime();
  const handRef = useRef<HTMLDivElement>(null);
  const [handElement, setHandElement] = useState<HTMLDivElement | null>(null);
  const [availableWidth, setAvailableWidth] = useState(0);
  const [focusedTargetKey, setFocusedTargetKey] = useState<string | undefined>(undefined);
  const [activatingId, setActivatingId] = useState<string | undefined>(undefined);
  const [playingAction, setPlayingAction] = useState<ContextActionOption | undefined>(undefined);
  const [playingCardKey, setPlayingCardKey] = useState<string | undefined>(undefined);
  const [playingPresetId, setPlayingPresetId] = useState<CardAnimationPresetId | undefined>(undefined);
  const [playingToken, setPlayingToken] = useState<number | undefined>(undefined);
  const [presentationBusy, setPresentationBusy] = useState(() => presentationGate.busy);
  const seenCardKeysRef = useRef(new Set<string>());
  const knownActionsRef = useRef(new Map<string, ContextActionOption>());
  const sourceRectsRef = useRef(new Map<string, CardRect>());
  const cardIndexesRef = useRef(new Map<string, number>());
  const pendingSnapshotsRef = useRef(new Map<string, CardAnimationSnapshot>());
  const lastPlaybackSignatureRef = useRef<string | undefined>(undefined);
  const activePlaybackRef = useRef<ActivePlayback | undefined>(undefined);
  const nextPlaybackTokenRef = useRef(0);
  const labState = useCardPlayLabState();
  const activePresetId = import.meta.env.DEV ? labState.activePreset : DEFAULT_CARD_ANIMATION_PRESET;
  const handCallbackRef = useCallback((element: HTMLDivElement | null): void => {
    handRef.current = element;
    setHandElement(element);
  }, []);

  useEffect(() => presentationGate.subscribe(setPresentationBusy), []);

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

  const actions = useMemo(() => availableContextActionsAt(state, focusedTarget), [focusedTarget, state]);
  const heroPositionKey = positionKey(state.hero.position);
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
    actions.forEach((action, index) => cardIndexesRef.current.set(contextActionCardKey(action), index));
  }, [actions]);

  const beginPlayback = useCallback(
    (snapshot: CardAnimationSnapshot, presetId: CardAnimationPresetId, originalIndex: number): boolean => {
      const current = activePlaybackRef.current;
      if (current) return false;

      const token = ++nextPlaybackTokenRef.current;
      activePlaybackRef.current = {
        cardKey: snapshot.cardKey,
        action: snapshot.action,
        origin: { ...snapshot.cameraPosition },
        originalIndex,
        token,
      };
      setPlayingAction(snapshot.action);
      setPlayingCardKey(snapshot.cardKey);
      setPlayingPresetId(presetId);
      setPlayingToken(token);
      setActivatingId(snapshot.action.id);
      if (import.meta.env.DEV) setCardPlayPlaybackActive(true);
      return true;
    },
    [],
  );

  useEffect(() => {
    const resolvedEvent = [...events]
      .reverse()
      .find(
        (event): event is Extract<SimEvent, { type: 'action-resolved' | 'ability-used' }> =>
          event.type === 'action-resolved' || event.type === 'ability-used',
      );
    if (!resolvedEvent) return;

    const eventSignature = [
      state.turn,
      resolvedEvent.type,
      resolvedEvent.entityId,
      resolvedEvent.type === 'ability-used' ? resolvedEvent.abilityId : resolvedEvent.action,
      resolvedEvent.target.x,
      resolvedEvent.target.y,
      resolvedEvent.entityName,
    ].join(':');
    if (lastPlaybackSignatureRef.current === eventSignature) return;
    lastPlaybackSignatureRef.current = eventSignature;

    const cardKey =
      resolvedEvent.type === 'ability-used'
        ? `ability:${resolvedEvent.abilityId}`
        : resolvedEvent.action === 'ability'
          ? `ability:${resolvedEvent.abilityId ?? ''}`
          : `entity:${resolvedEvent.action}`;
    const pendingSnapshotCandidate = pendingSnapshotsRef.current.get(cardKey);
    const pendingSnapshot =
      pendingSnapshotCandidate?.action.action.entityId === resolvedEvent.entityId
        ? pendingSnapshotCandidate
        : undefined;
    if (!pendingSnapshot && pendingSnapshotCandidate) pendingSnapshotsRef.current.delete(cardKey);
    const rememberedAction = knownActionsRef.current.get(cardKey);
    const rememberedOrEventAction =
      pendingSnapshot?.action ??
      (rememberedAction?.action.entityId === resolvedEvent.entityId
        ? rememberedAction
        : resolvedEvent.type === 'ability-used'
          ? actionForAbilityUsedEvent(resolvedEvent)
          : actionForResolvedEvent(resolvedEvent));
    if (!rememberedOrEventAction) return;

    // Keep the frozen card label/name from the mounted card. The simulation
    // event may describe a generic target after the world mutation.
    const action: ContextActionOption = {
      ...rememberedOrEventAction,
      action: { ...rememberedOrEventAction.action, target: { ...resolvedEvent.target } },
    };
    const snapshot = pendingSnapshot
      ? {
          ...pendingSnapshot,
          action,
          target: { ...resolvedEvent.target },
        }
      : snapshotForCardAnimation(
          action,
          cardKey,
          state.hero.position,
          sourceRectsRef.current.get(cardKey),
          activePresetId,
        );
    pendingSnapshotsRef.current.delete(cardKey);
    const originalIndex = cardIndexesRef.current.get(cardKey) ?? actions.length;
    beginPlayback(snapshot, snapshot.presetId, originalIndex);
  }, [actions, activePresetId, beginPlayback, events, state]);

  const finishPlayback = useCallback((token: number): void => {
    const active = activePlaybackRef.current;
    if (!active || active.token !== token) return;
    activePlaybackRef.current = undefined;
    if (import.meta.env.DEV) {
      setCardPlayPlaybackActive(false);
    }
    setPlayingAction(undefined);
    setPlayingCardKey(undefined);
    setPlayingPresetId(undefined);
    setPlayingToken(undefined);
    setActivatingId(undefined);
  }, []);

  const cancelPlayback = useCallback((): void => {
    const active = activePlaybackRef.current;
    if (!active) return;
    activePlaybackRef.current = undefined;
    if (import.meta.env.DEV) setCardPlayPlaybackActive(false);
    setPlayingAction(undefined);
    setPlayingCardKey(undefined);
    setPlayingPresetId(undefined);
    setPlayingToken(undefined);
    setActivatingId(undefined);
  }, []);

  useEffect(() => {
    if (!hidden) return;
    cancelPlayback();
    pendingSnapshotsRef.current.clear();
  }, [cancelPlayback, hidden]);

  useEffect(() => {
    const active = activePlaybackRef.current;
    if (!active) return;
    if (positionKey(active.origin) === heroPositionKey) return;
    cancelPlayback();
  }, [cancelPlayback, heroPositionKey]);

  const activeOriginalIndex = activePlaybackRef.current?.originalIndex;
  const displayedActions = actionsDuringCardPlayback(actions, playingAction, playingCardKey, activeOriginalIndex);
  const activePreset = cardAnimationPresetForId(activePresetId);
  const metrics = useMemo(
    () => calculateHandMetrics(availableWidth, displayedActions.length, activePreset),
    [activePreset, availableWidth, displayedActions.length],
  );
  const displayedPlayingId = playingAction?.id ?? activatingId;
  const handLayer =
    !hidden && displayedActions.length > 0 ? (
      <div
        ref={handCallbackRef}
        className="context-action-hand"
        data-testid="context-action-hand"
        aria-label="Available actions"
      >
        <div className="context-action-hand__cards" style={{ height: `${metrics.cardHeight + 42}px` }}>
          {displayedActions.map((action, index) => {
            const cardKey = contextActionCardKey(action);
            const isPlaying = playingCardKey === cardKey && playingToken !== undefined;
            return (
              <ContextActionCard
                action={action}
                index={index}
                count={displayedActions.length}
                metrics={metrics}
                animationPreset={activePreset}
                entering={enteringCardKeys.has(cardKey)}
                activating={displayedPlayingId === action.id}
                playing={isPlaying}
                presentationBusy={presentationBusy}
                playPresetId={isPlaying ? playingPresetId : undefined}
                playToken={isPlaying ? playingToken : undefined}
                onPlayComplete={finishPlayback}
                key={cardKey}
                onActivate={(activatedAction, rect) => {
                  if (activatedAction.disabledReason || activePlaybackRef.current || presentationBusy) return;
                  const activatedCardKey = contextActionCardKey(activatedAction);
                  const snapshot = snapshotForCardAnimation(
                    activatedAction,
                    activatedCardKey,
                    state.hero.position,
                    rect,
                    activePresetId,
                  );
                  sourceRectsRef.current.set(activatedCardKey, rect);
                  pendingSnapshotsRef.current.set(activatedCardKey, snapshot);
                  beginPlayback(snapshot, activePresetId, index);
                  const result = runtime.performAction(activatedAction.action);
                  if (!result.accepted) {
                    pendingSnapshotsRef.current.delete(activatedCardKey);
                    cancelPlayback();
                  }
                }}
              />
            );
          })}
        </div>
      </div>
    ) : null;

  if (!handLayer) return null;
  const transfer =
    playingAction && playingCardKey && playingPresetId
      ? createPortal(
          <CardTransferOverlay
            action={playingAction}
            sourceRect={sourceRectsRef.current.get(playingCardKey)}
            preset={cardAnimationPresetForId(playingPresetId)}
          />,
          document.body,
        )
      : null;
  return (
    <>
      {handLayer}
      {transfer}
    </>
  );
}

export function actionsDuringCardPlayback(
  actions: ContextActionOption[],
  playingAction: ContextActionOption | undefined,
  replacingCardKey: string | undefined,
  originalIndex?: number,
): ContextActionOption[] {
  if (!playingAction || !replacingCardKey) return actions;
  const currentActions = actions.filter((action) => contextActionCardKey(action) !== replacingCardKey);
  const replacementIndex = actions.findIndex((action) => contextActionCardKey(action) === replacingCardKey);
  // The simulation can remove the target immediately. Retain the same React
  // key in the hand until the preset timer reports completion, so the mounted
  // card owns the entire transition and no second hand card is created. When the same
  // key is still present, prefer the frozen slot index so target retargeting
  // cannot silently move the card during its play.
  const insertionIndex = Math.max(
    0,
    Math.min(
      originalIndex ?? (replacementIndex >= 0 ? replacementIndex : currentActions.length),
      currentActions.length,
    ),
  );
  return [...currentActions.slice(0, insertionIndex), playingAction, ...currentActions.slice(insertionIndex)];
}

function ContextActionCard({
  action,
  index,
  count,
  metrics,
  animationPreset,
  entering,
  activating,
  playing,
  presentationBusy,
  playPresetId,
  playToken,
  onPlayComplete,
  onActivate,
}: {
  action: ContextActionOption;
  index: number;
  count: number;
  metrics: HandMetrics;
  animationPreset: CardAnimationPreset;
  entering: boolean;
  activating: boolean;
  playing: boolean;
  presentationBusy: boolean;
  playPresetId?: CardAnimationPresetId;
  playToken?: number;
  onPlayComplete: (token: number) => void;
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

  const slotStyle = {
    '--action-width': `${metrics.cardWidth}px`,
    '--action-x': `${centeredIndex * metrics.step}px`,
    '--action-y': `${Math.abs(centeredIndex) * animationPreset.layout.verticalStep}px`,
    '--action-angle': `${centeredIndex * metrics.angleStep}deg`,
    '--action-delay': `${index * animationPreset.timing.entryStaggerMs}ms`,
    '--action-drag-x': `${dragOffset.x}px`,
    '--action-drag-y': `${dragOffset.y}px`,
    '--card-hover-lift': `${animationPreset.layout.hoverLift}px`,
    '--card-hover-rotation': `${centeredIndex * animationPreset.layout.hoverRotationStep}deg`,
    '--card-hover-scale': `${animationPreset.layout.hoverScale}`,
    '--card-entry-duration': `${animationPreset.timing.entryMs}ms`,
    '--card-reflow-duration': `${animationPreset.timing.reflowMs}ms`,
    '--card-play-duration': `${animationPreset.timing.playMs}ms`,
    zIndex: 20 + index,
  } as CSSProperties;

  const preset = playPresetId ? cardAnimationPresetForId(playPresetId) : animationPreset;
  const reduced = prefersReducedMotion();

  useEffect(() => {
    if (!playing || playToken === undefined) return;
    const durationMs = animationDurationForPhase(preset, 'play', reduced);
    const timeout = window.setTimeout(() => onPlayComplete(playToken), durationMs + 60 + PLAYBACK_SETTLE_MS);
    return () => window.clearTimeout(timeout);
  }, [onPlayComplete, playToken, playing, preset, reduced]);

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
    if (isDisabled || playing || presentationBusy) return;
    const rect = element.getBoundingClientRect();
    onActivate(action, { left: rect.left, top: rect.top, width: rect.width, height: rect.height });
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLButtonElement>): void => {
    if (isDisabled || playing || presentationBusy || event.button !== 0) return;
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
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    if (draggingRef.current && playArmedRef.current) activate(event.currentTarget);
    resetGesture();
  };

  const handlePointerCancel = (event: ReactPointerEvent<HTMLButtonElement>): void => {
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    resetGesture();
  };

  const cardKey = contextActionCardKey(action);
  const targetLabel = action.entityName;
  return (
    <div
      className={`context-action-card-slot${entering ? ' is-entering' : ''}${isDisabled ? ' is-disabled' : ''}${activating ? ' is-activating' : ''}${playing ? ' is-playing' : ''}${pointerDown ? ' is-pressed' : ''}${dragging ? ' is-dragging' : ''}${playArmed ? ' is-play-armed' : ''}`}
      style={slotStyle}
      data-card-key={cardKey}
      data-card-play-state={playing ? 'playing' : 'idle'}
      data-card-animation-preset={animationPreset.id}
      data-card-animation-phase={playing ? 'play' : entering ? 'draw' : activating ? 'hover' : 'idle'}
    >
      <button
        className={`context-action-card${isDisabled ? ' is-disabled' : ''}${activating ? ' is-activating' : ''}${playing ? ' is-playing' : ''}${pointerDown ? ' is-pressed' : ''}${dragging ? ' is-dragging' : ''}${playArmed ? ' is-play-armed' : ''}`}
        type="button"
        disabled={isDisabled || playing || presentationBusy}
        aria-label={playing ? `${actionAriaLabel(action)}, resolving` : actionAriaLabel(action)}
        aria-disabled={isDisabled || playing || presentationBusy}
        aria-busy={playing}
        data-card-play-preset={animationPreset.id}
        data-card-play-state={playing ? 'playing' : 'idle'}
        data-card-play-key={cardKey}
        data-card-animation-preset={animationPreset.id}
        data-card-animation-phase={playing ? 'play' : entering ? 'draw' : activating ? 'hover' : 'idle'}
        data-card-animation-key={cardKey}
        data-card-key={cardKey}
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
          <small>{action.source === 'ability' ? `${action.slot} · ${targetLabel}` : targetLabel}</small>
        </span>
        {action.progress ? (
          <span
            className="context-action-card__progress"
            aria-label={`${action.progress.current} of ${action.progress.required}`}
          >
            {action.progress.current}/{action.progress.required}
          </span>
        ) : null}
        {action.disabledReason ? (
          <span className="context-action-card__cooldown">{action.cooldownRemaining}</span>
        ) : null}
        {playing ? (
          <span className="context-action-card__status" role="status">
            Resolving…
          </span>
        ) : null}
      </button>
    </div>
  );
}

function CardArtwork({ action }: { action: ContextActionOption }): ReactElement {
  if (action.source === 'ability') {
    const ability = abilities.find((candidate) => candidate.id === action.abilityId);
    if (ability) return <img src={ability.assetPath} alt="" loading="eager" />;
    return <Sparkles aria-hidden="true" />;
  }
  if (action.action.kind === 'chop') return <Axe aria-hidden="true" />;
  if (action.action.kind === 'mine') return <Pickaxe aria-hidden="true" />;
  return <Sword aria-hidden="true" />;
}

function actionForAbilityUsedEvent(
  event: Extract<SimEvent, { type: 'ability-used' }>,
): ContextActionOption | undefined {
  const ability = abilities.find((candidate) => candidate.id === event.abilityId);
  if (!ability) return undefined;
  return {
    id: `context:ability:${ability.id}`,
    label: ability.name,
    source: 'ability',
    entityName: event.entityName,
    abilityId: ability.id,
    slot: ability.slot,
    action: { kind: 'ability', entityId: event.entityId, target: { ...event.target }, abilityId: ability.id },
  };
}

function actionForResolvedEvent(
  event: Extract<SimEvent, { type: 'action-resolved' }>,
): ContextActionOption | undefined {
  if (event.action === 'ability') return undefined;
  return {
    id: `context:entity:${event.entityId}:${event.action}`,
    label: event.action === 'attack' ? 'Attack' : event.action === 'chop' ? 'Chop' : 'Mine',
    source: 'entity',
    entityName: event.entityName,
    action: { kind: event.action, entityId: event.entityId, target: { ...event.target } },
  };
}

function actionAriaLabel(action: ContextActionOption): string {
  if (action.disabledReason) return `${action.label}, ${action.disabledReason}`;
  if (action.progress) return `${action.label} ${action.progress.current} of ${action.progress.required}`;
  return `${action.label} ${action.source === 'ability' ? 'against' : 'at'} ${action.entityName}`;
}

export function calculateHandMetrics(
  availableWidth: number,
  count: number,
  preset: CardAnimationPreset = cardAnimationPresetForId(DEFAULT_CARD_ANIMATION_PRESET),
): HandMetrics {
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
    Math.min(MAX_CARD_WIDTH, usableWidth / (count - (count - 1) * preset.layout.overlap)),
  );
  const cardHeight = cardWidth * CARD_ASPECT_HEIGHT;
  const angleStep = Math.min(
    preset.layout.angleStep,
    Math.max(2.6, preset.layout.angleStep * (count <= 3 ? 1 : 3 / count)),
  );
  return {
    cardWidth,
    cardHeight,
    step: cardWidth * (1 - preset.layout.overlap),
    angleStep,
    tuckDepth: cardHeight * CARD_TUCK_RATIO,
  };
}

function CardTransferOverlay({
  action,
  sourceRect,
  preset,
}: {
  action: ContextActionOption;
  sourceRect?: CardRect;
  preset: CardAnimationPreset;
}): ReactElement | null {
  if (!sourceRect || preset.transfer.playMode !== 'travel') return null;

  const target = transferTargetRect(sourceRect);
  const style = {
    '--card-transfer-left': `${sourceRect.left}px`,
    '--card-transfer-top': `${sourceRect.top}px`,
    '--card-transfer-width': `${sourceRect.width}px`,
    '--card-transfer-height': `${sourceRect.height}px`,
    '--card-transfer-x': `${target.left - sourceRect.left}px`,
    '--card-transfer-y': `${target.top - sourceRect.top}px`,
    '--card-transfer-duration': `${preset.transfer.playTravelMs}ms`,
  } as CSSProperties;

  return (
    <div
      className="card-animation-transfer"
      style={style}
      data-testid="card-animation-transfer"
      data-card-animation-preset={preset.id}
      data-card-animation-phase="play"
      aria-hidden="true"
    >
      <div className="card-animation-transfer__card">
        <span className="context-action-card__art">
          <CardArtwork action={action} />
        </span>
        <span className="context-action-card__shade" />
        <span className="context-action-card__meta">
          <strong>{action.label}</strong>
          <small>{action.entityName}</small>
        </span>
      </div>
    </div>
  );
}

function transferTargetRect(sourceRect: CardRect): CardRect {
  const width = sourceRect.width;
  const height = sourceRect.height;
  const left = Math.max(12, Math.min(window.innerWidth - width - 12, window.innerWidth / 2 - width * 0.37));
  const top = Math.max(72, Math.min(window.innerHeight - height - 120, window.innerHeight * 0.3));
  return { left, top, width, height };
}

function prefersReducedMotion(): boolean {
  if (typeof document === 'undefined') return false;
  if (document.documentElement.dataset.reduceMotion === 'true') return true;
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
}

function parsePositionKey(key: string): Position | undefined {
  const [x, y] = key.split(',').map(Number);
  return Number.isInteger(x) && Number.isInteger(y) ? { x, y } : undefined;
}
