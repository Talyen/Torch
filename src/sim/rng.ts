/** A small deterministic integer hash for world generation and simulation fixtures. */
export function hashCoordinates(seed: number, x: number, y: number, salt = 0): number {
  let hash = seed | 0;
  hash = Math.imul(hash ^ Math.imul(x, 374761393), 668265263);
  hash = Math.imul(hash ^ Math.imul(y, 1274126177), 2246822519);
  hash = Math.imul(hash ^ Math.imul(salt, 3266489917), 374761393);
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 1274126177);
  hash ^= hash >>> 16;
  return hash >>> 0;
}

export function unitRandom(seed: number, x: number, y: number, salt = 0): number {
  return hashCoordinates(seed, x, y, salt) / 4294967296;
}
