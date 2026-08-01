import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distRoot = path.join(root, 'dist');
const limits = {
  js: Number(process.env.TORCH_MAX_JS_BYTES ?? 2_200_000),
  css: Number(process.env.TORCH_MAX_CSS_BYTES ?? 300_000),
};

async function walk(directory) {
  try {
    const entries = await readdir(directory, { withFileTypes: true });
    const files = [];
    for (const entry of entries) {
      const filePath = path.join(directory, entry.name);
      if (entry.isDirectory()) files.push(...(await walk(filePath)));
      else if (entry.isFile()) files.push(filePath);
    }
    return files;
  } catch {
    throw new Error(`Missing ${path.relative(root, distRoot)}. Run npm run build first.`);
  }
}

const files = await walk(distRoot);
const totals = { js: 0, css: 0 };
for (const filePath of files) {
  const extension = path.extname(filePath).slice(1);
  if (!(extension in totals)) continue;
  totals[extension] += (await stat(filePath)).size;
}

const failures = Object.entries(limits)
  .filter(([extension, limit]) => totals[extension] > limit)
  .map(([extension, limit]) => `${extension} output is ${totals[extension]} bytes (limit ${limit})`);

if (failures.length > 0) {
  console.error('Torch bundle size check failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`Torch bundle size check passed (js ${totals.js} bytes, css ${totals.css} bytes).`);
}
