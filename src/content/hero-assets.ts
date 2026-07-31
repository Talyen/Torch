const assetBase = `${import.meta.env.BASE_URL}assets/heroes`;

export const heroAssets = {
  knight: {
    id: 'hero.knight',
    name: 'Knight',
    full: `${assetBase}/knight.webp`,
    square: `${assetBase}/knight-square.webp`,
    marker: `${assetBase}/knight-marker.png`,
    hud: `${assetBase}/knight-hud.png`,
    fullAlt: 'Knight hero standing with sword and shield in a sunlit mountain valley.',
    squareAlt: 'Portrait crop of the Knight hero.',
  },
} as const;
