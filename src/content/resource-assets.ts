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

function isResourceAssetKey(value: string): value is ResourceAssetKey {
  return Object.hasOwn(resourceAssets, value);
}

export function resourceAssetForFeedback(iconKey: string | undefined): string | undefined {
  const resource = iconKey?.startsWith('resource.homestead.') ? iconKey.slice('resource.homestead.'.length) : undefined;
  return resource && isResourceAssetKey(resource) ? resourceAssets[resource] : undefined;
}
