import { equipmentSlots } from '../content/equipment';
import { itemDefinition } from '../content/items';
import { toolSlots } from '../content/tools';
import type { EquipmentSlotId } from '../content/equipment';
import type { ToolSlotId } from '../content/tools';
import type { GameState, LoadoutCommand, LoadoutSlotId, SimEvent } from './types';

const equipmentSlotIds = new Set<string>(equipmentSlots.map((slot) => slot.id));
const toolSlotIds = new Set<string>(toolSlots.map((slot) => slot.id));

export function isEquipmentLoadoutSlot(slot: string): slot is EquipmentSlotId {
  return equipmentSlotIds.has(slot);
}

export function isToolLoadoutSlot(slot: string): slot is ToolSlotId {
  return toolSlotIds.has(slot);
}

export function equippedItemForSlot(state: GameState, slot: LoadoutSlotId): string | undefined {
  return isEquipmentLoadoutSlot(slot) ? state.hero.equippedItems[slot] : state.hero.equippedTools[slot];
}

export function itemCanOccupySlot(itemId: string, slot: LoadoutSlotId): boolean {
  const definition = itemDefinition(itemId);
  if (!definition) return false;
  if (isEquipmentLoadoutSlot(slot)) return definition.equipmentSlot === slot;
  return definition.toolSlot === slot;
}

export function applyLoadoutCommand(state: GameState, command: LoadoutCommand, events: SimEvent[]): boolean {
  const currentItemId = equippedItemForSlot(state, command.slot);

  if (command.type === 'unequip-item') {
    if (!currentItemId) {
      return blockLoadout(events, `There is nothing equipped in the ${command.slot} slot.`);
    }

    addInventoryItem(state, currentItemId, 1);
    setLoadoutItem(state, command.slot, undefined);
    events.push({ type: 'item-unequipped', slot: command.slot, itemId: currentItemId });
    events.push({ type: 'message', text: `${itemName(currentItemId)} unequipped.` });
    return true;
  }

  if (!itemDefinition(command.itemId)) {
    return blockLoadout(events, 'That item is not part of the current equipment catalog.');
  }
  if (!itemCanOccupySlot(command.itemId, command.slot)) {
    return blockLoadout(events, 'That item cannot be equipped in this slot.');
  }
  if (currentItemId === command.itemId) {
    return blockLoadout(events, `${itemName(command.itemId)} is already equipped.`);
  }
  if ((state.hero.inventory[command.itemId] ?? 0) < 1) {
    return blockLoadout(events, `You do not have ${itemName(command.itemId)}.`);
  }

  removeInventoryItem(state, command.itemId, 1);
  if (currentItemId) addInventoryItem(state, currentItemId, 1);
  setLoadoutItem(state, command.slot, command.itemId);
  events.push({ type: 'item-equipped', slot: command.slot, itemId: command.itemId });
  events.push({ type: 'message', text: `${itemName(command.itemId)} equipped.` });
  return true;
}

function setLoadoutItem(state: GameState, slot: LoadoutSlotId, itemId: string | undefined): void {
  if (isEquipmentLoadoutSlot(slot)) {
    if (itemId) state.hero.equippedItems[slot] = itemId;
    else delete state.hero.equippedItems[slot];
    return;
  }
  if (itemId) state.hero.equippedTools[slot] = itemId;
  else delete state.hero.equippedTools[slot];
}

function addInventoryItem(state: GameState, itemId: string, quantity: number): void {
  state.hero.inventory[itemId] = (state.hero.inventory[itemId] ?? 0) + quantity;
}

function removeInventoryItem(state: GameState, itemId: string, quantity: number): void {
  const nextQuantity = (state.hero.inventory[itemId] ?? 0) - quantity;
  if (nextQuantity <= 0) delete state.hero.inventory[itemId];
  else state.hero.inventory[itemId] = nextQuantity;
}

function itemName(itemId: string): string {
  return itemDefinition(itemId)?.name ?? itemId;
}

function blockLoadout(events: SimEvent[], message: string): false {
  events.push({ type: 'blocked', reason: message });
  events.push({ type: 'message', text: message });
  return false;
}
