const assetBase = `${import.meta.env.BASE_URL}assets/resources`;

export const resourceAssets = {
  wood: `${assetBase}/homestead-wood.png`,
  stone: `${assetBase}/homestead-stone.png`,
  iron: `${assetBase}/homestead-iron.png`,
  food: `${assetBase}/homestead-food.png`,
  herbs: `${assetBase}/homestead-herbs.png`,
  hide: `${assetBase}/homestead-hide.png`,
  crystal: `${assetBase}/homestead-crystal.png`,
  gold: `${assetBase}/homestead-gold.png`,
} as const;

export type ResourceAssetKey = keyof typeof resourceAssets;

export function resourceAssetForFeedback(iconKey: string | undefined): string | undefined {
  const resource = iconKey?.replace('resource.homestead.', '') as ResourceAssetKey | undefined;
  return resource && resource in resourceAssets ? resourceAssets[resource] : undefined;
}
