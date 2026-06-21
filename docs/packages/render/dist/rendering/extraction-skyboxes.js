import { Enabled, } from "@aperture-engine/simulation";
import { RenderLayer, Skybox, Visibility, validateSkyboxInput, } from "./index.js";
import { createStableRenderId, } from "./snapshot.js";
import { validateSamplerAssetState, validateSkyboxTextureAssetState, } from "./extraction-asset-validation.js";
import { diagnostic, entityRef } from "./extraction-diagnostics.js";
import { sortedEntities } from "./extraction-entities.js";
import { skyboxInput } from "./extraction-inputs.js";
export function extractSkyboxes(world, assets, diagnostics, cameraLayerMask) {
    const query = world.queryManager.registerQuery({ required: [Skybox] });
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
        const input = skyboxInput(entity);
        const validation = validateSkyboxInput(input);
        const layerMask = entity.hasComponent(RenderLayer)
            ? (entity.getValue(RenderLayer, "mask") ?? 1)
            : 1;
        if (!validation.valid) {
            for (const skyboxDiagnostic of validation.diagnostics) {
                diagnostics.push(diagnostic(`render.${skyboxDiagnostic.code}`, entity));
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
        if (validateSkyboxTextureAssetState(input.texture, assets, entity, diagnostics) === null) {
            continue;
        }
        if (input.sampler !== undefined &&
            input.sampler !== null &&
            !validateSamplerAssetState(input.sampler, assets, entity, diagnostics)) {
            continue;
        }
        packets.push({
            skyboxId: createStableRenderId(entityRef(entity)),
            entity: entityRef(entity),
            texture: input.texture,
            ...(input.sampler === undefined ? {} : { sampler: input.sampler }),
            intensity: entity.getValue(Skybox, "intensity") ?? 1,
            layerMask,
        });
    }
    return packets;
}
//# sourceMappingURL=extraction-skyboxes.js.map