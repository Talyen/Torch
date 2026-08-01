import { describe, expect, it } from 'vitest';
import { resourceAssetForFeedback } from '../src/content/resource-assets';

describe('resource feedback assets', () => {
  it('resolves authored resources and rejects inherited or unknown keys', () => {
    expect(resourceAssetForFeedback('resource.homestead.wood')).toMatch(/assets\/resources\/homestead-wood\.png$/);
    expect(resourceAssetForFeedback('resource.homestead.not-a-resource')).toBeUndefined();
    expect(resourceAssetForFeedback('resource.homestead.toString')).toBeUndefined();
  });

  it('ignores unrelated feedback icon keys', () => {
    expect(resourceAssetForFeedback('item.sword')).toBeUndefined();
    expect(resourceAssetForFeedback(undefined)).toBeUndefined();
  });
});
