import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import base from '../../vitest.config.ts';

const files = [
  'packages/webgpu/src/app/auto-shadow-frame.ts',
  'packages/webgpu/src/app/queued-built-in-frame.ts',
  'packages/webgpu/src/app/resource-cache.ts',
];
const originals = new Map(files.map(file => [
  fileURLToPath(new URL(`../../${file}`, import.meta.url)),
  readFileSync(new URL(`./originals/${file}.txt`, import.meta.url), 'utf8'),
]));

// Load preserved implementation bytes at canonical module identities, leaving
// active source, test expectations, built artifacts and benchmark evidence alone.
export default {
  ...base,
  test: { ...base.test, include: ['test/webgpu/webgpu-app.test.ts'] },
  plugins: [...(base.plugins ?? []), {
    name: 'shadow-regression-original-source',
    enforce: 'pre',
    load(id) { return originals.get(id.split('?')[0]) ?? null; },
  }],
};
