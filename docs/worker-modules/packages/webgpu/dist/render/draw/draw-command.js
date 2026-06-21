import { requiredBindGroupGroupsForPipelineKey } from "../../materials/core/material-pipeline-selection.js";
/**
 * The canonical pipeline key carried by a draw's render-pass commands. When a
 * prepared GPU pipeline exists for the draw, frame preparation records its
 * resolved cache key in `pipelineKeysByRenderId`; otherwise commands fall back
 * to the authored batch pipeline key. Every consumer that needs to match a
 * draw's `setPipeline` command key (e.g. ID-buffer pick pipeline preparation)
 * must derive it through this helper so creation and lookup cannot drift.
 */
export function resolveDrawCommandPipelineKey(renderId, authoredPipelineKey, pipelineKeysByRenderId) {
    return pipelineKeysByRenderId?.get(renderId) ?? authoredPipelineKey;
}
export function createDrawCommandDescriptors(packages, meshResources, options = {}) {
    const scratch = createDrawCommandDescriptorScratch();
    writeDrawCommandDescriptors(packages, meshResources, scratch, options);
    return scratch.plan;
}
export function createDrawCommandDescriptorScratch(capacity = 0) {
    const descriptors = [];
    const diagnostics = [];
    const descriptorPool = [];
    for (let i = 0; i < capacity; i += 1) {
        descriptorPool.push(createEmptyDescriptor());
    }
    return {
        descriptors,
        diagnostics,
        descriptorPool,
        meshByResourceKey: new Map(),
        plan: { descriptors, diagnostics },
    };
}
export function writeDrawCommandDescriptors(packages, meshResources, scratch, options = {}) {
    scratch.descriptors.length = 0;
    scratch.diagnostics.length = 0;
    scratch.meshByResourceKey.clear();
    for (const resource of meshResources) {
        scratch.meshByResourceKey.set(resource.resourceKey, resource);
    }
    for (const drawPackage of packages) {
        const mesh = scratch.meshByResourceKey.get(drawPackage.meshResourceKey);
        if (mesh === undefined) {
            scratch.diagnostics.push({
                code: "drawCommand.missingMeshResource",
                renderId: drawPackage.renderId,
                resourceKey: drawPackage.meshResourceKey,
                message: `Missing mesh resource '${drawPackage.meshResourceKey}' for render id ${drawPackage.renderId}.`,
            });
            continue;
        }
        const descriptor = descriptorAt(scratch, scratch.descriptors.length);
        const authoredPipelineKey = drawPackage.batchKey.pipelineKey;
        const resolvedPipelineKey = resolveDrawCommandPipelineKey(drawPackage.renderId, authoredPipelineKey, options.pipelineKeysByRenderId);
        descriptor.renderId = drawPackage.renderId;
        descriptor.pipelineKey = resolvedPipelineKey;
        if (resolvedPipelineKey === authoredPipelineKey) {
            delete descriptor.requiredBindGroupGroups;
        }
        else {
            descriptor.requiredBindGroupGroups =
                requiredBindGroupGroupsForPipelineKey(authoredPipelineKey);
        }
        descriptor.topology = drawPackage.batchKey.topology;
        descriptor.meshResourceKey = drawPackage.meshResourceKey;
        descriptor.materialResourceKey = drawPackage.materialResourceKey;
        descriptor.vertexBufferKeys.length = 0;
        for (const buffer of mesh.vertexBuffers) {
            descriptor.vertexBufferKeys.push(buffer.resourceKey);
        }
        if (hasPipelineFeature(authoredPipelineKey, "instance-tint") &&
            appendInstanceTintBufferKey(drawPackage, descriptor, options, scratch) ===
                false) {
            continue;
        }
        if (pipelineUsesInstanceAttributes(authoredPipelineKey) &&
            appendInstanceAttributeBufferKey(drawPackage, descriptor, options, scratch) === false) {
            continue;
        }
        descriptor.vertexCount = drawPackage.packet.vertexCount ?? mesh.vertexCount;
        descriptor.vertexStart = drawPackage.packet.vertexStart ?? 0;
        descriptor.indexBufferKey = mesh.indexBuffer?.resourceKey ?? null;
        descriptor.indexCount =
            mesh.indexBuffer === undefined
                ? null
                : (drawPackage.packet.indexCount ?? mesh.indexBuffer.indexCount);
        descriptor.indexStart =
            mesh.indexBuffer === undefined
                ? null
                : (drawPackage.packet.indexStart ?? 0);
        descriptor.transformPackedOffset = drawPackage.transformPackedOffset;
        const worldTransformResourceKey = options.worldTransformResourceKeyByRenderId?.get(drawPackage.renderId);
        if (worldTransformResourceKey === undefined) {
            delete descriptor.worldTransformResourceKey;
        }
        else {
            descriptor.worldTransformResourceKey = worldTransformResourceKey;
        }
        if (drawPackage.packet.occlusionQuery === true) {
            descriptor.occlusionQuery = true;
        }
        else {
            delete descriptor.occlusionQuery;
        }
        scratch.descriptors.push(descriptor);
    }
    return scratch.plan;
}
function appendInstanceAttributeBufferKey(drawPackage, descriptor, options, scratch) {
    const instanceAttributes = options.instanceAttributeResources?.[0];
    if (drawPackage.packet.instanceAttributePacketIndex === undefined) {
        scratch.diagnostics.push({
            code: "drawCommand.missingInstanceAttributePacket",
            renderId: drawPackage.renderId,
            resourceKey: drawPackage.materialResourceKey,
            message: `Render id ${drawPackage.renderId} uses an instance-attribute pipeline but has no instance attribute packet.`,
        });
        return false;
    }
    if (instanceAttributes === undefined) {
        scratch.diagnostics.push({
            code: "drawCommand.missingInstanceAttributeResource",
            renderId: drawPackage.renderId,
            resourceKey: drawPackage.materialResourceKey,
            message: `Render id ${drawPackage.renderId} uses an instance-attribute pipeline but no instance attribute vertex buffer is available.`,
        });
        return false;
    }
    descriptor.vertexBufferKeys.push(instanceAttributes.resourceKey);
    return true;
}
function appendInstanceTintBufferKey(drawPackage, descriptor, options, scratch) {
    const instanceTint = options.instanceTintResources?.[0];
    if (drawPackage.packet.instanceTintOffset === undefined) {
        scratch.diagnostics.push({
            code: "drawCommand.missingInstanceTintOffset",
            renderId: drawPackage.renderId,
            resourceKey: drawPackage.materialResourceKey,
            message: `Render id ${drawPackage.renderId} uses an instance-tint pipeline but has no instance tint packet offset.`,
        });
        return false;
    }
    if (instanceTint === undefined) {
        scratch.diagnostics.push({
            code: "drawCommand.missingInstanceTintResource",
            renderId: drawPackage.renderId,
            resourceKey: drawPackage.materialResourceKey,
            message: `Render id ${drawPackage.renderId} uses an instance-tint pipeline but no instance tint vertex buffer is available.`,
        });
        return false;
    }
    descriptor.vertexBufferKeys.push(instanceTint.resourceKey);
    return true;
}
function hasPipelineFeature(pipelineKey, feature) {
    return pipelineKey.split("|").includes(feature);
}
function pipelineUsesInstanceAttributes(pipelineKey) {
    const prefix = "instance-attributes:";
    return pipelineKey
        .split("|")
        .some((feature) => feature.startsWith(prefix) && feature !== `${prefix}none`);
}
function descriptorAt(scratch, index) {
    const existing = scratch.descriptorPool[index];
    if (existing !== undefined) {
        return existing;
    }
    const descriptor = createEmptyDescriptor();
    scratch.descriptorPool.push(descriptor);
    return descriptor;
}
function createEmptyDescriptor() {
    return {
        renderId: 0,
        pipelineKey: "",
        topology: "triangle-list",
        meshResourceKey: "",
        materialResourceKey: "",
        vertexBufferKeys: [],
        vertexCount: 0,
        vertexStart: 0,
        indexBufferKey: null,
        indexCount: null,
        indexStart: null,
        transformPackedOffset: 0,
    };
}
//# sourceMappingURL=draw-command.js.map