import { Enabled } from "@aperture-engine/simulation";
import { Fog, FogMode, RenderLayer, Visibility, validateFogInput, } from "./index.js";
import { createStableRenderId, } from "./snapshot.js";
import { diagnostic, entityRef } from "./extraction-diagnostics.js";
import { sortedEntities } from "./extraction-entities.js";
import { fogInput } from "./extraction-inputs.js";
export function extractFogs(world, diagnostics, cameraLayerMask) {
    const query = world.queryManager.registerQuery({ required: [Fog] });
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
        const input = fogInput(entity);
        const validation = validateFogInput(input);
        const layerMask = entity.hasComponent(RenderLayer)
            ? (entity.getValue(RenderLayer, "mask") ?? 1)
            : 1;
        if (!validation.valid) {
            for (const fogDiagnostic of validation.diagnostics) {
                diagnostics.push(diagnostic(`render.${fogDiagnostic.code}`, entity));
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
            fogId: createStableRenderId(entityRef(entity)),
            entity: entityRef(entity),
            mode: input.mode ?? FogMode.Linear,
            color: Array.from(entity.getVectorView(Fog, "color")),
            density: entity.getValue(Fog, "density") ?? 0,
            start: entity.getValue(Fog, "start") ?? 1,
            end: entity.getValue(Fog, "end") ?? 1000,
            layerMask,
        });
    }
    return packets;
}
//# sourceMappingURL=extraction-fogs.js.map