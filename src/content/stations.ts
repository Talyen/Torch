export const stations = [
  {
    id: 'workbench',
    name: 'Workbench',
    description: 'A sturdy surface for shaping gathered materials and simple gear.',
  },
] as const;

export function stationDefinition(stationId: string): (typeof stations)[number] | undefined {
  return stations.find((station) => station.id === stationId);
}
