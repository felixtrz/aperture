/** CPU-only native app test. No browser, server, process, or temporary fixture. */
import { readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve, dirname } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '../../../../');
const asModule = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const localEngineImports = source => source.replaceAll("'/worker-modules/", `'${pathToFileURL(repo).href}/`);
const sceneSource = await readFile(resolve(here, 'scene.mjs'), 'utf8');
const frozenSource = await readFile(resolve(repo, 'benchmarks/crane-wall-continuity-20261003/sources/a-continuous-front-quarter/scene.mjs'), 'utf8');
const sceneUrl = asModule(localEngineImports(sceneSource));
const evidenceUrl = asModule(await readFile(resolve(here, 'native-evidence.mjs'), 'utf8'));
const contractUrl = pathToFileURL(resolve(repo, 'benchmarks/crane-live-edits-20261003/harness/contract.mjs')).href;
const systemSource = localEngineImports(await readFile(resolve(here, 'scene-system.mjs'), 'utf8')).replaceAll("'./scene.mjs'", `'${sceneUrl}'`).replaceAll("'./native-evidence.mjs'", `'${evidenceUrl}'`).replaceAll("'/harness/contract.mjs'", `'${contractUrl}'`);
const system = await import(asModule(systemSource));
const { CONFIG } = await import(sceneUrl);
const { STATES } = await import(contractUrl);
const { createApertureApp, disposeApertureApp } = await import(pathToFileURL(resolve(repo, 'packages/app/dist/advanced.js')).href);
const results = { cpuOnly: true, sceneConstructorByteIdentical: sceneSource === frozenSource, states: [], checks: [], cleanup: null };
let app;
try {
  app = await createApertureApp({ config:CONFIG, systems:[{default:system.CraneCourtyard}] });
  let baseline = null;
  for (const state of STATES) {
    app.context.commands.queue(system.LIVE_CHANNEL, { id:state.id, index:state.index, revision:state.index+1 });
    app.step(1/60, state.index/60);
    const snapshot = app.extract(state.index);
    const evidence = system.sceneOwner.evidenceAtNativePublication(state.index, snapshot);
    const comparable = JSON.stringify(evidence.nativeGeometry.meshes.map(mesh => ({name:mesh.name,positions:mesh.positions,indices:mesh.indices,worldMatrix:mesh.worldMatrix})));
    baseline ??= { identity:JSON.stringify(evidence.identity), geometry:comparable };
    const identityStable = JSON.stringify(evidence.identity) === baseline.identity;
    const resetEquivalent = state.edit !== 'baseline' || comparable === baseline.geometry;
    const snapshotDrawCount = snapshot.meshDraws.length;
    const entry = { id:state.id, revision:evidence.revision, snapshotFrame:snapshot.frame, meshCount:evidence.identity.meshCount, entityCount:evidence.identity.entityCount, nativeChecks:evidence.nativeChecks.checks.length, nativeChecksOk:evidence.nativeChecks.ok, identityStable, resetEquivalent, snapshotDrawCount, resources:evidence.resources };
    results.states.push(entry);
    if (!evidence.nativeChecks.ok || !identityStable || !resetEquivalent || snapshotDrawCount !== evidence.identity.meshCount) throw Error(`CPU validation failed at ${state.id}: ${JSON.stringify(evidence.nativeChecks.checks.filter(c=>!c.ok))}`);
  }
  results.checks.push({name:'all-29-states',ok:results.states.length===29});
  results.checks.push({name:'byte-identical-frozen-constructor',ok:results.sceneConstructorByteIdentical});
} catch (error) {
  results.error = String(error.stack ?? error);
  process.exitCode = 1;
} finally {
  if (app) {
    try { await disposeApertureApp(app); results.cleanup = { disposed:true }; }
    catch(error) { results.cleanup = {disposed:false,error:String(error.stack??error)}; process.exitCode=1; }
  }
}
results.ok = !results.error && results.sceneConstructorByteIdentical && results.states.length === 29 && results.cleanup?.disposed === true;
console.log(JSON.stringify(results,null,2));
