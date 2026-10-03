/** CPU-only revalidation of retained native records; never calls a native runner. */
import { compareAll } from '../crane-topology-regression-20261003/compare.mjs';
import { readServedModule, checkPins } from '../crane-topology-regression-20261003/run.mjs';
import { readFile, writeFile } from 'node:fs/promises';
const here = new URL('./', import.meta.url);
const base = new URL('../crane-topology-regression-20261003/', import.meta.url);
const frozen = await checkPins();
const comparison = await compareAll('attempt-001');
let loadedInputs = 0;
for (const engine of ['aperture', 'threejs']) {
  for (const session of ['live', 'fresh-baseline', 'fresh-grow', 'fresh-shrink']) {
    const observed = JSON.parse(await readFile(new URL(`renders/${engine}/${session}/attempt-001/loaded-inputs.json`, base)));
    for (const [route, receipt] of Object.entries(observed)) {
      const actual = await readServedModule(route, session, frozen.pins);
      for (const field of ['name', 'inputSha256', 'servedSha256', 'bytes', 'transformation']) {
        if (actual[field] !== receipt[field]) throw Error(`Served input mismatch ${engine}/${session}/${route}:${field}`);
      }
      loadedInputs++;
    }
  }
}
const result = {status: comparison.status, sourcePinsSha256: frozen.sha256, loadedInputs, comparison};
await writeFile(new URL('REVALIDATION.json', here), JSON.stringify(result, null, 2) + '\n', {flag: 'wx'});
console.log(JSON.stringify({status: result.status, loadedInputs, engines: Object.keys(comparison.engines)}));
if (result.status !== 'passed') process.exitCode = 1;
