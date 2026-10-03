import {
  createBoxMeshAsset,
  createRenderAssetCollections,
  createStandardMaterialAsset,
} from "../../packages/render/dist/index.js";
import {
  createExtractionApp,
  withCamera,
  withLight,
  withLightShadowSettings,
  withMaterial,
  withMesh,
  withRenderLayer,
  withShadowCaster,
  withShadowReceiver,
  withTransform,
  withVisibility,
} from "../../packages/runtime/dist/index.js";
import { createMeshAccess } from "../../packages/app/dist/systems.js";
import { quatLookAt } from "../../packages/math/dist/index.js";
import { serializeEntityRef } from "../../packages/simulation/dist/index.js";

export const MODES = Object.freeze([
  "directional",
  "cascaded",
  "spot",
  "point",
]);
export const STATES = Object.freeze([
  { id: "baseline", shape: "baseline", version: 1, reuse: false },
  { id: "noop", shape: "baseline", version: 1, reuse: true },
  { id: "vertices", shape: "vertices", version: 2, reuse: false },
  { id: "vertices-noop", shape: "vertices", version: 2, reuse: true },
  { id: "vertex-reset", shape: "baseline", version: 3, reuse: false },
  { id: "indices", shape: "indices", version: 4, reuse: false },
  { id: "indices-noop", shape: "indices", version: 4, reuse: true },
  { id: "index-reset", shape: "baseline", version: 5, reuse: false },
  { id: "reset-noop", shape: "baseline", version: 5, reuse: true },
]);
export const SIZE = 512;
export const LABEL = "matrix-caster";
export const CAMERA = Object.freeze({
  position: [5, 6, 8],
  target: [0, 0.6, 0],
  height: 8,
  near: 0.1,
  far: 30,
});

// Two boxes share one 48-vertex pool. Exactly one box is referenced by the
// fixed 36-index draw. Index-only publication selects the second box; vertex-only
// publication translates the first. Bounds conservatively contain every state.
export function casterAsset(shape = "baseline") {
  if (!["baseline", "vertices", "indices"].includes(shape))
    throw Error("Unknown shape");
  const box = createBoxMeshAsset({
    label: LABEL,
    width: 0.85,
    height: 1.25,
    depth: 0.85,
  });
  const stream = box.vertexStreams[0],
    half = stream.data.length;
  const data = new Float32Array(half * 2);
  for (let part = 0; part < 2; part++) {
    data.set(stream.data, part * half);
    for (let offset = part * half; offset < (part + 1) * half; offset += 8) {
      data[offset] += part === 0 ? -0.85 : 0.85;
      data[offset + 1] += 1.5;
      data[offset + 2] += shape === "vertices" && part === 0 ? -1 : 0;
    }
  }
  const indices = new Uint16Array(box.indexBuffer.data).map(
    (index) => index + (shape === "indices" ? 24 : 0),
  );
  return {
    ...box,
    vertexStreams: [{ ...stream, data, vertexCount: 48 }],
    indexBuffer: { ...box.indexBuffer, data: indices },
    submeshes: box.submeshes.map((submesh) => ({
      ...submesh,
      vertexCount: 48,
    })),
    localAabb: { min: [-2, 0.5, -2], max: [2, 2.5, 2] },
    localSphere: { center: [0, 1.5, 0], radius: 3 },
  };
}

export function createFixture(mode, shape = "baseline") {
  if (!MODES.includes(mode)) throw Error("Unknown light mode");
  const extraction = createExtractionApp({
    worldOptions: { entityCapacity: 16 },
  });
  const assets = createRenderAssetCollections({ registry: extraction.assets });
  const mesh = assets.meshes.add(casterAsset(shape));
  const material = assets.materials.standard.add(
    createStandardMaterialAsset({
      baseColorFactor: [0.55, 0.2, 0.06, 1],
      roughnessFactor: 1,
      metallicFactor: 0,
    }),
  );
  const caster = extraction.spawn(
    withTransform(),
    withMesh(mesh),
    withMaterial(material),
    withRenderLayer(1),
    withVisibility(),
    withShadowCaster(true),
    withShadowReceiver(true),
  );
  const floorMesh = assets.meshes.add(
    createBoxMeshAsset({
      label: "matrix-floor",
      width: 9,
      height: 0.15,
      depth: 9,
    }),
  );
  const floorMaterial = assets.materials.standard.add(
    createStandardMaterialAsset({
      baseColorFactor: [0.55, 0.58, 0.62, 1],
      roughnessFactor: 1,
      metallicFactor: 0,
    }),
  );
  extraction.spawn(
    withTransform({ translation: [0, -0.075, 0] }),
    withMesh(floorMesh),
    withMaterial(floorMaterial),
    withRenderLayer(1),
    withVisibility(),
    withShadowCaster(false),
    withShadowReceiver(true),
  );
  extraction.spawn(
    withTransform({
      translation: CAMERA.position,
      rotation: quatLookAt(CAMERA.position, CAMERA.target),
    }),
    withCamera({
      projection: "orthographic",
      orthographicHeight: CAMERA.height,
      aspect: 1,
      near: CAMERA.near,
      far: CAMERA.far,
      clearColor: [0.08, 0.1, 0.14, 1],
      frustumCulling: false,
      layerMask: 1,
    }),
  );
  const kind = mode === "cascaded" ? "directional" : mode;
  const lightPosition = [-3, 6, 4],
    lightTarget = [0, 0, 0];
  extraction.spawn(
    withTransform({
      translation: lightPosition,
      rotation: quatLookAt(lightPosition, lightTarget),
    }),
    withLight({
      kind,
      color: [1, 0.95, 0.85, 1],
      intensity: 3,
      range: 25,
      innerConeAngle: 0.5,
      outerConeAngle: 1,
      layerMask: 1,
    }),
    withLightShadowSettings({
      enabled: true,
      cascadeCount: mode === "cascaded" ? 2 : 1,
      mapSize: 512,
      shadowType: 0,
      strength: 0.9,
      bias: 0.0005,
      normalBias: 0.015,
      filterRadius: 1,
      center: [0, 1, 0],
      orthographicSize: 10,
      near: 0.1,
      far: 30,
      lightDistance: 12,
      casterLayerMask: 1,
      receiverLayerMask: 1,
    }),
  );
  extraction.spawn(
    withTransform(),
    withLight({
      kind: "ambient",
      color: [0.7, 0.8, 1, 1],
      intensity: 0.3,
      layerMask: 1,
    }),
  );
  const access = createMeshAccess(extraction.assets);
  const entityId = serializeEntityRef(caster),
    entityCount = extraction.world.entityVersionTrackingSize();
  return {
    extraction,
    mesh,
    caster,
    entityId,
    entityCount,
    mode,
    materialHandles: [material, floorMaterial],
    publish(next) {
      const result = access.publish(mesh, casterAsset(next));
      if (result.handle.id !== mesh.id) throw Error("Mesh handle changed");
      return result.version;
    },
    asset() {
      return access.get(mesh);
    },
    version() {
      return extraction.assets.get(mesh).version;
    },
    snapshot(frame) {
      return extraction.stepAndExtract(1 / 60, frame / 60, frame);
    },
    identity() {
      return {
        entityId: serializeEntityRef(caster),
        meshId: mesh.id,
        entityCount: extraction.world.entityVersionTrackingSize(),
        entityActive: caster.active,
      };
    },
  };
}
