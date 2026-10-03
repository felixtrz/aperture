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
const { nativeEvidenceBytes } = await import(evidenceUrl);
const { STATES } = await import(contractUrl);
const { createApertureApp, disposeApertureApp } = await import(pathToFileURL(resolve(repo, 'packages/app/dist/advanced.js')).href);
const results = { cpuOnly: true, nativeGpu: false, purpose: 'Actual CPU native asset raw-byte capture across all frozen states; no upload/browser proof', sceneConstructorByteIdentical: sceneSource === frozenSource, states: [], checks: [], cleanup: null };
let app;
try {
  app = await createApertureApp({ config:CONFIG, systems:[{default:system.CraneCourtyard}] });
  let baseline = null; let baselineRaw = null;
  for (const state of STATES) {
    app.context.commands.queue(system.LIVE_CHANNEL, { id:state.id, index:state.index, revision:state.index+1 });
    app.step(1/60, state.index/60);
    const snapshot = app.extract(state.index);
    const evidence = system.sceneOwner.evidenceAtNativePublication(state.index, snapshot);
    const wire = JSON.parse(JSON.stringify(evidence));
    let rawBytesChecked = 0, rawBuffersChecked = 0, negativeZeros = 0;
    for (const mesh of wire.nativeGeometry.meshes) {
      const asset = system.sceneOwner.entries.get(mesh.name).asset;
      const pairs = mesh.streams.map((stream, index) => [stream, asset.vertexStreams[index].data]);
      if (mesh.indexBuffer) pairs.push([mesh.indexBuffer, asset.indexBuffer.data]);
      for (const [captured, actual] of pairs) {
        const raw = nativeEvidenceBytes(captured);
        const genuine = new Uint8Array(actual.buffer, actual.byteOffset, actual.byteLength);
        if (raw.length !== genuine.length || !raw.every((byte,index) => byte === genuine[index])) throw Error(`Raw native array mismatch: ${mesh.name}`);
        if (captured.dataByteOffset !== actual.byteOffset || captured.dataLength !== actual.length) throw Error('Native view metadata mismatch');
        rawBytesChecked += raw.length; rawBuffersChecked++;
        if (actual instanceof Float32Array) negativeZeros += [...actual].filter(value => Object.is(value,-0)).length;
      }
    }
    const rawComparable = JSON.stringify(wire.nativeGeometry.meshes.map(mesh => ({name:mesh.name,streams:mesh.streams.map(stream=>stream.rawBytes),indices:mesh.indexBuffer?.rawBytes??null})));
    baselineRaw ??= rawComparable;
    if (state.edit === 'baseline' && rawComparable !== baselineRaw) throw Error('Baseline raw bytes did not reset exactly');
    const comparable = JSON.stringify(evidence.nativeGeometry.meshes.map(mesh => ({name:mesh.name,positions:mesh.positions,indices:mesh.indices,worldMatrix:mesh.worldMatrix})));
    baseline ??= { identity:JSON.stringify(evidence.identity), geometry:comparable };
    const identityStable = JSON.stringify(evidence.identity) === baseline.identity;
    const resetEquivalent = state.edit !== 'baseline' || comparable === baseline.geometry;
    const snapshotDrawCount = snapshot.meshDraws.length;
    const entry = { rawBytesChecked, rawBuffersChecked, negativeZeros, rawResetEquivalent:state.edit !== 'baseline' || rawComparable === baselineRaw, id:state.id, revision:evidence.revision, snapshotFrame:snapshot.frame, meshCount:evidence.identity.meshCount, entityCount:evidence.identity.entityCount, nativeChecks:evidence.nativeChecks.checks.length, nativeChecksOk:evidence.nativeChecks.ok, identityStable, resetEquivalent, snapshotDrawCount, resources:evidence.resources };
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
