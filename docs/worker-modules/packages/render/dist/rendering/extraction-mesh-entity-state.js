import { Enabled, WorldTransform, } from "/aperture/worker-modules/packages/simulation/dist/index.js";
import { Material, Mesh, RenderLayer, ShadowCaster, ShadowReceiver, Visibility, } from "./index.js";
import { diagnostic } from "./extraction-diagnostics.js";
import { parseMaterialHandle, parseMeshHandle } from "./extraction-inputs.js";
import { readWorldMatrix } from "./extraction-matrices.js";
export function readMeshEntityExtractionState(input) {
    if (input.entity.hasComponent(Enabled) &&
        input.entity.getValue(Enabled, "value") === false) {
        input.diagnostics.push(diagnostic("render.disabled", input.entity));
        return null;
    }
    if (input.entity.hasComponent(Visibility) &&
        input.entity.getValue(Visibility, "visible") === false) {
        input.diagnostics.push(diagnostic("render.invisible", input.entity));
        return null;
    }
    if (!input.entity.hasComponent(WorldTransform)) {
        input.diagnostics.push(diagnostic("render.missingWorldTransform", input.entity));
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
    if (input.cameraLayerMask !== 0 &&
        (layerMask & input.cameraLayerMask) === 0) {
        if (input.diagnoseLayerMismatch !== false) {
            input.diagnostics.push(diagnostic("render.layerMismatch", input.entity));
        }
        return null;
    }
    const meshHandle = parseMeshHandle(input.entity.getValue(Mesh, "meshId") ?? "");
    const meshEntry = meshHandle === null
        ? undefined
        : input.assets.get(meshHandle);
    if (meshHandle === null || meshEntry === undefined) {
        input.diagnostics.push(diagnostic("render.missingMeshHandle", input.entity));
        return null;
    }
    if (meshEntry.status !== "ready" || meshEntry.asset === null) {
        input.diagnostics.push(diagnostic(`render.mesh.${meshEntry.status}`, input.entity, meshHandle));
        return null;
    }
    return {
        layerMask,
        castsShadow,
        receivesShadow,
        meshHandle,
        mesh: meshEntry.asset,
        primaryMaterialHandle: parseMaterialHandle(input.entity.getValue(Material, "materialId") ?? ""),
        worldMatrix: readWorldMatrix(input.entity),
    };
}
//# sourceMappingURL=extraction-mesh-entity-state.js.map