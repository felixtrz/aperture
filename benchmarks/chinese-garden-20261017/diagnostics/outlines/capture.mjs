import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {startApertureStaticServer} from '../../../../packages/cli/dist/render/static-server.js';
import {runVerifiedScene} from '../../../../scripts/verified-webgpu.mjs';

assert(process.env.APERTURE_TMP_RUN, 'Use the runtime-pressure wrapper');
const variant = process.argv[2];
assert(['no-ssao', 'ssao-single-sample', 'fixed'].includes(variant));
const directory = path.join(import.meta.dirname, variant);
const server = await startApertureStaticServer({
  mounts: [{prefix: '/', dir: path.join(directory, 'dist')}],
  index: await fs.readFile(path.join(directory, 'dist/index.html'), 'utf8'),
});
try {
  const report = await runVerifiedScene({
    runtimeRoot: '/workspace/aperture/.aperture-env/render-runtime',
    scratchRoot: process.env.APERTURE_TMP_RUN,
    url: server.url + '/',
    outputPath: path.join(directory, 'report.json'),
    screenshotPath: path.join(directory, 'render.png'),
    viewport: {width: 1200, height: 900},
    timeout: 120000,
  });
  assert.equal(report.status, 'passed');
  console.log(JSON.stringify({variant, status: report.status, proof: report.proof}));
} finally {
  await server.close();
}
