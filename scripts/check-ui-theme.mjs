import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const files = [
  'src/styles.css',
  'src/index.css',
  'src/ui/menu-overlay.tsx',
  'src/ui/context-action-hand.tsx',
  'src/components/ui/button.tsx',
  'src/components/ui/dialog.tsx',
  'src/components/ui/dropdown-menu.tsx',
  'src/components/ui/select.tsx',
  'src/components/ui/tabs.tsx',
];

const legacyPalette = [
  '#203039', '#142027', '#3a443e', '#222f32', '#1b292f', '#152027',
  '#1b292e', '#142026', '#18252b', '#18272d', '#101a20', '#18262c',
  '#121d23', '#121c21', '#0b1217', '#151d22', '#1b2022', '#111c22',
  '#171b1d', '#202426', '#151719', '#aeb9c0', '#b7c1c2',
  'rgb(12 17 24', 'rgb(8 11 16', 'rgb(3 5 8', 'rgb(38 45 49',
  'rgb(16 22 27', 'rgb(3 6 10', 'rgb(174 185 192',
];

const requiredTokens = [
  '--ui-color-background',
  '--ui-color-surface',
  '--ui-color-surface-panel',
  '--ui-color-surface-content',
  '--ui-color-surface-content-raised',
  '--ui-color-accent',
  '--ui-color-accent-soft',
  '--ui-color-on-accent',
  '--ui-color-muted',
  '--ui-color-grid',
  '--ui-color-fog',
  '--ui-color-danger',
];

const failures = [];

for (const relativePath of files) {
  const filePath = resolve(root, relativePath);
  const source = readFileSync(filePath, 'utf8');
  for (const value of legacyPalette) {
    if (source.toLowerCase().includes(value.toLowerCase())) {
      failures.push(`${relativePath}: legacy cool palette value ${value}`);
    }
  }
}

const styles = readFileSync(resolve(root, 'src/styles.css'), 'utf8');
for (const token of requiredTokens) {
  if (!styles.includes(token)) failures.push(`src/styles.css: missing canonical token ${token}`);
}

const featureFiles = [
  'src/ui/menu-overlay.tsx',
  'src/ui/context-action-hand.tsx',
  'src/components/ui/button.tsx',
  'src/components/ui/dialog.tsx',
  'src/components/ui/dropdown-menu.tsx',
  'src/components/ui/select.tsx',
  'src/components/ui/tabs.tsx',
];
for (const relativePath of featureFiles) {
  const source = readFileSync(resolve(root, relativePath), 'utf8');
  if (/#(?:[0-9a-f]{3,8})\b/i.test(source) || /rgb\(/i.test(source)) {
    failures.push(`${relativePath}: feature UI must consume semantic tokens, not raw colors`);
  }
}

if (failures.length > 0) {
  console.error('Torch UI theme check failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`Torch UI theme check passed (${files.length} files, ${requiredTokens.length} canonical tokens).`);
}
