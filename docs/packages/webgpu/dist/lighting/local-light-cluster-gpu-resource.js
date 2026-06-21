import { createWebGpuBuffer, } from "../gpu/buffer.js";
import { WEBGPU_BUFFER_USAGE_FLAGS } from "../resources/meshes/mesh-buffer-descriptors.js";
export function createLocalLightClusterGpuResource(options) {
    const paramsResourceKey = `${options.descriptor.resourceKey}/params`;
    const cellsResourceKey = `${options.descriptor.resourceKey}/cells`;
    const indicesResourceKey = `${options.descriptor.resourceKey}/indices`;
    const metadataResourceKey = `${options.descriptor.resourceKey}/metadata`;
    const usage = WEBGPU_BUFFER_USAGE_FLAGS.STORAGE | WEBGPU_BUFFER_USAGE_FLAGS.COPY_DST;
    const params = createWebGpuBuffer({
        device: options.device,
        descriptor: {
            label: paramsResourceKey,
            size: options.descriptor.params.byteLength,
            usage,
            initialData: options.descriptor.params,
        },
    });
    const cells = createWebGpuBuffer({
        device: options.device,
        descriptor: {
            label: cellsResourceKey,
            size: options.descriptor.cells.byteLength,
            usage,
            initialData: options.descriptor.cells,
        },
    });
    const indices = createWebGpuBuffer({
        device: options.device,
        descriptor: {
            label: indicesResourceKey,
            size: options.descriptor.indices.byteLength,
            usage,
            initialData: options.descriptor.indices,
        },
    });
    const metadata = createWebGpuBuffer({
        device: options.device,
        descriptor: {
            label: metadataResourceKey,
            size: options.descriptor.metadata.byteLength,
            usage,
            initialData: options.descriptor.metadata,
        },
    });
    const diagnostics = [];
    pushCreationDiagnostic(diagnostics, params, paramsResourceKey);
    pushCreationDiagnostic(diagnostics, cells, cellsResourceKey);
    pushCreationDiagnostic(diagnostics, indices, indicesResourceKey);
    pushCreationDiagnostic(diagnostics, metadata, metadataResourceKey);
    if (!params.ok || !cells.ok || !indices.ok || !metadata.ok) {
        return { valid: false, resource: null, diagnostics };
    }
    return {
        valid: true,
        resource: {
            resourceKey: options.descriptor.resourceKey,
            paramsResourceKey,
            cellsResourceKey,
            indicesResourceKey,
            metadataResourceKey,
            paramsBuffer: params.buffer,
            cellsBuffer: cells.buffer,
            indicesBuffer: indices.buffer,
            metadataBuffer: metadata.buffer,
            descriptor: options.descriptor,
        },
        diagnostics,
    };
}
function pushCreationDiagnostic(diagnostics, result, resourceKey) {
    if (result.ok) {
        return;
    }
    diagnostics.push({
        code: "localLightClusterGpuBuffer.creationFailed",
        reason: result.reason,
        resourceKey,
        message: `Failed to create local-light cluster buffer '${resourceKey}': ${result.message}`,
    });
}
//# sourceMappingURL=local-light-cluster-gpu-resource.js.map