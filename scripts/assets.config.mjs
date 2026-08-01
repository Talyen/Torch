export const assetDefinitions = [
  {
    id: 'hero.knight',
    kind: 'hero',
    source: 'Raw Assets/Heroes/Knight.jpeg',
    variants: {
      full: {
        output: 'public/assets/heroes/knight.webp',
        width: 1536,
        quality: 92,
        cornerRadius: 0.06,
      },
      square: {
        output: 'public/assets/heroes/knight-square.webp',
        size: 1024,
        quality: 92,
        cropScale: 1,
        focalPoint: { x: 0.5, y: 0.28 },
        cornerRadius: 0.1,
      },
      marker: {
        output: 'public/assets/heroes/knight-marker.png',
        format: 'png',
        size: 1536,
        // Preserve the established in-world framing while retaining a dense
        // 1536px source for high-DPI display.
        cropScale: 0.54,
        focalPoint: { x: 0.5, y: 0.3 },
        cornerRadius: 0.1,
      },
      hud: {
        output: 'public/assets/heroes/knight-hud.png',
        format: 'png',
        size: 896,
        // Use a tighter focal crop for the small HUD button.
        cropScale: 0.42,
        focalPoint: { x: 0.5, y: 0.26 },
        cornerRadius: 0.1,
      },
    },
  },
  {
    id: 'enemy.slime',
    kind: 'enemy',
    // The original HEIC is preserved beside this pipeline-friendly source copy.
    source: 'Raw Assets/Enemies/Slime.jpg',
    variants: {
      full: {
        output: 'public/assets/enemies/slime.webp',
        width: 1536,
        quality: 92,
        cornerRadius: 0.06,
      },
      marker: {
        output: 'public/assets/enemies/slime-marker.png',
        format: 'png',
        size: 896,
        cropScale: 0.56,
        focalPoint: { x: 0.5, y: 0.58 },
        cornerRadius: 0.1,
      },
    },
  },
  {
    id: 'ability.bash',
    kind: 'ability',
    source: 'Raw Assets/Abilities/Bash.jpeg',
    variants: {
      full: {
        output: 'public/assets/abilities/bash.webp',
        width: 896,
        quality: 92,
        cornerRadius: 0.06,
      },
    },
  },
  {
    id: 'ability.sunder',
    kind: 'ability',
    source: 'Raw Assets/Abilities/Sunder.jpeg',
    variants: {
      full: {
        output: 'public/assets/abilities/sunder.webp',
        width: 896,
        quality: 92,
        cornerRadius: 0.06,
      },
    },
  },
  {
    id: 'ability.avatar',
    kind: 'ability',
    source: 'Raw Assets/Abilities/Avatar.jpeg',
    variants: {
      full: {
        output: 'public/assets/abilities/avatar.webp',
        width: 896,
        quality: 92,
        cornerRadius: 0.06,
      },
    },
  },
  ...[
    ['wood', 'resource_homestead_wood.png'],
    ['stone', 'resource_homestead_stone.png'],
    ['iron', 'resource_homestead_iron.png'],
    ['food', 'resource_homestead_food.png'],
    ['herbs', 'resource_homestead_herbs.png'],
    ['hide', 'resource_homestead_hide.png'],
    ['crystal', 'resource_homestead_crystal.png'],
    ['gold', 'resource_homestead_gold.png'],
  ].map(([resource, filename]) => ({
    id: `resource.homestead.${resource}`,
    kind: 'resource',
    source: `Raw Assets/Homestead Materials/${filename}`,
    variants: {
      icon: {
        output: `public/assets/resources/homestead-${resource}.png`,
        format: 'png',
        width: 256,
      },
    },
  })),
];
