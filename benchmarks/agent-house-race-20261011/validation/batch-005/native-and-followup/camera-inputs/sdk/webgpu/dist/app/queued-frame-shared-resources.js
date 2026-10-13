import { retireWebGpuBuffer } from "../gpu/buffer.js";
import { createViewUniformBufferDescriptorScratch, writeViewUniformBufferDescriptor, } from "../resources/views/view-uniform-buffer.js";
import { createViewUniformGpuBuffer, } from "../resources/views/view-uniform-buffer-resource.js";
import { createWorldTransformGpuBuffer, createWorldTransformBufferDescriptorScratch, writeWorldTransformBufferDescriptor, } from "../resources/transforms/world-transform-buffer.js";
import { writeVersionedBufferData, } from "./app-frame-resource-utils.js";
export function createQueuedBuiltInSharedFrameResourceCache() {
    return {
        viewUniform: null,
        worldTransforms: null,
        viewDescriptorScratch: createViewUniformBufferDescriptorScratch(),
        worldTransformDescriptorScratch: createWorldTransformBufferDescriptorScratch(),
    };
}
export function prepareQueuedBuiltInSharedFrameResources(input) {
    const viewDescriptor = writeViewUniformBufferDescriptor(input.viewUniforms, input.cache.viewDescriptorScratch);
    const transformDescriptor = writeWorldTransformBufferDescriptor(input.worldTransforms, input.cache.worldTransformDescriptorScratch);
    const diagnostics = [
        ...viewDescriptor.diagnostics,
        ...transformDescriptor.diagnostics,
    ];
    if (viewDescriptor.plan === null || transformDescriptor.plan === null) {
        return {
            valid: false,
            viewUniform: null,
            worldTransforms: null,
            diagnostics,
        };
    }
    const viewUniform = prepareSharedViewUniformResource({
        device: input.device,
        cache: input.cache,
        viewUniforms: input.viewUniforms,
        source: viewDescriptor.plan.source,
        views: viewDescriptor.plan.views,
        plan: viewDescriptor.plan,
    }, diagnostics);
    const worldTransforms = prepareSharedWorldTransformResource({
        device: input.device,
        cache: input.cache,
        worldTransforms: input.worldTransforms,
        source: transformDescriptor.plan.source,
        offsets: transformDescriptor.plan.offsets,
        plan: transformDescriptor.plan,
    }, diagnostics);
    return {
        valid: viewUniform !== null && worldTransforms !== null,
        viewUniform,
        worldTransforms,
        diagnostics,
    };
}
function prepareSharedViewUniformResource(input, diagnostics) {
    const cached = input.cache.viewUniform;
    if (cached !== null && cached.byteLength >= input.source.byteLength) {
        const outcome = writeVersionedBufferData(input.device, cached.resource.buffer, input.source, input.viewUniforms, cached.uploadStamp);
        if (outcome === false) {
            return null;
        }
        cached.resource.views = input.views;
        return cached.resource;
    }
    if (cached !== null) {
        retireWebGpuBuffer(input.device, cached.resource.buffer);
        input.cache.viewUniform = null;
    }
    const capacity = nextSharedFrameBufferCapacity(input.source.byteLength);
    const plan = input.plan === null ? null : withDescriptorSize(input.plan, capacity);
    const created = createViewUniformGpuBuffer({
        device: input.device,
        plan,
    });
    diagnostics.push(...created.diagnostics);
    if (!created.valid || created.resource === null) {
        return null;
    }
    input.cache.viewUniform = {
        resource: created.resource,
        byteLength: capacity,
        uploadStamp: { version: input.viewUniforms.contentVersion },
    };
    return created.resource;
}
function prepareSharedWorldTransformResource(input, diagnostics) {
    const cached = input.cache.worldTransforms;
    if (cached !== null && cached.byteLength >= input.source.byteLength) {
        const outcome = writeVersionedBufferData(input.device, cached.resource.buffer, input.source, input.worldTransforms, cached.uploadStamp);
        if (outcome === false) {
            return null;
        }
        cached.resource.offsets = input.offsets;
        return cached.resource;
    }
    if (cached !== null) {
        retireWebGpuBuffer(input.device, cached.resource.buffer);
        input.cache.worldTransforms = null;
    }
    const capacity = nextSharedFrameBufferCapacity(input.source.byteLength);
    const plan = input.plan === null ? null : withDescriptorSize(input.plan, capacity);
    const created = createWorldTransformGpuBuffer({
        device: input.device,
        plan,
    });
    diagnostics.push(...created.diagnostics);
    if (!created.valid || created.resource === null) {
        return null;
    }
    input.cache.worldTransforms = {
        resource: created.resource,
        byteLength: capacity,
        uploadStamp: { version: input.worldTransforms.contentVersion },
    };
    return created.resource;
}
function nextSharedFrameBufferCapacity(byteLength) {
    let capacity = 256;
    while (capacity < byteLength) {
        capacity *= 2;
    }
    return capacity;
}
function withDescriptorSize(plan, size) {
    if (plan.descriptor.size === size) {
        return plan;
    }
    return {
        ...plan,
        descriptor: {
            ...plan.descriptor,
            size,
        },
    };
}
//# sourceMappingURL=queued-frame-shared-resources.js.map