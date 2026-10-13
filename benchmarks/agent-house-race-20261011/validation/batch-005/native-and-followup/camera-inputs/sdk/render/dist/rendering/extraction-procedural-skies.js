import { Enabled } from "@aperture-engine/simulation";
import { ProceduralSky, ProceduralSkyModel, RenderLayer, Visibility, validateProceduralSkyInput, } from "./index.js";
import { createStableRenderId, } from "./snapshot.js";
import { diagnostic, entityRef } from "./extraction-diagnostics.js";
import { sortedEntities } from "./extraction-entities.js";
import { proceduralSkyInput } from "./extraction-inputs.js";
export function extractProceduralSkies(world, diagnostics, cameraLayerMask) {
    const query = world.queryManager.registerQuery({ required: [ProceduralSky] });
    const packets = [];
    for (const entity of sortedEntities(query.entities)) {
        if (entity.hasComponent(Enabled) &&
            entity.getValue(Enabled, "value") === false) {
            diagnostics.push(diagnostic("render.disabled", entity));
            continue;
        }
        if (entity.hasComponent(Visibility) &&
            entity.getValue(Visibility, "visible") === false) {
            diagnostics.push(diagnostic("render.invisible", entity));
            continue;
        }
        const input = proceduralSkyInput(entity);
        const validation = validateProceduralSkyInput(input);
        const layerMask = entity.hasComponent(RenderLayer)
            ? (entity.getValue(RenderLayer, "mask") ?? 1)
            : 1;
        if (!validation.valid) {
            for (const skyDiagnostic of validation.diagnostics) {
                diagnostics.push(diagnostic(`render.${skyDiagnostic.code}`, entity));
            }
            continue;
        }
        if (layerMask === 0) {
            diagnostics.push(diagnostic("render.zeroLayerMask", entity));
            continue;
        }
        if (cameraLayerMask !== 0 && (layerMask & cameraLayerMask) === 0) {
            diagnostics.push(diagnostic("render.layerMismatch", entity));
            continue;
        }
        packets.push({
            skyId: createStableRenderId(entityRef(entity)),
            entity: entityRef(entity),
            model: input.model ?? ProceduralSkyModel.Gradient,
            priority: input.priority ?? 0,
            topColor: input.topColor ?? [0.015, 0.02, 0.08],
            horizonColor: input.horizonColor ?? [0.04, 0.055, 0.13],
            bottomColor: input.bottomColor ?? [0.006, 0.008, 0.025],
            horizonPosition: input.horizonPosition ?? 0.4,
            horizonSoftness: input.horizonSoftness ?? 0.24,
            intensity: input.intensity ?? 1,
            sunDirection: input.sunDirection ?? [-0.6, 0.4, -0.7],
            sunColor: input.sunColor ?? [1, 0.72, 0.38],
            sunRadius: input.sunRadius ?? 0.02,
            sunGlow: input.sunGlow ?? 0.35,
            ditherStrength: input.ditherStrength ?? 0.003,
            layerMask,
        });
    }
    return packets.sort((a, b) => a.priority === b.priority ? a.skyId - b.skyId : b.priority - a.priority);
}
//# sourceMappingURL=extraction-procedural-skies.js.map