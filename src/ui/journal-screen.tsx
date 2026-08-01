import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import {
  ArrowLeft,
  BookOpen,
  Check,
  ChevronDown,
  Compass,
  Map as MapIcon,
  PackageOpen,
  Pin,
  Sparkles,
} from 'lucide-react';
import { journalDefinitionsForScope } from '../content/journal';
import type { JournalEntryDefinition } from '../content/journal';
import { itemDefinition } from '../content/items';
import { journalEntryDefinitionsForState } from '../sim';
import type { GameState, JournalEntryRuntime, ProfileJournalState } from '../sim';
import { TorchButton, TorchTabsContent, TorchTabsList, TorchTabsRoot, TorchTabsTab } from './primitives';
import { useGameRuntime } from './runtime-context';

type JournalSection = 'overview' | 'quests' | 'mysteries' | 'guide';

interface JournalScreenProps {
  state: GameState;
  profile: ProfileJournalState;
  onOpenMap: () => void;
}

function statusLabel(status: JournalEntryRuntime['status']): string {
  switch (status) {
    case 'reward-ready':
      return 'Reward ready';
    case 'claimed':
      return 'Claimed';
    case 'locked':
      return 'Locked';
    default:
      return 'In progress';
  }
}

function rewardLabel(definition: JournalEntryDefinition): string {
  return definition.rewards
    .map((reward) => {
      if (reward.kind === 'item') return `${reward.quantity} ${itemDefinition(reward.itemId)?.name ?? reward.itemId}`;
      return `Unlock: ${reward.unlockId.replace(/^guide\./, '').replaceAll('-', ' ')}`;
    })
    .join(' · ');
}

export function JournalScreen({ state, profile, onOpenMap }: JournalScreenProps): ReactElement {
  const gameRuntime = useGameRuntime();
  const [section, setSection] = useState<JournalSection>('overview');
  const [selectedId, setSelectedId] = useState<string>();
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const detailFocusFrameRef = useRef<number | undefined>(undefined);
  const backFocusFrameRef = useRef<number | undefined>(undefined);
  const tabScrollInitializedRef = useRef(false);

  const allDefinitions = useMemo(
    () => [...journalEntryDefinitionsForState('world', state), ...journalEntryDefinitionsForState('profile', profile)],
    [profile, state],
  );
  const visibleDefinitions = useMemo(() => {
    const definitions =
      section === 'guide'
        ? journalDefinitionsForScope('profile')
        : section === 'quests'
          ? journalDefinitionsForScope('world').filter((definition) => definition.kind === 'quest')
          : section === 'mysteries'
            ? journalDefinitionsForScope('world').filter((definition) => definition.kind === 'mystery')
            : allDefinitions;
    return definitions.filter((definition) => {
      const runtime =
        definition.scope === 'world' ? state.journal.entries[definition.id] : profile.entries[definition.id];
      return runtime?.status !== 'locked';
    });
  }, [allDefinitions, profile, section, state]);
  const selectedDefinition =
    visibleDefinitions.find((definition) => definition.id === selectedId) ?? visibleDefinitions[0];
  const selectedEntryId = selectedDefinition?.id;
  const selectedScope = selectedDefinition?.scope;

  useEffect(() => {
    if (selectedDefinition && selectedDefinition.id !== selectedId) setSelectedId(selectedDefinition.id);
  }, [selectedDefinition, selectedId]);

  useEffect(() => {
    if (selectedEntryId && selectedScope) gameRuntime.markJournalEntrySeen(selectedScope, selectedEntryId);
  }, [gameRuntime, selectedEntryId, selectedScope]);

  useEffect(() => {
    if (!tabScrollInitializedRef.current) {
      tabScrollInitializedRef.current = true;
      return;
    }
    const frame = window.requestAnimationFrame(() => {
      document
        .querySelector<HTMLElement>('.journal-tabs [role="tab"][aria-selected="true"]')
        ?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [section]);

  useEffect(() => {
    if (!mobileDetailOpen) return;
    detailFocusFrameRef.current = window.requestAnimationFrame(() =>
      document.getElementById('journal-detail-title')?.focus({ preventScroll: true }),
    );
    return () => {
      if (detailFocusFrameRef.current !== undefined) window.cancelAnimationFrame(detailFocusFrameRef.current);
    };
  }, [mobileDetailOpen, selectedEntryId]);

  useEffect(
    () => () => {
      if (detailFocusFrameRef.current !== undefined) window.cancelAnimationFrame(detailFocusFrameRef.current);
      if (backFocusFrameRef.current !== undefined) window.cancelAnimationFrame(backFocusFrameRef.current);
    },
    [],
  );

  const runtimeFor = (definition: JournalEntryDefinition): JournalEntryRuntime =>
    definition.scope === 'world' ? state.journal.entries[definition.id] : profile.entries[definition.id];

  const chooseEntry = (definition: JournalEntryDefinition): void => {
    setSelectedId(definition.id);
    setMobileDetailOpen(true);
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(definition.id)) next.delete(definition.id);
      else next.add(definition.id);
      return next;
    });
  };

  const trackEntry = (definition: JournalEntryDefinition): void => {
    gameRuntime.setJournalFocus(definition.id);
    if (definition.location) gameRuntime.setWaypoint(definition.id, definition.location);
  };

  return (
    <div className="journal-screen" data-testid="journal-screen">
      <TorchTabsRoot
        value={section}
        onValueChange={(value) => {
          setSection(value as JournalSection);
          setMobileDetailOpen(false);
        }}
      >
        <TorchTabsList className="journal-tabs" aria-label="Journal sections">
          <TorchTabsTab value="overview" data-testid="journal-tab-overview">
            Overview
          </TorchTabsTab>
          <TorchTabsTab value="quests" data-testid="journal-tab-quests">
            Quests
          </TorchTabsTab>
          <TorchTabsTab value="mysteries" data-testid="journal-tab-mysteries">
            Mysteries
          </TorchTabsTab>
          <TorchTabsTab value="guide" data-testid="journal-tab-guide">
            Guide
          </TorchTabsTab>
        </TorchTabsList>
        {(['overview', 'quests', 'mysteries', 'guide'] as const).map((tab) => (
          <TorchTabsContent value={tab} key={tab} className="journal-tab-content">
            <div className={`journal-body${mobileDetailOpen ? ' is-detail-open' : ''}`}>
              <div className="journal-list" aria-label={`${tab} Journal entries`}>
                {visibleDefinitions.length === 0 ? <p className="journal-empty">No entries yet.</p> : null}
                {visibleDefinitions.map((definition) => {
                  const runtime = runtimeFor(definition);
                  const expanded = expandedIds.has(definition.id);
                  const entryPanelId = `journal-entry-panel-${definition.id.replaceAll(/[^a-zA-Z0-9_-]/g, '-')}`;
                  const completeCount = definition.objectives.filter(
                    (objective) => (runtime.progress[objective.id] ?? 0) >= objective.target,
                  ).length;
                  return (
                    <div
                      className={`journal-entry ${selectedDefinition?.id === definition.id ? 'is-selected' : ''}`}
                      key={definition.id}
                    >
                      <TorchButton
                        variant="ghost"
                        className="journal-entry-header"
                        type="button"
                        aria-expanded={expanded}
                        aria-controls={entryPanelId}
                        aria-label={`${definition.title}, ${statusLabel(runtime.status)}, ${completeCount} of ${definition.objectives.length} objectives complete`}
                        data-testid={`journal-entry-${definition.id}`}
                        onClick={() => chooseEntry(definition)}
                      >
                        <span className="journal-entry-icon" aria-hidden="true">
                          {definition.kind === 'quest' ? (
                            <Compass />
                          ) : definition.kind === 'mystery' ? (
                            <Sparkles />
                          ) : (
                            <Check />
                          )}
                        </span>
                        <span className="journal-entry-heading">
                          <span className="journal-entry-title">{definition.title}</span>
                        </span>
                        <span className={`journal-entry-status is-${runtime.status}`}>
                          {statusLabel(runtime.status)}
                        </span>
                        <span className="journal-entry-count">
                          {completeCount}/{definition.objectives.length}
                        </span>
                        <ChevronDown className="journal-entry-chevron" aria-hidden="true" />
                      </TorchButton>
                      <div className="journal-entry-preview" id={entryPanelId} hidden={!expanded}>
                        <p>{definition.description}</p>
                        {definition.objectives.slice(0, 3).map((objective) => (
                          <span className="journal-objective-chip" key={objective.id}>
                            {(runtime.progress[objective.id] ?? 0) >= objective.target ? (
                              <Check aria-hidden="true" />
                            ) : null}
                            {objective.label} {runtime.progress[objective.id] ?? 0}/{objective.target}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              {selectedDefinition ? (
                <JournalDetail
                  definition={selectedDefinition}
                  runtime={runtimeFor(selectedDefinition)}
                  onBack={() => {
                    setMobileDetailOpen(false);
                    if (backFocusFrameRef.current !== undefined) window.cancelAnimationFrame(backFocusFrameRef.current);
                    backFocusFrameRef.current = window.requestAnimationFrame(() =>
                      document
                        .querySelector<HTMLElement>(`[data-testid="journal-entry-${selectedDefinition.id}"]`)
                        ?.focus({ preventScroll: true }),
                    );
                  }}
                  onTrack={() => trackEntry(selectedDefinition)}
                  onOpenMap={() => {
                    trackEntry(selectedDefinition);
                    onOpenMap();
                  }}
                />
              ) : (
                <div className="journal-detail journal-detail-empty">
                  <BookOpen aria-hidden="true" />
                  <p>Select an entry to see its details.</p>
                </div>
              )}
            </div>
          </TorchTabsContent>
        ))}
      </TorchTabsRoot>
    </div>
  );
}

function JournalDetail({
  definition,
  runtime,
  onBack,
  onTrack,
  onOpenMap,
}: {
  definition: JournalEntryDefinition;
  runtime: JournalEntryRuntime;
  onBack: () => void;
  onTrack: () => void;
  onOpenMap: () => void;
}): ReactElement {
  const gameRuntime = useGameRuntime();
  const rewardReady = runtime.status === 'reward-ready';
  return (
    <article className="journal-detail" aria-labelledby="journal-detail-title">
      <TorchButton
        className="journal-detail-back"
        variant="ghost"
        type="button"
        data-testid="journal-detail-back"
        onClick={onBack}
      >
        <ArrowLeft aria-hidden="true" /> Back to Journal
      </TorchButton>
      <div className="journal-detail-kicker">
        {definition.category} · {statusLabel(runtime.status)}
      </div>
      <h2 id="journal-detail-title" tabIndex={-1}>
        {definition.title}
      </h2>
      <p className="journal-detail-description">{definition.description}</p>
      <div className="journal-objectives">
        <h3>Objectives</h3>
        {definition.objectives.map((objective) => {
          const current = runtime.progress[objective.id] ?? 0;
          const complete = current >= objective.target;
          return (
            <div className={`journal-objective ${complete ? 'is-complete' : ''}`} key={objective.id}>
              <span className="journal-objective-check" aria-hidden="true">
                {complete ? <Check /> : null}
              </span>
              <span>{objective.label}</span>
              <span className="journal-objective-progress">
                {Math.min(current, objective.target)}/{objective.target}
              </span>
            </div>
          );
        })}
      </div>
      {definition.clues?.length ? (
        <div className="journal-clues">
          <h3>Clues</h3>
          {definition.clues
            .filter((clue) => runtime.discoveredClueIds[clue.id])
            .map((clue) => (
              <div className="journal-clue" key={clue.id}>
                <strong>{clue.title}</strong>
                <p>{clue.body}</p>
              </div>
            ))}
        </div>
      ) : null}
      <div className="journal-reward">
        <PackageOpen aria-hidden="true" />
        <span>
          <strong>Reward</strong>
          <small>{rewardLabel(definition)}</small>
        </span>
      </div>
      <div className="journal-detail-actions">
        {definition.location ? (
          <TorchButton variant="outline" type="button" onClick={onTrack}>
            <Pin aria-hidden="true" /> Track
          </TorchButton>
        ) : null}
        {definition.location ? (
          <TorchButton variant="outline" type="button" onClick={onOpenMap}>
            <MapIcon aria-hidden="true" /> Show on Map
          </TorchButton>
        ) : null}
        {rewardReady ? (
          <TorchButton
            type="button"
            data-testid={`journal-claim-${definition.id}`}
            onClick={() => {
              if (definition.scope === 'world') gameRuntime.claimJournalReward(definition.id);
              else gameRuntime.claimProfileJournalReward(definition.id);
            }}
          >
            Claim reward
          </TorchButton>
        ) : null}
      </div>
    </article>
  );
}
