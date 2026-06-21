import { WorldTransform, identityMat4, invertMat4, makeOrthographic, makePerspective, multiplyMat4, } from "/aperture/worker-modules/packages/simulation/dist/index.js";
import { Camera, validateCameraInput } from "./index.js";
import { createStableRenderId, } from "./snapshot.js";
import { createFrustumPlanes, } from "./extraction-culling.js";
import { diagnostic, entityRef } from "./extraction-diagnostics.js";
import { sortedEntities } from "./extraction-entities.js";
import { applyTemporalJitter, cameraInput, readCameraNumber, readRenderTarget, } from "./extraction-inputs.js";
import { pushMatrix, readWorldMatrix } from "./extraction-matrices.js";
export function extractViews(world, viewMatrices, diagnostics, viewCullContexts) {
    const query = world.queryManager.registerQuery({ required: [Camera] });
    const views = [];
    for (const entity of sortedEntities(query.entities)) {
        if (!entity.hasComponent(WorldTransform)) {
            diagnostics.push(diagnostic("render.cameraMissingTransform", entity));
            continue;
        }
        const validation = validateCameraInput(cameraInput(entity));
        if (!validation.valid) {
            for (const cameraDiagnostic of validation.diagnostics) {
                diagnostics.push(diagnostic(`render.${cameraDiagnostic.code}`, entity));
            }
            continue;
        }
        const layerMask = entity.getValue(Camera, "layerMask") ?? 1;
        const camera = entityRef(entity);
        const viewId = createStableRenderId(camera);
        const priority = entity.getValue(Camera, "priority") ?? 0;
        const worldMatrix = readWorldMatrix(entity);
        const viewMatrix = invertMat4(worldMatrix) ?? identityMat4();
        const projection = entity.getValue(Camera, "projection");
        const renderTarget = readRenderTarget(entity, diagnostics);
        const projectionMatrix = projection === "orthographic"
            ? makeOrthographic(-readCameraNumber(entity, "aspect") *
                readCameraNumber(entity, "orthographicHeight") *
                0.5, readCameraNumber(entity, "aspect") *
                readCameraNumber(entity, "orthographicHeight") *
                0.5, -readCameraNumber(entity, "orthographicHeight") * 0.5, readCameraNumber(entity, "orthographicHeight") * 0.5, readCameraNumber(entity, "near"), readCameraNumber(entity, "far"))
            : makePerspective(readCameraNumber(entity, "fovYRadians"), readCameraNumber(entity, "aspect"), readCameraNumber(entity, "near"), readCameraNumber(entity, "far"));
        applyTemporalJitter(projectionMatrix, entity);
        const viewProjectionMatrix = multiplyMat4(projectionMatrix, viewMatrix);
        const viewOffset = pushMatrix(viewMatrices, viewMatrix);
        const projectionOffset = pushMatrix(viewMatrices, projectionMatrix);
        const viewProjectionOffset = pushMatrix(viewMatrices, viewProjectionMatrix);
        viewCullContexts.push({
            viewId,
            camera,
            priority,
            layerMask,
            viewMatrix,
            frustumCulling: entity.getValue(Camera, "frustumCulling") !== false,
            planes: createFrustumPlanes(viewProjectionMatrix),
            stats: {
                viewId,
                camera,
                tested: 0,
                culled: 0,
                included: 0,
            },
        });
        views.push({
            viewId,
            camera,
            priority,
            layerMask,
            viewMatrixOffset: viewOffset,
            projectionMatrixOffset: projectionOffset,
            viewProjectionMatrixOffset: viewProjectionOffset,
            viewport: Array.from(entity.getVectorView(Camera, "viewport")),
            scissor: Array.from(entity.getVectorView(Camera, "scissor")),
            clearColor: Array.from(entity.getVectorView(Camera, "clearColor")),
            clearDepth: entity.getValue(Camera, "clearDepth") ?? 1,
            clearStencil: entity.getValue(Camera, "clearStencil") ?? 0,
            renderTarget,
        });
    }
    viewCullContexts.sort((a, b) => a.priority - b.priority || a.viewId - b.viewId);
    return views.sort((a, b) => a.priority - b.priority || a.viewId - b.viewId);
}
//# sourceMappingURL=extraction-views.js.map