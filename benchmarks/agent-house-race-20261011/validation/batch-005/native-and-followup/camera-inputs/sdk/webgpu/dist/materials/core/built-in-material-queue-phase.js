import { parseMaterialPipelineRenderStateTokens } from "./material-render-state.js";
export function createUnsupportedBuiltInMaterialQueuePhaseDiagnostic(queueItem) {
    if (queueItem.renderPhase === "opaque") {
        return null;
    }
    if (queueItem.renderPhase === "alpha-test" &&
        queueItem.materialFamily === "standard") {
        return null;
    }
    if (queueItem.renderPhase === "alpha-test") {
        return {
            code: "webGpuApp.unsupportedMaterialQueueAlphaTestFamily",
            renderId: queueItem.renderId,
            drawIndex: queueItem.drawIndex,
            renderPhase: queueItem.renderPhase,
            materialFamily: queueItem.materialFamily,
            ...optionalEntity(queueItem),
            message: `WebGPU app material queue routing supports alpha-test draws for StandardMaterial, not '${queueItem.materialFamily}'.`,
        };
    }
    if (queueItem.renderPhase === "transparent" &&
        (queueItem.materialFamily === "standard" ||
            queueItem.materialFamily === "unlit")) {
        const tokens = parseMaterialPipelineRenderStateTokens(queueItem.pipelineKey);
        if (tokens.blendPreset === "alpha") {
            return null;
        }
        return {
            code: "webGpuApp.unsupportedMaterialQueueBlendPreset",
            renderId: queueItem.renderId,
            drawIndex: queueItem.drawIndex,
            renderPhase: queueItem.renderPhase,
            materialFamily: queueItem.materialFamily,
            blendPreset: tokens.blendPreset,
            ...optionalEntity(queueItem),
            message: `WebGPU app material queue routing supports transparent ${materialFamilyLabel(queueItem.materialFamily)} draws with alpha blending, not blend preset '${String(tokens.blendPreset)}'.`,
        };
    }
    if (queueItem.renderPhase === "transparent") {
        return {
            code: "webGpuApp.unsupportedMaterialQueueTransparentFamily",
            renderId: queueItem.renderId,
            drawIndex: queueItem.drawIndex,
            renderPhase: queueItem.renderPhase,
            materialFamily: queueItem.materialFamily,
            ...optionalEntity(queueItem),
            message: `WebGPU app material queue routing supports transparent draws for StandardMaterial and UnlitMaterial, not '${queueItem.materialFamily}'.`,
        };
    }
    return {
        code: "webGpuApp.unsupportedMaterialQueuePhase",
        renderId: queueItem.renderId,
        drawIndex: queueItem.drawIndex,
        renderPhase: queueItem.renderPhase,
        materialFamily: queueItem.materialFamily,
        ...optionalEntity(queueItem),
        message: `WebGPU app material queue routing currently supports opaque and StandardMaterial alpha-test draws, not '${queueItem.renderPhase}'.`,
    };
}
function optionalEntity(queueItem) {
    return queueItem.entity === undefined ? {} : { entity: queueItem.entity };
}
function materialFamilyLabel(family) {
    switch (family) {
        case "standard":
            return "StandardMaterial";
        case "unlit":
            return "UnlitMaterial";
        default:
            return family;
    }
}
//# sourceMappingURL=built-in-material-queue-phase.js.map