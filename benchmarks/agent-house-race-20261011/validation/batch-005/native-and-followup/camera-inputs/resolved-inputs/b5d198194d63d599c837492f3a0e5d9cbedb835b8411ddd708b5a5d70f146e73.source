import { assetHandleKey } from "@aperture-engine/simulation";
import { materialQueueItemAt } from "./material-queue-scratch.js";
import { materialQueueFamilyFromPipelineKey, sortMaterialQueueItems, } from "./material-queue-ordering.js";
export { createMaterialQueueScratch } from "./material-queue-scratch.js";
export { MATERIAL_QUEUE_PHASE_ORDER, compareStrings, materialQueueFamilyFromPipelineKey, materialQueuePhaseRank, sortMaterialQueueItems, } from "./material-queue-ordering.js";
export { createMaterialQueuePhaseSummary } from "./material-queue-summary.js";
export function writeMaterialQueueFromSnapshot(snapshot, resolvers, scratch) {
    scratch.items.length = 0;
    scratch.diagnostics.length = 0;
    for (const diagnostic of snapshot.diagnostics) {
        scratch.diagnostics.push(diagnostic);
    }
    for (let drawIndex = 0; drawIndex < snapshot.meshDraws.length; drawIndex += 1) {
        const draw = snapshot.meshDraws[drawIndex];
        if (draw === undefined) {
            continue;
        }
        const materialFamily = materialQueueFamilyFromPipelineKey(draw.batchKey.pipelineKey);
        if (materialFamily === null) {
            scratch.diagnostics.push({
                code: "materialQueue.unknownMaterialFamily",
                message: `Render object ${draw.renderId} uses unsupported material family in pipeline key '${draw.batchKey.pipelineKey}'.`,
                severity: "warning",
                entity: draw.entity,
            });
            continue;
        }
        const meshKey = assetHandleKey(draw.mesh);
        const materialKey = assetHandleKey(draw.material);
        const resolverInput = {
            draw,
            drawIndex,
            meshKey,
            materialKey,
            materialFamily,
        };
        const meshResourceKey = resolvers.meshResourceKey(resolverInput);
        const materialResourceKey = resolvers.materialResourceKey(resolverInput);
        if (meshResourceKey === null || materialResourceKey === null) {
            scratch.diagnostics.push({
                code: "materialQueue.missingPreparedResource",
                message: missingPreparedResourceMessage({
                    draw,
                    meshKey,
                    materialKey,
                    meshResourceKey,
                    materialResourceKey,
                }),
                severity: "warning",
                entity: draw.entity,
                assetKey: materialResourceKey === null ? materialKey : meshKey,
            });
            continue;
        }
        const item = materialQueueItemAt(scratch, scratch.items.length);
        const sortKey = item.sortKey;
        sortKey.renderPhase = draw.sortKey.queue;
        sortKey.viewId = draw.sortKey.viewId;
        sortKey.layer = draw.sortKey.layer;
        sortKey.order = draw.sortKey.order;
        sortKey.pipelineKey = draw.batchKey.pipelineKey;
        sortKey.materialResourceKey = materialResourceKey;
        sortKey.meshResourceKey = meshResourceKey;
        sortKey.depth = draw.sortKey.depth;
        sortKey.stableId = draw.sortKey.stableId;
        sortKey.drawIndex = drawIndex;
        item.renderId = draw.renderId;
        item.drawIndex = drawIndex;
        item.entity = draw.entity;
        item.submesh = draw.submesh;
        item.materialSlot = draw.materialSlot;
        assignOptionalNumber(item, "vertexStart", draw.vertexStart);
        assignOptionalNumber(item, "vertexCount", draw.vertexCount);
        assignOptionalNumber(item, "indexStart", draw.indexStart);
        assignOptionalNumber(item, "indexCount", draw.indexCount);
        item.renderPhase = draw.sortKey.queue;
        item.materialFamily = materialFamily;
        item.pipelineKey = draw.batchKey.pipelineKey;
        item.meshKey = meshKey;
        item.materialKey = materialKey;
        item.meshResourceKey = meshResourceKey;
        item.materialResourceKey = materialResourceKey;
        item.meshLayoutKey = draw.batchKey.meshLayoutKey;
        item.topology = draw.batchKey.topology;
        item.depth = draw.sortKey.depth;
        scratch.items.push(item);
    }
    sortMaterialQueueItems(scratch.items);
    return scratch.plan;
}
function assignOptionalNumber(target, key, value) {
    if (value === undefined) {
        delete target[key];
        return;
    }
    target[key] = value;
}
function missingPreparedResourceMessage(input) {
    const missing = [];
    if (input.meshResourceKey === null) {
        missing.push(`mesh resource for '${input.meshKey}'`);
    }
    if (input.materialResourceKey === null) {
        missing.push(`material resource for '${input.materialKey}'`);
    }
    return `Render object ${input.draw.renderId} is missing prepared ${missing.join(" and ")}.`;
}
//# sourceMappingURL=material-queue.js.map