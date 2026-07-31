import { Axe, Pickaxe, Sparkles, Sword } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, ReactElement } from 'react';
import { abilities } from '../content/abilities';
import { gameSession } from '../game/session';
import { availableContextActionsAt, contextActionCardKey, contextualActionTargets, positionKey } from '../sim';
import type { ContextActionOption, GameState, Position } from '../sim';

interface ContextActionHandProps {
  state: GameState;
  hidden?: boolean;
}

interface HandMetrics {
  cardWidth: number;
  step: number;
  angleStep: number;
}

const MIN_CARD_WIDTH = 72;
const MAX_CARD_WIDTH = 132;
const HAND_OVERLAP = 0.48;

export function ContextActionHand({ state, hidden = false }: ContextActionHandProps): ReactElement | null {
  const handRef = useRef<HTMLDivElement>(null);
  const [availableWidth, setAvailableWidth] = useState(0);
  const [focusedTargetKey, setFocusedTargetKey] = useState<string>();
  const [activatingId, setActivatingId] = useState<string>();
  const [playingAction, setPlayingAction] = useState<ContextActionOption>();
  const seenCardKeysRef = useRef(new Set<string>());

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
    const element = handRef.current;
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
  }, []);

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
    if (!playingAction) return;
    const timeout = window.setTimeout(() => {
      setPlayingAction(undefined);
      setActivatingId(undefined);
    }, 460);
    return () => window.clearTimeout(timeout);
  }, [playingAction]);

  const displayedActions = playingAction && !actions.some((action) => action.id === playingAction.id)
    ? [...actions, playingAction]
    : actions;

  if (hidden || displayedActions.length === 0) return null;

  const displayedPlayingId = playingAction?.id ?? activatingId;

  return (
    <div
      ref={handRef}
      className="context-action-hand"
      data-testid="context-action-hand"
      aria-label="Available actions"
    >
      <div className="context-action-hand__cards" style={{ height: `${metrics.cardWidth * 1.33 + 42}px` }}>
        {displayedActions.map((action, index) => (
          <ContextActionCard
            action={action}
            index={index}
            count={displayedActions.length}
            metrics={metrics}
            entering={enteringCardKeys.has(contextActionCardKey(action))}
            activating={displayedPlayingId === action.id}
            playing={playingAction?.id === action.id}
            key={contextActionCardKey(action)}
            onActivate={() => {
              if (action.disabledReason) return;
              setPlayingAction(action);
              setActivatingId(action.id);
              gameSession.performAction(action.action);
            }}
          />
        ))}
      </div>
    </div>
  );
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
  onActivate: () => void;
}): ReactElement {
  const centeredIndex = index - (count - 1) / 2;
  const isDisabled = Boolean(action.disabledReason);
  const cardStyle = {
    '--action-width': `${metrics.cardWidth}px`,
    '--action-x': `${centeredIndex * metrics.step}px`,
    '--action-y': `${Math.abs(centeredIndex) * 7}px`,
    '--action-angle': `${centeredIndex * metrics.angleStep}deg`,
    '--action-delay': `${index * 38}ms`,
    zIndex: 20 + index,
  } as CSSProperties;

  return (
    <button
      className={`context-action-card${entering ? ' is-entering' : ''}${isDisabled ? ' is-disabled' : ''}${activating ? ' is-activating' : ''}${playing ? ' is-playing' : ''}`}
      type="button"
      style={cardStyle}
      disabled={isDisabled || playing}
      aria-label={actionAriaLabel(action)}
      aria-disabled={isDisabled}
      data-testid={`context-action-card-${action.id.replaceAll(':', '-')}`}
      onClick={onActivate}
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

function actionAriaLabel(action: ContextActionOption): string {
  if (action.disabledReason) return `${action.label}, ${action.disabledReason}`;
  if (action.progress) return `${action.label} ${action.progress.current} of ${action.progress.required}`;
  return `${action.label} ${action.source === 'ability' ? 'against' : 'at'} ${action.entityName}`;
}

function calculateHandMetrics(availableWidth: number, count: number): HandMetrics {
  if (count <= 0) return { cardWidth: MAX_CARD_WIDTH, step: MAX_CARD_WIDTH, angleStep: 0 };
  const usableWidth = Math.max(220, availableWidth || 560) - 20;
  const cardWidth = Math.max(
    MIN_CARD_WIDTH,
    Math.min(MAX_CARD_WIDTH, usableWidth / (count - (count - 1) * HAND_OVERLAP)),
  );
  const angleStep = Math.min(8, Math.max(2.6, 24 / count));
  return {
    cardWidth,
    step: cardWidth * (1 - HAND_OVERLAP),
    angleStep,
  };
}

function parsePositionKey(key: string): Position | undefined {
  const [x, y] = key.split(',').map(Number);
  return Number.isInteger(x) && Number.isInteger(y) ? { x, y } : undefined;
}
