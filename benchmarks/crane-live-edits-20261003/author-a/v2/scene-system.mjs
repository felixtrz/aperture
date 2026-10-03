import { createSystem, mesh, material, WorldTransform } from '/worker-modules/packages/app/dist/systems.js';
import { createMeshHandle, serializeEntityRef } from '/worker-modules/packages/simulation/dist/index.js';
import { createTriangleListMeshAsset, createExtrudeMeshAsset } from '/worker-modules/packages/render/dist/index.js';
import { STATES, parametersFor } from '/harness/contract.mjs';
import { CONFIG, CAMERAS, PALETTE, constructScene, linearColor } from './scene.mjs';
import { nativeMeshEvidence, compareNativeToSource, jsonValue } from './native-evidence.mjs';

export const LIVE_CHANNEL = 'crane.live.apply';
export let sceneOwner = null;
const sameGeometry = (a, b) => JSON.stringify([a.positions, a.indices, a.extrusion ?? null, a.worldMatrix]) === JSON.stringify([b.positions, b.indices, b.extrusion ?? null, b.worldMatrix]);
export function createPartAsset(part) {
  return part.extrusion ? createExtrudeMeshAsset({ label: part.name, outline: part.extrusion.outline, depth: part.extrusion.depth }) : createTriangleListMeshAsset({ label: part.name, positions: part.positions, indices: part.indices });
}

export class CraneCourtyard extends createSystem({ priority: 0 }) {
  init() {
    if (sceneOwner) throw Error('The persistent worker attempted a second crane scene');
    sceneOwner = this;
    this.originalWorld = this.world;
    this.world.globals.craneLiveSceneId = crypto.randomUUID();
    this.scene = constructScene('baseline');
    this.revision = 0;
    this.stateId = null;
    this.entries = new Map();
    this.counters = { initialMeshAssets: 0, meshAssetReplacements: 0, publishedVertexArrayReplacements: 0, publishedIndexArrayReplacements: 0, entityCreateCalls: 0, entityDestroyCalls: 0 };
    const createEntity = this.world.createEntity;
    this.world.createEntity = (...args) => {
      const entity = createEntity.apply(this.world, args);
      this.counters.entityCreateCalls++;
      const destroy = entity.destroy;
      entity.destroy = (...values) => { this.counters.entityDestroyCalls++; return destroy.apply(entity, values); };
      return entity;
    };
    for (const part of this.scene.parts) {
      const [hex, roughness, metallic] = PALETTE[part.material];
      const entity = this.spawn.mesh({ key: part.name, name: part.name, tags: [part.group], mesh: part.extrusion ? mesh.extrude({ label: part.name, outline: part.extrusion.outline, depth: part.extrusion.depth }) : mesh.triangleList({ label: part.name, positions: part.positions, indices: part.indices }), ...(part.extrusion ? { transform: { translation: [0, 0, part.extrusion.zOffset] } } : {}), material: material.standard({ baseColor: [...linearColor(hex), 1], roughness, metallic, ...(part.material === 'lamp' ? { emissiveFactor: [2.6, 1.8, .75] } : {}) }), castShadow: true, receiveShadow: true });
      const handle = createMeshHandle(`${part.name}.mesh`);
      const asset = this.meshes.get(handle);
      if (!asset) throw Error(`Missing native asset: ${part.name}`);
      this.entries.set(part.name, { entity, handle, originalEntity: entity, asset, assetSerial: ++this.counters.initialMeshAssets, publishes: 0 });
    }
    const view = 'front-quarter';
  this.spawn.camera({key:'camera.main',transform:{translation:CAMERAS[view],lookAt:[0,1.4,0]},camera:{projection:'orthographic',orthographicHeight:10.5,aspect:1,autoAspect:false,near:.1,far:80,clearColor:[.115,.17,.209,1],frustumCulling:true}});
  // Explicit PCSS (type 2): native 32-tap contact-hardening disk. Type 1
  // is fixed PCFSoft and ignores authored radius, so retain PCSS with a
  // wider 16-texel maximum on a 1024 map rather than mislabeling it PCF.
  this.spawn.light({key:'light.key',kind:'directional',color:[1,.89,.72,1],intensity:2.65,transform:{translation:[-4,7,5],lookAt:[0,0,0]},shadow:{mapSize:1024,cascadeCount:1,shadowType:2,strength:.82,filterRadius:16,normalBias:.02,bias:.0006,slopeBias:1,center:[0,1.4,0],orthographicSize:12,near:.1,far:35,lightDistance:15}});
  this.spawn.light({key:'light.cool-fill',kind:'rect-area',color:[.67,.8,1,1],intensity:.85,transform:{translation:[3,6,-4],lookAt:[0,1,0]},light:{width:7,height:7,range:30}});
  this.spawn.light({key:'light.world-fill',kind:'ambient',color:[.42,.54,.66,1],intensity:.65});
  this.spawn.light({key:'light.wall-lamp',kind:'point',color:[1,.55,.22,1],intensity:1.15,transform:{translation:[2.61,1.76,-1.69]},light:{range:1.9}});
    this.initialEntityCount = this.world.entityVersionTrackingSize();
  }
  update() {
    const requests = this.commands.drain(LIVE_CHANNEL);
    if (requests.length > 1) throw Error('Concurrent crane edits are forbidden');
    if (!requests.length) return;
    const request = requests[0], state = STATES[request.index];
    if (!state || request.id !== state.id || request.revision !== state.index + 1 || request.revision !== this.revision + 1) throw Error('Crane revision/state sequence mismatch');
    const next = constructScene(state.edit);
    if (JSON.stringify(next.parameters) !== JSON.stringify(parametersFor(state.edit))) throw Error('Scene parameters differ from frozen contract');
    if (next.parts.length !== this.entries.size) throw Error('Mesh count changed');
    this.lastChangedMeshes = [];
    for (const part of next.parts) {
      const entry = this.entries.get(part.name), previous = this.scene.parts.find(p => p.name === part.name);
      if (!entry || !previous || entry.entity !== entry.originalEntity || !entry.entity.active) throw Error(`Native entity replaced: ${part.name}`);
      if (!sameGeometry(previous, part)) {
        if (JSON.stringify(previous.worldMatrix) !== JSON.stringify(part.worldMatrix)) throw Error('Unexpected transform change in frozen baked-geometry constructor');
        const asset = createPartAsset(part), result = this.meshes.publish(entry.handle, asset);
        if (result.handle.id !== entry.handle.id || this.meshes.get(entry.handle) !== asset) throw Error('Native publish did not preserve the mesh handle');
        this.counters.meshAssetReplacements++;
        this.counters.publishedVertexArrayReplacements += asset.vertexStreams.filter((s, i) => s.data !== entry.asset.vertexStreams[i]?.data).length;
        if (asset.indexBuffer && asset.indexBuffer.data !== entry.asset.indexBuffer?.data) this.counters.publishedIndexArrayReplacements++;
        entry.asset = asset;
        entry.assetSerial = this.counters.initialMeshAssets + this.counters.meshAssetReplacements;
        entry.publishes++;
        this.lastChangedMeshes.push({ name: part.name, version: result.version });
      }
    }
    this.scene = next;
    this.revision = request.revision;
    this.stateId = request.id;
  }
  evidenceAtNativePublication(frame, snapshot) {
    if (this.world !== this.originalWorld) throw Error('Worker ECS world replaced');
    const nativeMeshes = [];
    for (const [name, entry] of this.entries) {
      const native = this.meshes.get(entry.handle), registryEntry = this.assetsRegistry.get(entry.handle);
      if (native !== entry.asset || entry.entity !== entry.originalEntity || !entry.entity.active) throw Error(`Native identity changed: ${name}`);
      const worldMatrix = ['col0', 'col1', 'col2', 'col3'].flatMap(key => Array.from(entry.entity.getVectorView(WorldTransform, key)));
      nativeMeshes.push(nativeMeshEvidence(name, native, worldMatrix, { entityId: serializeEntityRef(entry.entity), meshId: entry.handle.id, assetKey: registryEntry.key ?? `mesh:${entry.handle.id}`, assetVersion: registryEntry.version, assetSerial: entry.assetSerial, publishes: entry.publishes }));
    }
    const nativeChecks = compareNativeToSource(this.scene, nativeMeshes);
    nativeChecks.checks.push({ name: 'real-world-entity-count-stable', ok: this.world.entityVersionTrackingSize() === this.initialEntityCount, actual: this.world.entityVersionTrackingSize(), expected: this.initialEntityCount });
    nativeChecks.ok = nativeChecks.checks.every(c => c.ok);
    return {
      stateId: this.stateId, revision: this.revision, snapshotFrame: frame, snapshotFrameField: snapshot?.frame ?? null,
      parameters: this.scene.parameters,
      identity: { sceneId: this.world.globals.craneLiveSceneId, entityCount: this.world.entityVersionTrackingSize(), meshCount: nativeMeshes.length, meshes: nativeMeshes.map(({ name, entityId, meshId }) => ({ name, entityId, meshId })) },
      sourceGeometry: jsonValue(this.scene), nativeGeometry: { meshes: nativeMeshes }, nativeChecks,
      resources: { ...this.counters, currentMeshAssets: nativeMeshes.length, changedMeshes: this.lastChangedMeshes ?? [], assetVersions: nativeMeshes.map(({ name, assetVersion, assetSerial, publishes }) => ({ name, assetVersion, assetSerial, publishes })), definitions: {
        sceneId: 'UUID allocated once inside and stored on the actual ECS world; original world reference checked at every publication.',
        entityId: 'Native ECS index:generation, obtained from serializeEntityRef; no author-assigned substitute.',
        meshId: 'Native stable MeshHandle.id used by the ECS MeshRenderer and asset registry.',
        entityCount: 'Actual world.entityVersionTrackingSize(), covering live mesh, camera and light entities.',
        meshAssetReplacements: 'Successful meshes.publish calls that replace an existing native MeshAsset object; initial assets are separate.',
        publishedVertexArrayReplacements: 'New published vertex stream typed-array objects, separate from real GPUBuffer counters.',
        publishedIndexArrayReplacements: 'New published native index typed-array objects, excluding nonindexed draws.',
        entityCreateCalls: 'Observed actual world.createEntity calls since author system init, including camera and lights.',
        entityDestroyCalls: 'Observed destroy calls on entities returned by that native world.',
        assetSerial: 'Observation number of actual native MeshAsset object creation/publication; it changes on replacement and is not a mesh identity.'
      } }
    };
  }
}
