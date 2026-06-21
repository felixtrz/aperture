import { createWebGpuBuffer, } from "../../gpu/buffer.js";
import { meshBufferResourceKey, meshIndexBufferResourceKey, meshVertexBufferResourceKey, } from "../core/resource-keys.js";
export function createMeshGpuBuffers(options) {
    const diagnostics = [];
    if (options.plan === null) {
        diagnostics.push({
            code: "meshGpuBuffer.nullDescriptorPlan",
            message: "Cannot create mesh GPU buffers from a null descriptor plan.",
        });
        return { valid: false, resource: null, diagnostics };
    }
    const plan = options.plan;
    const resourceKey = meshBufferResourceKey(plan.label);
    const vertexBuffers = plan.vertexBuffers.flatMap((vertex) => createVertexBufferResource(options.device, plan.label, vertex, diagnostics));
    const indexBuffer = plan.indexBuffer === undefined
        ? undefined
        : createIndexBufferResource(options.device, plan.label, plan.indexBuffer, diagnostics);
    const resource = {
        resourceKey,
        vertexCount: meshVertexCount(vertexBuffers),
        vertexBuffers,
    };
    if (indexBuffer !== undefined) {
        return {
            valid: diagnostics.length === 0,
            resource: { ...resource, indexBuffer },
            diagnostics,
        };
    }
    return {
        valid: diagnostics.length === 0,
        resource,
        diagnostics,
    };
}
function createVertexBufferResource(device, meshLabel, vertex, diagnostics) {
    const resourceKey = meshVertexBufferResourceKey(meshLabel, vertex.streamId);
    const result = createWebGpuBuffer({
        device,
        descriptor: vertex.descriptor,
    });
    if (!result.ok) {
        diagnostics.push({
            code: "meshGpuBuffer.vertexCreationFailed",
            reason: result.reason,
            resourceKey,
            message: `Failed to create vertex buffer '${resourceKey}': ${result.message}`,
        });
        return [];
    }
    return [
        {
            streamId: vertex.streamId,
            resourceKey,
            buffer: result.buffer,
            vertexCount: vertex.vertexCount,
        },
    ];
}
function createIndexBufferResource(device, meshLabel, index, diagnostics) {
    const resourceKey = meshIndexBufferResourceKey(meshLabel);
    const result = createWebGpuBuffer({
        device,
        descriptor: index.descriptor,
    });
    if (!result.ok) {
        diagnostics.push({
            code: "meshGpuBuffer.indexCreationFailed",
            reason: result.reason,
            resourceKey,
            message: `Failed to create index buffer '${resourceKey}': ${result.message}`,
        });
        return undefined;
    }
    return {
        resourceKey,
        buffer: result.buffer,
        format: index.format,
        indexCount: index.indexCount,
    };
}
function meshVertexCount(vertexBuffers) {
    if (vertexBuffers.length === 0) {
        return 0;
    }
    return Math.min(...vertexBuffers.map((buffer) => buffer.vertexCount));
}
//# sourceMappingURL=mesh-buffer-resources.js.map