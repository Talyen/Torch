const assetBase = `${import.meta.env.BASE_URL}assets/abilities`;

export const abilityAssets = {
  bash: {
    full: `${assetBase}/bash.webp`,
    fullAlt: 'Bash ability artwork showing a forceful armored strike.',
  },
  sunder: {
    full: `${assetBase}/sunder.webp`,
    fullAlt: 'Sunder ability artwork showing a weapon breaking through armor.',
  },
  avatar: {
    full: `${assetBase}/avatar.webp`,
    fullAlt: 'Avatar ability artwork showing a hero empowered by radiant energy.',
  },
} as const;
