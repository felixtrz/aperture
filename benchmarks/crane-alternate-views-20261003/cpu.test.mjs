import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { sceneModule, apertureSystem, threeModules, repo, here } from './cpu-loader.mjs';
import * as oldLoader from '../crane-combined-edits-20261003/cpu-loader.mjs';
import { SESSION_IDS, statesFor, VIEWS, POSES, ALTERNATE_VIEWS, parametersFor, BUDGETS } from './contract.mjs';
import { apertureCamera, expectedCamera, matrixNear, validateCameraMatrices, threeCamera } from './camera-proof.mjs';
import { inspectSemantics } from './semantics.mjs';
import { nativeEvidenceBytes } from './author-a/native-evidence.mjs';
import { inspectConsumedSnapshot } from './author-a/frame-proof.mjs';
const json = value => JSON.parse(JSON.stringify(value, (_key, item) => ArrayBuffer.isView(item) ? Array.from(item) : item));
const summary = { scope: 'CPU geometry/camera evidence, no native GPU/browser execution', states: [], semanticChecks: 0, geometryChecks: 0 };
const comparableA = e => e.nativeGeometry.meshes.map(m => ({ name:m.name, positions:m.positions, indices:m.indices, matrix:m.worldMatrix, streams:m.streams, indexBuffer:m.indexBuffer, submeshes:m.submeshes }));
const comparableB = e => e.meshes.map(m => ({ name:m.name, positions:m.positions, normals:m.normals, indices:m.indices, matrix:m.matrix, streams:m.cpuStreams, materials:m.materials, groups:m.groups }));

test('eight exactly bounded cold sessions select only existing catalog cameras and combined poses', () => {
  assert.equal(SESSION_IDS.length * 2, 8); assert.equal(BUDGETS.totalStates, 8);
  for(const id of SESSION_IDS) { const states=statesFor(id);assert.equal(states.length,1);assert(POSES.includes(states[0].edit));assert(ALTERNATE_VIEWS.includes(states[0].view)); }
  for(const invalid of ['live','front-quarter-baseline','rear-quarter-articulation','rear-quarter-baseline-extra',null,{}]) assert.throws(()=>statesFor(invalid));
});

test('both full scene constructors, palettes, settings and poses are exactly unchanged', async () => {
  for(const engine of ['aperture','threejs']) {
    const current=(await sceneModule(engine)).module, prior=(await oldLoader.sceneModule(engine)).module;
    const build=engine==='aperture'?'constructScene':'buildScene';
    for(const pose of POSES) assert.deepEqual(current[build](pose),prior[build](pose));
    for(const key of ['BASELINE','EDITS','CAMERAS','PALETTE']) assert.deepEqual(current[key],prior[key]);
    if(engine==='aperture') assert.deepEqual(current.CONFIG,prior.CONFIG);
    for(const [name,view] of Object.entries(VIEWS)) {
      const camera=current.CAMERAS[name];assert.deepEqual(engine==='aperture'?camera:camera.position,view.position);
      if(engine==='threejs') { assert.deepEqual(camera.target,view.target);assert.equal(camera.vertical_span,view.verticalSpan); }
    }
  }
});

test('actual Aperture ECS camera extraction changes view matrices while exact geometry/raw bytes stay invariant', async () => {
  const {createApertureApp,disposeApertureApp}=await import(pathToFileURL(resolve(repo,'packages/app/dist/advanced.js')));
  const controls=new Map();
  for(const pose of POSES) {
    const {system,scene}=await oldLoader.apertureSystem('fresh-'+pose);let app;
    try { app=await createApertureApp({config:scene.CONFIG,systems:[{default:system.CraneCourtyard}]});const state=(await import('../crane-combined-edits-20261003/contract.mjs')).statesFor('fresh-'+pose)[0];app.context.commands.queue(system.LIVE_CHANNEL,{id:state.id,index:0,revision:1});app.step(1/60,1/60);const s=app.extract(1);const e=system.sceneOwner.evidenceAtNativePublication(s.frame,s);controls.set(pose,{geometry:comparableA(e),camera:apertureCamera(s)}); } finally {if(app)await disposeApertureApp(app);}
  }
  for(const session of SESSION_IDS) {
    const {system,scene}=await apertureSystem(session), state=statesFor(session)[0];let app;
    try {
      app=await createApertureApp({config:scene.CONFIG,systems:[{default:system.CraneCourtyard}]});
      assert.deepEqual(system.sceneOwner.scene.parameters,parametersFor(state.edit));
      app.context.commands.queue(system.LIVE_CHANNEL,{id:state.id,index:0,revision:1});app.step(1/60,1/60);
      const snapshot=app.extract(1),evidence=system.sceneOwner.evidenceAtNativePublication(snapshot.frame,snapshot),camera=apertureCamera(snapshot);
      validateCameraMatrices(camera,'aperture',state.view);assert(!matrixNear(camera.viewMatrix,controls.get(state.edit).camera.viewMatrix));
      assert.deepEqual(camera.projectionMatrix,controls.get(state.edit).camera.projectionMatrix);
      assert.deepEqual(comparableA(evidence),controls.get(state.edit).geometry);
      assert.equal(evidence.resources.meshAssetReplacements,0);assert(evidence.nativeChecks.ok);
      const consumed=inspectConsumedSnapshot(evidence.nativeGeometry.meshes,json(snapshot));assert(consumed.every(c=>c.ok),'Inherited actual consumed mesh gates remain satisfied');
      for(const mesh of evidence.nativeGeometry.meshes) {for(const stream of mesh.streams)nativeEvidenceBytes(stream);if(mesh.indexBuffer)nativeEvidenceBytes(mesh.indexBuffer);}
      const semantics=inspectSemantics('aperture',evidence.sourceGeometry,evidence.nativeGeometry.meshes);assert(semantics.ok);summary.semanticChecks+=semantics.checks.length;summary.geometryChecks+=evidence.nativeChecks.checks.length;
      summary.states.push({engine:'aperture',session,geometryAndRawBytesEqualFrontControl:true,zeroFreshMutations:true,actualMatrices:camera,meshCount:evidence.identity.meshCount});
    } finally {if(app)await disposeApertureApp(app);}
  }
});

test('actual Three.js Mesh/BufferGeometry data stay invariant under the byte-derived native camera selector', async () => {
  const {scene:sourceModule,checks,store:factory,THREE}=await threeModules();
  const text=await readFile(resolve(here,'author-b/scene.mjs'),'utf8');
  const begin=text.indexOf('  const settings = currentData.cameras[VIEW_NAME]'),end=text.indexOf('  const gpuEvidence =',begin);
  assert(begin>0&&end>begin);const cameraCode=text.slice(begin,end);
  // Execute the exact frozen adapter camera construction on CPU, no renderer/browser.
  const cameraFor=new Function('THREE','currentData','VIEW_NAME','scene',cameraCode+'\nreturn camera;');
  for(const pose of POSES) {
    let baseline;
    for(const view of ['front-quarter',...ALTERNATE_VIEWS]) {
      const source=sourceModule.buildScene(pose),scene=new THREE.Scene(),materials=new Map(Object.keys(sourceModule.PALETTE).map(name=>{const m=new THREE.MeshStandardMaterial();m.name=name;return[name,m];}));
      const store=factory.createMeshStore(scene,materials);
      try {
        store.install(source,1);const prior=comparableB(store.cpuSnapshot(source)), camera=cameraFor(THREE,source,view,scene);
        let actual=threeCamera(camera),expected=expectedCamera('threejs',view,'webgl');
        for(const key of ['worldMatrix','viewMatrix','projectionMatrix','viewProjectionMatrix'])assert(matrixNear(actual[key],expected[key]));
        // Native WebGPURenderer performs this convention switch before its callbacks.
        camera.coordinateSystem=THREE.WebGPUCoordinateSystem;camera.updateProjectionMatrix();actual=threeCamera(camera);
        if(view!=='front-quarter')validateCameraMatrices(actual,'threejs',view);
        const cpu=store.cpuSnapshot(source);assert.deepEqual(comparableB(cpu),prior);baseline??=prior;assert.deepEqual(prior,baseline);
        assert.equal(store.counters.inPlaceAttributeWrites,0);assert.equal(store.counters.matrixUpdates,0);
        const checked=checks.inspectScene(cpu);assert(checked.ok);const semantics=inspectSemantics('threejs',source,cpu.meshes);assert(semantics.ok);
        summary.semanticChecks+=semantics.checks.length;summary.geometryChecks+=checked.checks.length;
        if(view!=='front-quarter')summary.states.push({engine:'threejs',session:`${view}-${pose}`,geometryAndRawBytesEqualFrontControl:true,zeroFreshMutations:true,actualMatrices:actual,meshCount:cpu.meshes.length});
      } finally {for(const m of store.meshes)m.geometry.dispose();for(const m of materials.values())m.dispose();}
    }
  }
});
test.after(()=>console.log('CPU_VIEW_SUMMARY '+JSON.stringify(summary)));
