import {
  Enabled,
  type AssetRegistry,
  type Entity,
  type MaterialHandle,
  type Mat4,
  type MeshHandle,
  WorldTransform,
} from "@aperture-engine/simulation";
import type { MeshAsset } from "../mesh/index.js";
import {
  Material,
  Mesh,
  RenderLayer,
  ShadowCaster,
  ShadowReceiver,
  Visibility,
} from "./index.js";
import type { RenderDiagnostic } from "./snapshot.js";
import { diagnostic } from "./extraction-diagnostics.js";
import { parseMaterialHandle, parseMeshHandle } from "./extraction-inputs.js";
import { readWorldMatrix } from "./extraction-matrices.js";

export interface MeshEntityExtractionState {
  readonly layerMask: number;
  readonly castsShadow: boolean;
  readonly receivesShadow: boolean;
  readonly meshHandle: MeshHandle;
  readonly mesh: MeshAsset;
  readonly primaryMaterialHandle: MaterialHandle | null;
  readonly worldMatrix: Mat4;
}

export function readMeshEntityExtractionState(input: {
  readonly entity: Entity;
  readonly assets: AssetRegistry;
  readonly diagnostics: RenderDiagnostic[];
  readonly cameraLayerMask: number;
  readonly diagnoseLayerMismatch?: boolean;
}): MeshEntityExtractionState | null {
  if (
    input.entity.hasComponent(Enabled) &&
    input.entity.getValue(Enabled, "value") === false
  ) {
    input.diagnostics.push(diagnostic("render.disabled", input.entity));
    return null;
  }

  if (
    input.entity.hasComponent(Visibility) &&
    input.entity.getValue(Visibility, "visible") === false
  ) {
    input.diagnostics.push(diagnostic("render.invisible", input.entity));
    return null;
  }

  if (!input.entity.hasComponent(WorldTransform)) {
    input.diagnostics.push(
      diagnostic("render.missingWorldTransform", input.entity),
    );
    return null;
  }

  const layerMask = input.entity.hasComponent(RenderLayer)
    ? (input.entity.getValue(RenderLayer, "mask") ?? 1)
    : 1;
  // Meshes cast by default (glTF-imported meshes carry no ShadowCaster component
  // and rely on this). An explicit opt-out is authored as ShadowCaster{enabled:false}
  // (see spawn.mesh `castShadow: false`), which this reads back as not-casting.
  const castsShadow = input.entity.hasComponent(ShadowCaster)
    ? (input.entity.getValue(ShadowCaster, "enabled") ?? true)
    : true;
  const receivesShadow = input.entity.hasComponent(ShadowReceiver)
    ? (input.entity.getValue(ShadowReceiver, "enabled") ?? true)
    : true;

  if (layerMask === 0) {
    input.diagnostics.push(diagnostic("render.zeroLayerMask", input.entity));
    return null;
  }

  if (
    input.cameraLayerMask !== 0 &&
    (layerMask & input.cameraLayerMask) === 0
  ) {
    if (input.diagnoseLayerMismatch !== false) {
      input.diagnostics.push(diagnostic("render.layerMismatch", input.entity));
    }
    return null;
  }

  const meshHandle = parseMeshHandle(
    input.entity.getValue(Mesh, "meshId") ?? "",
  );
  const meshEntry =
    meshHandle === null
      ? undefined
      : input.assets.get<"mesh", MeshAsset>(meshHandle);

  if (meshHandle === null || meshEntry === undefined) {
    input.diagnostics.push(
      diagnostic("render.missingMeshHandle", input.entity),
    );
    return null;
  }

  if (meshEntry.status !== "ready" || meshEntry.asset === null) {
    input.diagnostics.push(
      diagnostic(`render.mesh.${meshEntry.status}`, input.entity, meshHandle),
    );
    return null;
  }

  return {
    layerMask,
    castsShadow,
    receivesShadow,
    meshHandle,
    mesh: meshEntry.asset,
    primaryMaterialHandle: parseMaterialHandle(
      input.entity.getValue(Material, "materialId") ?? "",
    ),
    worldMatrix: readWorldMatrix(input.entity),
  };
}
