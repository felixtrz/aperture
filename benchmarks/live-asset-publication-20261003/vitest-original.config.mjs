import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import base from '../../vitest.config.ts';

const files = ['packages/app/src/asset-mirror.ts', 'packages/webgpu/src/app/create-webgpu-app.ts'];
const originals = new Map(files.map(file => [
  fileURLToPath(new URL(`../../${file}`, import.meta.url)),
  readFileSync(new URL(`./originals/${file}`, import.meta.url), 'utf8'),
]));

// Use byte-preserved source preimages at their canonical module identities.
// This proves the final regression against old components without changing the
// checkout, built packages, immutable benchmark source, or the test expectations.
export default {
  ...base,
  test: { ...base.test, include: ["test/app/mesh-publication-regression.test.ts", "test/webgpu/webgpu-app.test.ts"] },
  plugins: [...(base.plugins ?? []), {
    name: 'live-asset-regression-original-source',
    enforce: 'pre',
    load(id) { return originals.get(id.split('?')[0]) ?? null; },
  }],
};
