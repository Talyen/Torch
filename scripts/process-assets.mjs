import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdir, writeFile } from 'node:fs/promises';
import sharp from 'sharp';
import { assetDefinitions } from './assets.config.mjs';

const scriptsDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptsDirectory, '..');

function withEncoding(image, variant) {
  if (variant.format === 'png') {
    return image.png({ compressionLevel: 9, adaptiveFiltering: true });
  }

  return image.webp({ quality: variant.quality ?? 92 });
}

function withRoundedCorners(image, width, height, cornerRadius) {
  if (!cornerRadius) return image;

  const radius = Math.max(1, Math.round(Math.min(width, height) * cornerRadius));
  const mask = Buffer.from(
    `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg"><rect width="${width}" height="${height}" rx="${radius}" ry="${radius}" fill="white"/></svg>`,
  );

  return image.composite([{ input: mask, blend: 'dest-in' }]);
}

const manifest = {
  version: 1,
  assets: [],
};

for (const definition of assetDefinitions) {
  const sourcePath = path.join(projectRoot, definition.source);
  const sourceImage = sharp(sourcePath);
  const metadata = await sourceImage.metadata();

  if (!metadata.width || !metadata.height) {
    throw new Error(`Could not read dimensions for ${definition.source}`);
  }

  const assetManifest = {
    id: definition.id,
    kind: definition.kind,
    source: definition.source,
    sourceDimensions: {
      width: metadata.width,
      height: metadata.height,
    },
    variants: {},
  };

  for (const [variantName, variant] of Object.entries(definition.variants)) {
    const outputPath = path.join(projectRoot, variant.output);
    await mkdir(path.dirname(outputPath), { recursive: true });

    if (variant.cropScale) {
      const cropSize = Math.round(Math.min(metadata.width, metadata.height) * variant.cropScale);
      const focalX = variant.focalPoint?.x ?? 0.5;
      const focalY = variant.focalPoint?.y ?? 0.5;
      const maxLeft = metadata.width - cropSize;
      const maxTop = metadata.height - cropSize;
      const left = Math.min(maxLeft, Math.max(0, Math.round(metadata.width * focalX - cropSize / 2)));
      const top = Math.min(maxTop, Math.max(0, Math.round(metadata.height * focalY - cropSize / 2)));

      const processed = withRoundedCorners(
        sharp(sourcePath)
          .extract({ left, top, width: cropSize, height: cropSize })
          .resize(variant.size, variant.size, { fit: 'fill' }),
        variant.size,
        variant.size,
        variant.cornerRadius,
      );

      await withEncoding(processed, variant).toFile(outputPath);

      assetManifest.variants[variantName] = {
        path: variant.output.replace(/^public\//, ''),
        width: variant.size,
        height: variant.size,
        crop: { left, top, width: cropSize, height: cropSize },
        cornerRadius: variant.cornerRadius ?? 0,
      };
      continue;
    }

    const outputSize = variant.width;
    const outputWidth = Math.min(metadata.width, outputSize);
    const outputHeight = Math.round((metadata.height * outputWidth) / metadata.width);
    const processed = withRoundedCorners(
      sharp(sourcePath).resize({ width: variant.width, withoutEnlargement: true }),
      outputWidth,
      outputHeight,
      variant.cornerRadius,
    );

    await withEncoding(processed, variant).toFile(outputPath);

    const outputMetadata = await sharp(outputPath).metadata();
    assetManifest.variants[variantName] = {
      path: variant.output.replace(/^public\//, ''),
      width: outputMetadata.width,
      height: outputMetadata.height,
      cornerRadius: variant.cornerRadius ?? 0,
    };
  }

  manifest.assets.push(assetManifest);
  console.log(`Processed ${definition.id} from ${definition.source}`);
}

const manifestPath = path.join(projectRoot, 'public/assets/manifest.json');
await mkdir(path.dirname(manifestPath), { recursive: true });
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
console.log(`Wrote ${path.relative(projectRoot, manifestPath)}`);
