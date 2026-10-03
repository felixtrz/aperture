/** All inherited inputs and exact existing native controls remain pinned. */
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, dirname, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { SCHEMA, ENGINE_SOURCE, ENGINE_VERSION, THREE_REVISION, SESSION_IDS, statesFor, BUDGETS, VIEWS } from './contract.mjs';
const here = dirname(fileURLToPath(import.meta.url)), repo = resolve(here, '../..'), old = resolve(repo, 'benchmarks/crane-combined-edits-20261003');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
export async function collectPins() {
  const inherited = JSON.parse(await readFile(resolve(old, 'source-pins.json'))), files = {};
  if (inherited.engineSourceCommit !== ENGINE_SOURCE || inherited.engineVersion !== ENGINE_VERSION) throw Error('Engine provenance mismatch');
  for (const [name, pin] of Object.entries(inherited.files)) {
    const bytes = await readFile(resolve(repo, name));
    if (bytes.length !== pin.bytes || hash(bytes) !== pin.sha256) throw Error('Inherited bytes changed: ' + name);
    files[name] = pin;
  }
  async function pin(path) {
    const bytes = await readFile(path); files[relative(repo, path)] = { bytes: bytes.length, sha256: hash(bytes) };
  }
  async function visit(path, all = false) {
    for (const entry of await readdir(path, { withFileTypes: true })) {
      if (entry.isSymbolicLink()) throw Error('Source symlink');
      const next = resolve(path, entry.name);
      if (entry.isDirectory()) { if (!['renders','lifecycle-audits'].includes(entry.name) || all) await visit(next, all); }
      else if (all || /\.(mjs|py|html|diff)$/.test(entry.name) || ['README.md','derivation.json','frozen-contract.json','source-audit.json','camera-gate-audit.json'].includes(entry.name)) await pin(next);
    }
  }
  await visit(here);
  for (const name of ['source-pins.json','comparison-001.json','native-manifest.json','native-cold-attempt001.json','native-live-attempt001.json','PREPARATION_REPORT.json']) await pin(resolve(old, name));
  for (const engine of ['aperture','threejs']) for (const pose of ['baseline','all']) await visit(resolve(old,'renders',engine,'fresh-'+pose,'attempt-001'),true);
  const comparison = JSON.parse(await readFile(resolve(old, 'comparison-001.json')));
  if (comparison.status !== 'passed') throw Error('Combined native comparison did not pass');
  return { schema: SCHEMA + '.inputs', engineSourceCommit: ENGINE_SOURCE, engineVersion: ENGINE_VERSION, threeRevision: THREE_REVISION, preparationCheckpoint: '097c94acba41431a27cd3030c68d3a6b58db3f4f', preparationTree: 'cb15bb722b8a0bf63fe6a392794f19eab7d2c22e', predecessorEvidenceCommit: 'df4b5b249d8966bb4f74b734a6b3f6fc3abd3786', localHeadUsedAsProvenance: false, inheritedInputsVerified: Object.keys(inherited.files).length, sessions: Object.fromEntries(SESSION_IDS.map(s => [s, statesFor(s)])), budgets: BUDGETS, views: VIEWS, files: Object.fromEntries(Object.entries(files).sort(([a],[b]) => a.localeCompare(b))) };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (process.argv.includes('--check')) { const result = await (await import('./run.mjs')).checkPins(); console.log(JSON.stringify({status:'verified',files:Object.keys(result.pins.files).length,sha256:result.sha256})); }
  else { const pins=await collectPins(), raw=JSON.stringify(pins,null,2)+'\n'; await writeFile(resolve(here,'source-pins.json'),raw,{flag:'wx'}); console.log(JSON.stringify({status:'frozen',files:Object.keys(pins.files).length,sha256:hash(raw)})); }
}
