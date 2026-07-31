export const equipmentSlots = [
  { id: 'helm', label: 'Helm' },
  { id: 'amulet', label: 'Amulet' },
  { id: 'main-hand', label: 'Main Hand' },
  { id: 'body', label: 'Body' },
  { id: 'off-hand', label: 'Off-Hand' },
  { id: 'gloves', label: 'Gloves' },
  { id: 'ring-1', label: 'Ring' },
  { id: 'belt', label: 'Belt' },
  { id: 'ring-2', label: 'Ring' },
  { id: 'trinket', label: 'Trinket' },
  { id: 'boots', label: 'Boots' },
] as const;

export type EquipmentSlotId = (typeof equipmentSlots)[number]['id'];
