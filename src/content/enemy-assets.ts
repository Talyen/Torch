const assetBase = `${import.meta.env.BASE_URL}assets/enemies`;

export const enemyAssets = {
  slime: {
    id: 'enemy.slime',
    name: 'Forest Slime',
    full: `${assetBase}/slime.webp`,
    marker: `${assetBase}/slime-marker.png`,
    fullAlt: 'A cheerful green slime resting in a sunlit forest clearing.',
  },
} as const;
