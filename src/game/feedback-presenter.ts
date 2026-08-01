import type { ActionBatch } from './session';
import type { Position } from '../sim';
import { ATTACK_MOTION } from './attack-motion';

type FeedbackKind = 'damage' | 'resource' | 'defeat';
type HomesteadResource = 'wood' | 'stone' | 'iron' | 'food' | 'herbs' | 'hide' | 'crystal' | 'gold';

export interface FeedbackRequest {
  id: string;
  kind: FeedbackKind;
  text: string;
  anchor: Position;
  iconKey?: `resource.homestead.${HomesteadResource}`;
  delayMs: number;
  announcement: string;
}

const resourceIconKeys: Record<HomesteadResource, `resource.homestead.${HomesteadResource}`> = {
  wood: 'resource.homestead.wood',
  stone: 'resource.homestead.stone',
  iron: 'resource.homestead.iron',
  food: 'resource.homestead.food',
  herbs: 'resource.homestead.herbs',
  hide: 'resource.homestead.hide',
  crystal: 'resource.homestead.crystal',
  gold: 'resource.homestead.gold',
};

function iconKeyForResource(resource: 'wood' | 'ore'): FeedbackRequest['iconKey'] {
  // Torch currently calls the mining resource “ore”; keep that domain name in
  // the announcement and use the closest authored Homestead material only for
  // the visual chip. Wood has an exact source match.
  return resource === 'wood' ? resourceIconKeys.wood : undefined;
}

export function feedbackRequestsForBatch(batch: ActionBatch): FeedbackRequest[] {
  const requests: FeedbackRequest[] = [];
  let sequence = 0;

  for (const event of batch.events) {
    if (event.type === 'attack-resolved' && event.amount > 0) {
      requests.push({
        id: `${batch.batchId}:attack:${event.attackId}`,
        kind: 'damage',
        text: `-${event.amount}`,
        anchor: { ...event.target.position },
        delayMs: ATTACK_MOTION.impactMs + sequence++ * 180,
        announcement: `${event.target.name} takes ${event.amount} damage.`,
      });
      continue;
    }

    if (event.type === 'resource-gathered') {
      const resourceLabel = event.resource === 'wood' ? 'Wood' : 'Ore';
      requests.push({
        id: `${batch.batchId}:resource:${event.resource}:${sequence}`,
        kind: 'resource',
        text: `+${event.amount}`,
        anchor: { ...(event.collectorPosition ?? batch.nextState.hero.position) },
        iconKey: iconKeyForResource(event.resource),
        delayMs: sequence++ * 180,
        announcement: `Gained ${event.amount} ${resourceLabel}.`,
      });
    }
  }

  return requests;
}

export function feedbackAnnouncementForBatch(batch: ActionBatch): string | undefined {
  const announcements = feedbackRequestsForBatch(batch).map((request) => request.announcement);
  return announcements.length > 0 ? announcements.join(' ') : undefined;
}
