import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { assetDefinitions } from './assets.config.mjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicAssetsRoot = path.join(projectRoot, 'public/assets');
const manifestPath = path.join(publicAssetsRoot, 'manifest.json');
const failures = [];

function fail(message) {
  failures.push(message);
}

function relativeProjectPath(filePath) {
  return path.relative(projectRoot, filePath).replaceAll(path.sep, '/');
}

function manifestPathFor(outputPath) {
  return outputPath.replace(/^public\//, '').replaceAll(path.sep, '/');
}

async function exists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

async function walkFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await walkFiles(entryPath)));
    else if (entry.isFile()) files.push(entryPath);
  }
  return files;
}

async function compareImageMetadata(filePath, expectedWidth, expectedHeight, label) {
  try {
    const metadata = await sharp(filePath).metadata();
    if (metadata.width !== expectedWidth || metadata.height !== expectedHeight) {
      fail(
        `${label}: expected ${expectedWidth}x${expectedHeight}, got ${metadata.width ?? '?'}x${metadata.height ?? '?'}`,
      );
    }
    return metadata;
  } catch (error) {
    fail(`${label}: unreadable image (${error instanceof Error ? error.message : String(error)})`);
    return undefined;
  }
}

const definitionById = new Map();
const expectedGeneratedPaths = new Set();
const expectedManifestPaths = new Set();
const expectedAssetIds = new Set();
const sourceDimensionsById = new Map();

for (const definition of assetDefinitions) {
  if (definitionById.has(definition.id)) fail(`scripts/assets.config.mjs: duplicate stable asset ID ${definition.id}`);
  definitionById.set(definition.id, definition);
  expectedAssetIds.add(definition.id);

  const sourcePath = path.join(projectRoot, definition.source);
  if (!(await exists(sourcePath))) {
    fail(`${definition.id}: missing source ${definition.source}`);
    continue;
  }

  let sourceMetadata;
  try {
    sourceMetadata = await sharp(sourcePath).metadata();
  } catch (error) {
    fail(
      `${definition.id}: unreadable source ${definition.source} (${error instanceof Error ? error.message : String(error)})`,
    );
    continue;
  }
  if (!sourceMetadata.width || !sourceMetadata.height) {
    fail(`${definition.id}: source ${definition.source} has no readable dimensions`);
    continue;
  }
  sourceDimensionsById.set(definition.id, { width: sourceMetadata.width, height: sourceMetadata.height });

  for (const [variantName, variant] of Object.entries(definition.variants)) {
    const outputManifestPath = manifestPathFor(variant.output);
    const outputPath = path.join(projectRoot, variant.output);
    const outputRelativePath = outputManifestPath.replace(/^assets\//, '');
    if (expectedManifestPaths.has(outputManifestPath))
      fail(`${definition.id}.${variantName}: duplicate output ${variant.output}`);
    expectedManifestPaths.add(outputManifestPath);
    expectedGeneratedPaths.add(outputRelativePath);

    if (!(await exists(outputPath))) {
      fail(`${definition.id}.${variantName}: missing generated output ${variant.output}`);
      continue;
    }

    const expectedWidth = variant.cropScale ? variant.size : Math.min(sourceMetadata.width, variant.width);
    const expectedHeight = variant.cropScale
      ? variant.size
      : Math.round((sourceMetadata.height * expectedWidth) / sourceMetadata.width);
    await compareImageMetadata(outputPath, expectedWidth, expectedHeight, `${definition.id}.${variantName}`);
  }
}

let manifest;
try {
  manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
} catch (error) {
  fail(`public/assets/manifest.json: unreadable JSON (${error instanceof Error ? error.message : String(error)})`);
}

if (manifest) {
  if (manifest.version !== 1)
    fail(`public/assets/manifest.json: expected manifest version 1, got ${String(manifest.version)}`);
  if (!Array.isArray(manifest.assets)) fail('public/assets/manifest.json: assets must be an array');
  else {
    const manifestById = new Map();
    for (const asset of manifest.assets) {
      if (!asset || typeof asset.id !== 'string') {
        fail('public/assets/manifest.json: every asset entry needs a stable string id');
        continue;
      }
      if (manifestById.has(asset.id)) fail(`public/assets/manifest.json: duplicate stable asset ID ${asset.id}`);
      manifestById.set(asset.id, asset);
    }

    for (const definition of assetDefinitions) {
      const asset = manifestById.get(definition.id);
      if (!asset) {
        fail(`${definition.id}: missing manifest entry`);
        continue;
      }
      if (asset.kind !== definition.kind) fail(`${definition.id}: manifest kind does not match source definition`);
      if (asset.source !== definition.source)
        fail(`${definition.id}: manifest source does not match source definition`);
      const sourceDimensions = sourceDimensionsById.get(definition.id);
      if (
        sourceDimensions &&
        (asset.sourceDimensions?.width !== sourceDimensions.width ||
          asset.sourceDimensions?.height !== sourceDimensions.height)
      ) {
        fail(`${definition.id}: manifest source dimensions do not match the authored source`);
      }
      for (const [variantName, variant] of Object.entries(definition.variants)) {
        const manifestVariant = asset.variants?.[variantName];
        const expectedPath = manifestPathFor(variant.output);
        if (!manifestVariant) {
          fail(`${definition.id}.${variantName}: missing manifest variant`);
          continue;
        }
        if (manifestVariant.path !== expectedPath)
          fail(`${definition.id}.${variantName}: manifest path does not match source definition`);
        const outputPath = path.join(projectRoot, variant.output);
        if (await exists(outputPath)) {
          const metadata = await sharp(outputPath).metadata();
          if (manifestVariant.width !== metadata.width || manifestVariant.height !== metadata.height) {
            fail(`${definition.id}.${variantName}: manifest dimensions do not match generated output`);
          }
        }
      }
      const expectedVariants = Object.keys(definition.variants).sort().join(',');
      const actualVariants = Object.keys(asset.variants ?? {})
        .sort()
        .join(',');
      if (expectedVariants !== actualVariants)
        fail(`${definition.id}: manifest variants differ (expected ${expectedVariants}, got ${actualVariants})`);
    }

    for (const id of manifestById.keys()) {
      if (!definitionById.has(id)) fail(`public/assets/manifest.json: orphan manifest asset ${id}`);
    }
  }
}

if (await exists(publicAssetsRoot)) {
  for (const filePath of await walkFiles(publicAssetsRoot)) {
    const relativePath = path.relative(publicAssetsRoot, filePath).replaceAll(path.sep, '/');
    if (relativePath === 'manifest.json') continue;
    if (!expectedGeneratedPaths.has(relativePath)) fail(`public/assets: orphan generated output ${relativePath}`);
  }
}

const contentRoot = path.join(projectRoot, 'src/content');
if (await exists(contentRoot)) {
  for (const filePath of await walkFiles(contentRoot)) {
    if (!/\.(?:ts|tsx)$/.test(filePath)) continue;
    const source = await readFile(filePath, 'utf8');
    const ids = new Map();
    for (const match of source.matchAll(/\bid\s*:\s*['"]([^'"]+)['"]/g)) {
      if (ids.has(match[1])) fail(`${relativeProjectPath(filePath)}: duplicate authored stable ID ${match[1]}`);
      ids.set(match[1], true);
    }
    for (const match of source.matchAll(/\bassetId\s*:\s*['"]([^'"]+)['"]/g)) {
      if (!expectedAssetIds.has(match[1])) fail(`${relativeProjectPath(filePath)}: unknown asset ID ${match[1]}`);
    }
    for (const match of source.matchAll(/assets\/([a-z0-9/_-]+\.(?:webp|png|jpg|jpeg))/gi)) {
      if (!expectedManifestPaths.has(match[1]))
        fail(`${relativeProjectPath(filePath)}: asset path has no generated output ${match[1]}`);
    }
  }
}

if (failures.length > 0) {
  console.error('Torch content and asset check failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(
    `Torch content and asset check passed (${assetDefinitions.length} stable assets, ${expectedGeneratedPaths.size} generated outputs).`,
  );
}
