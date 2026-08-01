export const equipmentSlots = [
  { id: 'helm', label: 'Helm' },
  { id: 'amulet', label: 'Amulet' },
  { id: 'main-hand', label: 'Main Hand' },
  { id: 'body', label: 'Body' },
  { id: 'off-hand', label: 'Off-Hand' },
  { id: 'gloves', label: 'Gloves' },
  { id: 'ring-1', label: 'Ring 1' },
  { id: 'belt', label: 'Belt' },
  { id: 'trinket', label: 'Trinket' },
  { id: 'boots', label: 'Boots' },
] as const;

export type EquipmentSlotId = (typeof equipmentSlots)[number]['id'];

export function equipmentSlotLabel(slotId: EquipmentSlotId): string {
  return equipmentSlots.find((slot) => slot.id === slotId)?.label ?? slotId;
}

export function isEquipmentSlot(slotId: string): slotId is EquipmentSlotId {
  return equipmentSlots.some((slot) => slot.id === slotId);
}
