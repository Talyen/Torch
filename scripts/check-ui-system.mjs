import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));

function filesUnder(relativeDirectory, extensions) {
  const directory = resolve(root, relativeDirectory);
  if (!existsSync(directory)) return [];

  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const relativePath = `${relativeDirectory}/${entry.name}`;
    if (entry.isDirectory()) files.push(...filesUnder(relativePath, extensions));
    else if (extensions.some((extension) => entry.name.endsWith(extension))) files.push(relativePath);
  }
  return files;
}

const featureFiles = filesUnder('src/ui', ['.tsx', '.ts', '.css']).filter((file) => file !== 'src/ui/primitives.tsx');
const failures = [];

for (const relativePath of featureFiles) {
  const source = readFileSync(resolve(root, relativePath), 'utf8');
  if (/@base-ui\/react(?:[/'"]|$)/.test(source)) {
    failures.push(`${relativePath}: import Base UI through src/ui/primitives.tsx`);
  }
  if (/<select\b/i.test(source)) failures.push(`${relativePath}: use TorchSelectField instead of a native select`);
  if (/transition\s*:\s*all\b/i.test(source)) failures.push(`${relativePath}: name transition properties explicitly`);
  if (/#(?:[0-9a-f]{3,8})\b|rgb\(/i.test(source)) {
    failures.push(`${relativePath}: consume semantic design tokens instead of feature-local colors`);
  }
  if (/!important\b/.test(source)) failures.push(`${relativePath}: avoid feature-local !important overrides`);
  if (/<button\b/i.test(source) && relativePath !== 'src/ui/context-action-hand.tsx') {
    failures.push(`${relativePath}: use TorchButton or a Torch-owned interaction primitive`);
  }
}

const primitives = readFileSync(resolve(root, 'src/ui/primitives.tsx'), 'utf8');
for (const requiredExport of ['TorchSelectField', 'TorchIconButton', 'TorchArtworkCard']) {
  if (!primitives.includes(`function ${requiredExport}`)) {
    failures.push(`src/ui/primitives.tsx: missing ${requiredExport}`);
  }
}

const styles = readFileSync(resolve(root, 'src/styles.css'), 'utf8');
for (const requiredToken of [
  '--ui-color-surface-selected',
  '--ui-color-popover',
  '--ui-option-radius',
  '--ui-color-icon',
  '--ui-color-control-foreground',
]) {
  if (!styles.includes(requiredToken)) failures.push(`src/styles.css: missing ${requiredToken}`);
}

const tokenValues = Object.fromEntries(
  [...styles.matchAll(/^\s*(--ui-[\w-]+):\s*(#[0-9a-f]{6});/gim)].map(([, token, value]) => [token, value]),
);
const contrastPairs = [
  ['--ui-color-text', '--ui-color-surface-content', 4.5, 'body text on content'],
  ['--ui-color-muted', '--ui-color-surface-content', 4.5, 'muted text on content'],
  ['--ui-color-text', '--ui-color-control', 4.5, 'body text on controls'],
  ['--ui-color-muted', '--ui-color-control', 4.5, 'muted text on controls'],
  [
    '--ui-color-control-foreground',
    '--ui-color-surface-content-raised',
    4.5,
    'dark-control foreground on raised surfaces',
  ],
  ['--ui-color-icon', '--ui-color-surface-hud', 3, 'icon emphasis on HUD'],
  ['--ui-color-text', '--ui-color-surface-selected', 4.5, 'body text on selected controls'],
  ['--ui-color-muted', '--ui-color-surface-selected', 4.5, 'muted text on selected controls'],
  ['--ui-color-accent', '--ui-color-popover', 3, 'gold emphasis on popovers'],
];

function relativeLuminance(hex) {
  const channels = [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255);
  const linear = channels.map((channel) => (channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4));
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

for (const [foregroundToken, backgroundToken, minimum, label] of contrastPairs) {
  const foreground = tokenValues[foregroundToken];
  const background = tokenValues[backgroundToken];
  if (!foreground || !background) {
    failures.push(`src/styles.css: missing contrast token ${foregroundToken} or ${backgroundToken}`);
    continue;
  }
  const foregroundLuminance = relativeLuminance(foreground);
  const backgroundLuminance = relativeLuminance(background);
  const ratio =
    (Math.max(foregroundLuminance, backgroundLuminance) + 0.05) /
    (Math.min(foregroundLuminance, backgroundLuminance) + 0.05);
  if (ratio < minimum) failures.push(`${label} contrast ${ratio.toFixed(2)}:1 is below ${minimum}:1`);
}

if (failures.length > 0) {
  console.error('Torch UI system check failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(
    `Torch UI system check passed (${featureFiles.length} feature files, ${contrastPairs.length} contrast pairs).`,
  );
}
