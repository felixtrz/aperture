import { requiredBindGroupGroupsForPipelineKey } from "../../materials/core/material-pipeline-selection.js";
import { skinningJointBufferResourceKeyForRenderId } from "../../resources/attributes/skinning-joint-buffer.js";
export const DRAW_ORDER_WORLD_TRANSFORM_BIND_GROUP_SCOPE_KEY = "__aperture_draw_order_world_transforms__";
export function planRenderPassDrawList(options) {
    const scratch = createRenderPassDrawListScratch();
    writeRenderPassDrawList(options, scratch);
    return scratch.plan;
}
export function createRenderPassDrawListScratch(capacity = 0) {
    const draws = [];
    const diagnostics = [];
    const drawPool = [];
    for (let i = 0; i < capacity; i += 1) {
        drawPool.push(createEmptyDrawListRecord());
    }
    return {
        draws,
        diagnostics,
        drawPool,
        pipelineKeys: new Set(),
        resolvedBindGroups: [],
        plan: { valid: true, draws, diagnostics },
    };
}
export function writeRenderPassDrawList(options, scratch) {
    scratch.draws.length = 0;
    scratch.diagnostics.length = 0;
    scratch.pipelineKeys.clear();
    for (const pipeline of options.pipelines) {
        if (pipeline.ok) {
            scratch.pipelineKeys.add(pipeline.key);
        }
    }
    for (const command of options.drawCommands) {
        let ready = true;
        const requiredGroups = options.requiredBindGroupGroups ??
            command.requiredBindGroupGroups ??
            requiredBindGroupGroupsForPipelineKey(command.pipelineKey);
        if (!scratch.pipelineKeys.has(command.pipelineKey)) {
            scratch.diagnostics.push({
                code: "renderPassDrawList.missingPipelineResource",
                renderId: command.renderId,
                pipelineKey: command.pipelineKey,
                message: `Missing render pipeline resource '${command.pipelineKey}' for render id ${command.renderId}.`,
            });
            ready = false;
        }
        const bindGroups = resolveBindGroups(command, options.bindGroups, requiredGroups, scratch);
        if (bindGroups.length !== requiredGroups.length) {
            ready = false;
        }
        if (!ready) {
            continue;
        }
        const previous = scratch.draws[scratch.draws.length - 1];
        if (canCoalesceDrawListRecord(previous, command, bindGroups)) {
            previous.instanceCount += 1;
            continue;
        }
        const record = drawListRecordAt(scratch, scratch.draws.length);
        record.renderId = command.renderId;
        record.pipelineKey = command.pipelineKey;
        record.bindGroupKeys.length = 0;
        for (const bindGroup of bindGroups) {
            record.bindGroupKeys.push(bindGroup.resourceKey);
        }
        record.meshResourceKey = command.meshResourceKey;
        record.materialResourceKey = command.materialResourceKey;
        record.vertexBufferKeys.length = 0;
        for (const vertexBufferKey of command.vertexBufferKeys) {
            record.vertexBufferKeys.push(vertexBufferKey);
        }
        record.vertexCount = command.vertexCount;
        record.vertexStart = command.vertexStart ?? 0;
        record.indexBufferKey = command.indexBufferKey;
        record.indexCount = command.indexCount;
        record.indexStart = command.indexStart ?? null;
        record.instanceCount = 1;
        record.transformPackedOffset = command.transformPackedOffset;
        if (command.occlusionQuery === true) {
            record.occlusionQuery = true;
        }
        else {
            delete record.occlusionQuery;
        }
        scratch.draws.push(record);
    }
    scratch.plan.valid =
        scratch.diagnostics.length === 0;
    return scratch.plan;
}
function canCoalesceDrawListRecord(previous, command, bindGroups) {
    if (previous === undefined) {
        return false;
    }
    return (previous.pipelineKey === command.pipelineKey &&
        previous.meshResourceKey === command.meshResourceKey &&
        previous.materialResourceKey === command.materialResourceKey &&
        previous.vertexCount === command.vertexCount &&
        previous.vertexStart === (command.vertexStart ?? 0) &&
        previous.indexBufferKey === command.indexBufferKey &&
        previous.indexCount === command.indexCount &&
        previous.indexStart === (command.indexStart ?? null) &&
        previous.occlusionQuery !== true &&
        command.occlusionQuery !== true &&
        previous.transformPackedOffset + previous.instanceCount * 16 ===
            command.transformPackedOffset &&
        stringArraysMatch(previous.vertexBufferKeys, command.vertexBufferKeys) &&
        bindGroupKeysMatch(previous.bindGroupKeys, bindGroups));
}
function stringArraysMatch(a, b) {
    if (a.length !== b.length) {
        return false;
    }
    for (let index = 0; index < a.length; index += 1) {
        if (a[index] !== b[index]) {
            return false;
        }
    }
    return true;
}
function bindGroupKeysMatch(a, b) {
    if (a.length !== b.length) {
        return false;
    }
    for (let index = 0; index < a.length; index += 1) {
        if (a[index] !== b[index]?.resourceKey) {
            return false;
        }
    }
    return true;
}
function resolveBindGroups(command, bindGroups, requiredGroups, scratch) {
    scratch.resolvedBindGroups.length = 0;
    for (const group of requiredGroups) {
        const bindGroup = findBindGroup(command, bindGroups, group, scratch);
        if (bindGroup === undefined) {
            scratch.diagnostics.push({
                code: "renderPassDrawList.missingBindGroupResource",
                renderId: command.renderId,
                bindGroup: group === 2
                    ? { group, materialResourceKey: command.materialResourceKey }
                    : { group },
                message: group === 2
                    ? `Missing material bind group resource for material '${command.materialResourceKey}' on render id ${command.renderId}.`
                    : `Missing bind group resource for group ${group} on render id ${command.renderId}.`,
            });
            continue;
        }
        scratch.resolvedBindGroups.push(bindGroup);
    }
    return scratch.resolvedBindGroups;
}
function findBindGroup(command, bindGroups, group, scratch) {
    if (group === 2) {
        return findMaterialBindGroup(command, bindGroups, group, scratch);
    }
    if (group === 1) {
        return findWorldTransformBindGroup(command, bindGroups, group, scratch);
    }
    let firstCandidate;
    let hasPipelineScopedCandidate = false;
    for (const bindGroup of bindGroups) {
        if (bindGroup.group !== group) {
            continue;
        }
        firstCandidate ??= bindGroup;
        if (!hasPipelineScopedKey(bindGroup, scratch.pipelineKeys)) {
            continue;
        }
        hasPipelineScopedCandidate = true;
        if (bindGroup.entryResourceKeys.includes(command.pipelineKey)) {
            return bindGroup;
        }
    }
    return hasPipelineScopedCandidate &&
        pipelineRequiresScopedBindGroup(command.pipelineKey, group)
        ? undefined
        : firstCandidate;
}
function findWorldTransformBindGroup(command, bindGroups, group, scratch) {
    const skinned = command.pipelineKey.split("|").includes("skinned");
    const requestedWorldTransformResourceKey = command.worldTransformResourceKey;
    const drawSkinningResourceKey = skinningJointBufferResourceKeyForRenderId(command.renderId);
    let firstCandidate;
    let hasPipelineScopedCandidate = false;
    for (const bindGroup of bindGroups) {
        if (bindGroup.group !== group) {
            continue;
        }
        const drawScoped = bindGroup.entryResourceKeys.includes(drawSkinningResourceKey);
        const drawOrderScoped = bindGroup.entryResourceKeys.includes(DRAW_ORDER_WORLD_TRANSFORM_BIND_GROUP_SCOPE_KEY);
        if (skinned) {
            if (drawScoped) {
                return bindGroup;
            }
            continue;
        }
        if (drawScoped) {
            continue;
        }
        if (requestedWorldTransformResourceKey !== undefined) {
            if (bindGroup.entryResourceKeys.includes(requestedWorldTransformResourceKey)) {
                if (!hasPipelineScopedKey(bindGroup, scratch.pipelineKeys)) {
                    firstCandidate ??= bindGroup;
                    continue;
                }
                if (bindGroup.entryResourceKeys.includes(command.pipelineKey)) {
                    return bindGroup;
                }
            }
            continue;
        }
        if (drawOrderScoped) {
            continue;
        }
        firstCandidate ??= bindGroup;
        if (!hasPipelineScopedKey(bindGroup, scratch.pipelineKeys)) {
            continue;
        }
        hasPipelineScopedCandidate = true;
        if (bindGroup.entryResourceKeys.includes(command.pipelineKey)) {
            return bindGroup;
        }
    }
    return skinned
        ? undefined
        : hasPipelineScopedCandidate
            ? undefined
            : firstCandidate;
}
function findMaterialBindGroup(command, bindGroups, group, scratch) {
    let firstCandidate;
    let hasPipelineScopedCandidate = false;
    for (const bindGroup of bindGroups) {
        if (bindGroup.group !== group) {
            continue;
        }
        if (!bindGroup.entryResourceKeys.includes(command.materialResourceKey)) {
            continue;
        }
        firstCandidate ??= bindGroup;
        if (!hasPipelineScopedKey(bindGroup, scratch.pipelineKeys)) {
            continue;
        }
        hasPipelineScopedCandidate = true;
        if (bindGroup.entryResourceKeys.includes(command.pipelineKey)) {
            return bindGroup;
        }
    }
    return hasPipelineScopedCandidate ? undefined : firstCandidate;
}
function hasPipelineScopedKey(bindGroup, pipelineKeys) {
    for (const resourceKey of bindGroup.entryResourceKeys) {
        if (pipelineKeys.has(resourceKey)) {
            return true;
        }
    }
    return false;
}
function pipelineRequiresScopedBindGroup(pipelineKey, group) {
    return group === 3 && pipelineKey.split("|").includes("transmission");
}
function drawListRecordAt(scratch, index) {
    const existing = scratch.drawPool[index];
    if (existing !== undefined) {
        return existing;
    }
    const record = createEmptyDrawListRecord();
    scratch.drawPool.push(record);
    return record;
}
function createEmptyDrawListRecord() {
    return {
        renderId: 0,
        pipelineKey: "",
        bindGroupKeys: [],
        meshResourceKey: "",
        materialResourceKey: "",
        vertexBufferKeys: [],
        vertexCount: 0,
        vertexStart: 0,
        indexBufferKey: null,
        indexCount: null,
        indexStart: null,
        instanceCount: 1,
        transformPackedOffset: 0,
    };
}
//# sourceMappingURL=render-pass-draw-list.js.map