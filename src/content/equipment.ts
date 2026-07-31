export const equipmentSlots = [
  { id: 'main-hand', label: 'Main Hand' },
  { id: 'off-hand', label: 'Off-Hand' },
  { id: 'helm', label: 'Helm' },
  { id: 'gloves', label: 'Gloves' },
  { id: 'boots', label: 'Boots' },
  { id: 'belt', label: 'Belt' },
  { id: 'ring-1', label: 'Ring' },
  { id: 'ring-2', label: 'Ring' },
  { id: 'amulet', label: 'Amulet' },
  { id: 'trinket', label: 'Trinket' },
] as const;

export type EquipmentSlotId = (typeof equipmentSlots)[number]['id'];
