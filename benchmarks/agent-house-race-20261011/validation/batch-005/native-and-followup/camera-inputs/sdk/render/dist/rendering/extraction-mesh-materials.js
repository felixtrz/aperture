import { isCustomWgslMaterialAsset, } from "../materials/index.js";
import { FogMode, MaterialSlots } from "./index.js";
import { diagnostic } from "./extraction-diagnostics.js";
import { parseMaterialHandle } from "./extraction-inputs.js";
export function createExtractedMaterialPipelineKeyInput(input) {
    if (isCustomWgslMaterialAsset(input.material) ||
        input.material.kind !== "standard" ||
        (!input.instanceTint &&
            !input.skinned &&
            !input.morphed &&
            input.fogMode == null)) {
        return input.base;
    }
    const features = new Set(input.base.features);
    if (input.instanceTint) {
        features.add("instance-tint");
    }
    if (input.skinned) {
        features.add("skinned");
    }
    if (input.morphed) {
        features.add("morphed");
    }
    const fogFeature = fogPipelineFeature(input.fogMode);
    if (fogFeature !== null) {
        features.add(fogFeature);
    }
    return {
        ...input.base,
        features: [...features].sort(),
    };
}
export function selectFogModeForLayer(layerMask, fogs) {
    for (const fog of fogs) {
        if ((fog.layerMask & layerMask) !== 0) {
            return fog.mode;
        }
    }
    return null;
}
export function readMaterialSlots(entity, diagnostics) {
    const slots = new Map();
    if (!entity.hasComponent(MaterialSlots)) {
        return slots;
    }
    const slotsJson = entity.getValue(MaterialSlots, "slotsJson") ?? "[]";
    let parsed;
    try {
        parsed = JSON.parse(slotsJson);
    }
    catch {
        diagnostics.push(diagnostic("render.invalidMaterialSlots", entity));
        return slots;
    }
    if (!Array.isArray(parsed)) {
        diagnostics.push(diagnostic("render.invalidMaterialSlots", entity));
        return slots;
    }
    for (const entry of parsed) {
        if (typeof entry !== "object" ||
            entry === null ||
            !Number.isInteger(entry.slot) ||
            (entry.slot ?? -1) < 0 ||
            typeof entry.materialId !== "string") {
            diagnostics.push(diagnostic("render.invalidMaterialSlots", entity));
            continue;
        }
        const slot = entry.slot;
        const material = parseMaterialHandle(entry.materialId);
        if (material === null) {
            diagnostics.push(diagnostic("render.invalidMaterialSlots", entity));
            continue;
        }
        slots.set(slot, material);
    }
    return slots;
}
export function materialQueue(material) {
    switch (material.renderState.alphaMode) {
        case "mask":
            return "alpha-test";
        case "blend":
            return "transparent";
        case "opaque":
            return "opaque";
    }
}
function fogPipelineFeature(mode) {
    switch (mode) {
        case FogMode.Linear:
            return "fogLinear";
        case FogMode.Exp:
            return "fogExp";
        case FogMode.Exp2:
            return "fogExp2";
        case null:
        case undefined:
            return null;
    }
}
//# sourceMappingURL=extraction-mesh-materials.js.map