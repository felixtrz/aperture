import { FogMode } from "./authoring.js";
import { VIEW_PROJECTION_FLOAT_COUNT } from "./view-pack-types.js";
export function hasMatrixRange(values, sourceOffset) {
    return (sourceOffset >= 0 &&
        sourceOffset + VIEW_PROJECTION_FLOAT_COUNT <= values.length);
}
export function writePreviousViewProjection(target, targetOffset, viewMatrices, view, previousViewProjectionByViewId) {
    const previous = previousViewProjectionByViewId?.get(view.viewId);
    if (previous !== undefined &&
        previous.length >= VIEW_PROJECTION_FLOAT_COUNT) {
        target.set(previous.subarray(0, VIEW_PROJECTION_FLOAT_COUNT), targetOffset);
        return;
    }
    target.set(viewMatrices.subarray(view.viewProjectionMatrixOffset, view.viewProjectionMatrixOffset + VIEW_PROJECTION_FLOAT_COUNT), targetOffset);
}
export function writeCameraPosition(target, targetOffset, viewMatrices, viewMatrixOffset) {
    const tx = viewMatrices[viewMatrixOffset + 12] ?? 0;
    const ty = viewMatrices[viewMatrixOffset + 13] ?? 0;
    const tz = viewMatrices[viewMatrixOffset + 14] ?? 0;
    target[targetOffset] = -((viewMatrices[viewMatrixOffset] ?? 1) * tx +
        (viewMatrices[viewMatrixOffset + 1] ?? 0) * ty +
        (viewMatrices[viewMatrixOffset + 2] ?? 0) * tz);
    target[targetOffset + 1] = -((viewMatrices[viewMatrixOffset + 4] ?? 0) * tx +
        (viewMatrices[viewMatrixOffset + 5] ?? 1) * ty +
        (viewMatrices[viewMatrixOffset + 6] ?? 0) * tz);
    target[targetOffset + 2] = -((viewMatrices[viewMatrixOffset + 8] ?? 0) * tx +
        (viewMatrices[viewMatrixOffset + 9] ?? 0) * ty +
        (viewMatrices[viewMatrixOffset + 10] ?? 1) * tz);
    target[targetOffset + 3] = 1;
}
export function writeFogParameters(target, colorOffset, paramsOffset, fogs, view) {
    const fog = selectFogForView(fogs, view);
    if (fog === null) {
        target[colorOffset] = 0;
        target[colorOffset + 1] = 0;
        target[colorOffset + 2] = 0;
        target[colorOffset + 3] = 0;
        target[paramsOffset] = 0;
        target[paramsOffset + 1] = 0;
        target[paramsOffset + 2] = 0;
        target[paramsOffset + 3] = 0;
        return;
    }
    target[colorOffset] = fog.color[0] ?? 0;
    target[colorOffset + 1] = fog.color[1] ?? 0;
    target[colorOffset + 2] = fog.color[2] ?? 0;
    target[colorOffset + 3] = fog.color[3] ?? 1;
    target[paramsOffset] = fogModeId(fog.mode);
    target[paramsOffset + 1] = fog.density;
    target[paramsOffset + 2] = fog.start;
    target[paramsOffset + 3] = fog.end;
}
function selectFogForView(fogs, view) {
    for (const fog of fogs) {
        if ((fog.layerMask & view.layerMask) !== 0) {
            return fog;
        }
    }
    return null;
}
function fogModeId(mode) {
    switch (mode) {
        case FogMode.Linear:
            return 1;
        case FogMode.Exp:
            return 2;
        case FogMode.Exp2:
            return 3;
    }
}
//# sourceMappingURL=view-pack-writers.js.map