import { CameraProjection, } from "./authoring-types.js";
import { createCamera } from "./authoring-create.js";
import { tuple4, validateRect } from "./authoring-utils.js";
export function validateCameraInput(input) {
    const camera = createCamera(input);
    const projection = camera.projection ?? CameraProjection.Perspective;
    const fovYRadians = camera.fovYRadians ?? Math.PI / 3;
    const aspect = camera.aspect ?? 1;
    const near = camera.near ?? 0.1;
    const far = camera.far ?? 1000;
    const orthographicHeight = camera.orthographicHeight ?? 10;
    const viewport = camera.viewport ?? tuple4(0, 0, 1, 1);
    const scissor = camera.scissor ?? tuple4(0, 0, 1, 1);
    const layerMask = camera.layerMask ?? 1;
    const temporalJitterX = camera.temporalJitterX ?? 0;
    const temporalJitterY = camera.temporalJitterY ?? 0;
    const diagnostics = [];
    if (projection === CameraProjection.Perspective &&
        (fovYRadians <= 0 || fovYRadians >= Math.PI || aspect <= 0)) {
        diagnostics.push({
            code: "camera.invalidProjection",
            field: "projection",
            message: "Perspective cameras require 0 < fovYRadians < PI and aspect > 0.",
        });
    }
    if (projection === CameraProjection.Orthographic && orthographicHeight <= 0) {
        diagnostics.push({
            code: "camera.invalidProjection",
            field: "orthographicHeight",
            message: "Orthographic cameras require orthographicHeight > 0.",
        });
    }
    if (near <= 0 || far <= near) {
        diagnostics.push({
            code: "camera.invalidClipRange",
            field: "near/far",
            message: "Cameras require near > 0 and far > near.",
        });
    }
    validateRect(viewport, "viewport", diagnostics);
    validateRect(scissor, "scissor", diagnostics);
    if (layerMask === 0) {
        diagnostics.push({
            code: "camera.zeroLayerMask",
            field: "layerMask",
            message: "Camera layerMask must not be zero.",
        });
    }
    if (!Number.isFinite(temporalJitterX) || !Number.isFinite(temporalJitterY)) {
        diagnostics.push({
            code: "camera.invalidTemporalJitter",
            field: "temporalJitter",
            message: "Camera temporalJitter values must be finite numbers.",
        });
    }
    return { valid: diagnostics.length === 0, diagnostics };
}
//# sourceMappingURL=authoring-validation-camera.js.map