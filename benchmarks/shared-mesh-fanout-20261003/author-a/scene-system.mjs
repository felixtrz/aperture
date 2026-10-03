import {
  createSystem,
  WorldTransform,
} from "/worker-modules/packages/app/dist/systems.js";
import {
  createMeshHandle,
  createMaterialHandle,
  serializeEntityRef,
} from "/worker-modules/packages/simulation/dist/index.js";
import {
  createTriangleListMeshAsset,
  createStandardMaterialAsset,
} from "/worker-modules/packages/render/dist/index.js";
import { STATES, INITIAL_EDIT, SHARED, LIGHT } from "/harness/contract.mjs";
import { CAMERAS, PALETTE, constructScene, linearColor } from "./scene.mjs";
import {
  nativeMeshEvidence,
  compareNativeToSource,
  jsonValue,
} from "./native-evidence.mjs";
export const LIVE_CHANNEL = "crane.live.apply";
export let sceneOwner = null;
export const meshKeyFor = (part) =>
  part.instance === null || SHARED ? part.partName : part.name;
export function createPartAsset(part, label = meshKeyFor(part)) {
  return createTriangleListMeshAsset({
    label,
    positions: part.positions,
    indices: part.indices,
  });
}
export class CraneCourtyard extends createSystem({ priority: 0 }) {
  init() {
    if (sceneOwner) throw Error("Second persistent scene");
    sceneOwner = this;
    this.originalWorld = this.world;
    this.world.globals.craneLiveSceneId = crypto.randomUUID();
    this.scene = constructScene(INITIAL_EDIT);
    this.revision = 0;
    this.stateId = null;
    this.entries = new Map();
    this.fixtureAssets = new Map();
    this.fixtureMaterials = new Map();
    this.publications = [];
    this.counters = {
      initialMeshAssets: 0,
      meshAssetReplacements: 0,
      publishedVertexArrayReplacements: 0,
      publishedIndexArrayReplacements: 0,
      entityCreateCalls: 0,
      entityDestroyCalls: 0,
    };
    const create = this.world.createEntity;
    this.world.createEntity = (...args) => {
      const entity = create.apply(this.world, args);
      this.counters.entityCreateCalls++;
      const destroy = entity.destroy;
      entity.destroy = (...xs) => {
        this.counters.entityDestroyCalls++;
        return destroy.apply(entity, xs);
      };
      return entity;
    };
    for (const part of this.scene.parts) {
      const key = meshKeyFor(part),
        materialKey = part.partName;
      if (!this.fixtureAssets.has(key)) {
        const handle = createMeshHandle(key + ".mesh"),
          asset = createPartAsset(part, key);
        this.assetsRegistry.register(handle);
        this.assetsRegistry.markReady(handle, asset);
        this.fixtureAssets.set(key, {
          handle,
          asset,
          assetSerial: ++this.counters.initialMeshAssets,
          publishes: 0,
        });
      }
      if (!this.fixtureMaterials.has(materialKey)) {
        const [hex, roughness, metallic] = PALETTE[part.material],
          handle = createMaterialHandle(materialKey + ".material");
        this.assetsRegistry.register(handle);
        this.assetsRegistry.markReady(
          handle,
          createStandardMaterialAsset({
            baseColorFactor: [...linearColor(hex), 1],
            roughnessFactor: roughness,
            metallicFactor: metallic,
          }),
        );
        this.fixtureMaterials.set(materialKey, handle);
      }
      const entry = this.fixtureAssets.get(key),
        material = this.fixtureMaterials.get(materialKey);
      const entity = this.spawn.mesh({
        key: part.name,
        name: part.name,
        mesh: entry.handle,
        material,
        transform: { translation: part.translation },
        castShadow: true,
        receiveShadow: true,
      });
      this.entries.set(part.name, {
        entity,
        originalEntity: entity,
        entry,
        material,
      });
    }
    this.spawn.camera({
      key: "camera.main",
      transform: { translation: CAMERAS["front-quarter"], lookAt: [0, 1.4, 0] },
      camera: {
        projection: "orthographic",
        orthographicHeight: 10.5,
        aspect: 1,
        autoAspect: false,
        near: 0.1,
        far: 80,
        clearColor: [0.115, 0.17, 0.209, 1],
        frustumCulling: true,
      },
    });
    this.spawn.light({
      key: "light.key",
      kind: LIGHT.kind,
      color: LIGHT.color,
      intensity: LIGHT.intensity,
      transform: { translation: LIGHT.position, lookAt: LIGHT.target },
      shadow: LIGHT.shadow,
    });
    this.initialEntityCount = this.world.entityVersionTrackingSize();
  }
  update() {
    const requests = this.commands.drain(LIVE_CHANNEL);
    if (requests.length > 1) throw Error("Concurrent edits forbidden");
    if (!requests.length) return;
    const request = requests[0],
      state = STATES[request.index];
    if (
      !state ||
      request.id !== state.id ||
      request.revision !== state.index + 1 ||
      request.revision !== this.revision + 1
    )
      throw Error("revision/state sequence mismatch");
    const next = constructScene(state.edit);
    this.lastChangedMeshes = [];
    if (this.scene.edit !== next.edit) {
      const replaced = new Set();
      for (const part of next.parts.filter((p) => p.instance !== null)) {
        const key = meshKeyFor(part);
        if (replaced.has(key)) continue;
        replaced.add(key);
        const entry = this.fixtureAssets.get(key),
          asset = createPartAsset(part, key),
          result = this.meshes.publish(entry.handle, asset);
        if (
          result.handle.id !== entry.handle.id ||
          this.meshes.get(entry.handle) !== asset
        )
          throw Error("Publication identity failure");
        this.counters.meshAssetReplacements++;
        this.counters.publishedVertexArrayReplacements +=
          asset.vertexStreams.filter(
            (s, i) => s.data !== entry.asset.vertexStreams[i]?.data,
          ).length;
        entry.asset = asset;
        entry.assetSerial =
          this.counters.initialMeshAssets + this.counters.meshAssetReplacements;
        entry.publishes++;
        const record = {
          name: key,
          meshId: entry.handle.id,
          version: result.version,
          revision: request.revision,
        };
        this.lastChangedMeshes.push(record);
        this.publications.push(record);
      }
    }
    this.scene = next;
    this.revision = request.revision;
    this.stateId = request.id;
  }
  evidenceAtNativePublication(frame, snapshot) {
    if (this.world !== this.originalWorld) throw Error("World replaced");
    const nativeMeshes = [];
    for (const part of this.scene.parts) {
      const { entity, originalEntity, entry, material } = this.entries.get(
          part.name,
        ),
        registry = this.assetsRegistry.get(entry.handle);
      if (
        entity !== originalEntity ||
        !entity.active ||
        registry.asset !== entry.asset
      )
        throw Error("Native identity changed");
      const matrix = ["col0", "col1", "col2", "col3"].flatMap((k) =>
        Array.from(entity.getVectorView(WorldTransform, k)),
      );
      nativeMeshes.push(
        nativeMeshEvidence(part.name, entry.asset, matrix, {
          partName: part.partName,
          instance: part.instance,
          assetLabel: entry.asset.label,
          entityId: serializeEntityRef(entity),
          meshId: entry.handle.id,
          materialId: material.id,
          assetKey: registry.key,
          assetVersion: registry.version,
          assetSerial: entry.assetSerial,
          publishes: entry.publishes,
        }),
      );
    }
    const nativeChecks = compareNativeToSource(this.scene, nativeMeshes);
    nativeChecks.checks.push({
      name: "real-entity-count-stable",
      ok: this.initialEntityCount === this.world.entityVersionTrackingSize(),
    });
    nativeChecks.ok = nativeChecks.checks.every((c) => c.ok);
    return {
      stateId: this.stateId,
      revision: this.revision,
      snapshotFrame: frame,
      snapshotFrameField: snapshot.frame,
      shared: SHARED,
      parameters: this.scene.parameters,
      identity: {
        sceneId: this.world.globals.craneLiveSceneId,
        entityCount: this.world.entityVersionTrackingSize(),
        meshCount: nativeMeshes.length,
        meshes: nativeMeshes.map(({ name, entityId, meshId, materialId }) => ({
          name,
          entityId,
          meshId,
          materialId,
        })),
      },
      sourceGeometry: jsonValue(this.scene),
      nativeGeometry: { meshes: nativeMeshes },
      nativeChecks,
      resources: {
        ...this.counters,
        currentMeshAssets: this.fixtureAssets.size,
        changedMeshes: this.lastChangedMeshes ?? [],
        publications: [...this.publications],
        assetVersions: nativeMeshes.map(
          ({ name, meshId, assetVersion, publishes }) => ({
            name,
            meshId,
            assetVersion,
            publishes,
          }),
        ),
      },
    };
  }
}
