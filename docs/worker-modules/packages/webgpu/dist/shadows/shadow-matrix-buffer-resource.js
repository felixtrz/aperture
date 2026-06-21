import { createWebGpuBuffer, destroyWebGpuBuffer, } from "../gpu/buffer.js";
import { WEBGPU_BUFFER_USAGE_FLAGS } from "../resources/meshes/mesh-buffer-descriptors.js";
export const DEFAULT_SHADOW_MATRIX_BUFFER_USAGE = WEBGPU_BUFFER_USAGE_FLAGS.STORAGE | WEBGPU_BUFFER_USAGE_FLAGS.COPY_DST;
export function createShadowMatrixBufferResourceReport(options) {
    if (options.descriptor.status === "not-required" ||
        options.matrices.status === "not-required") {
        return report({
            status: "not-required",
            matrixCount: 0,
            byteSize: 0,
            createdBufferCount: 0,
            reusedBufferCount: 0,
            resource: null,
            diagnostics: [],
        });
    }
    const diagnostics = [];
    if (options.descriptor.descriptor === null) {
        diagnostics.push({
            code: "shadowMatrixBufferResource.missingDescriptor",
            severity: "warning",
            message: "Shadow matrix buffer resource allocation requires a matrix buffer descriptor.",
        });
    }
    if (options.matrices.status !== "ready") {
        diagnostics.push({
            code: "shadowMatrixBufferResource.missingMatrices",
            severity: "warning",
            message: "Shadow matrix buffer resource allocation requires computed directional shadow matrices.",
        });
    }
    if (diagnostics.length > 0 || options.descriptor.descriptor === null) {
        return report({
            status: "missing",
            matrixCount: options.matrices.matrixCount,
            byteSize: options.descriptor.byteSize,
            createdBufferCount: 0,
            reusedBufferCount: 0,
            resource: null,
            diagnostics,
        });
    }
    const descriptor = options.descriptor.descriptor;
    const packed = packShadowMatrices(options.descriptor, options.matrices);
    if ("diagnostics" in packed) {
        return report({
            status: "missing",
            matrixCount: options.matrices.matrixCount,
            byteSize: descriptor.byteSize,
            createdBufferCount: 0,
            reusedBufferCount: 0,
            resource: null,
            diagnostics: packed.diagnostics,
        });
    }
    const cached = options.cache?.get(descriptor.resourceKey);
    if (cached !== undefined) {
        if (cached.byteSize !== descriptor.byteSize) {
            destroyWebGpuBuffer(cached.buffer);
            options.cache?.delete(descriptor.resourceKey);
        }
        else {
            const resource = {
                ...cached,
                label: descriptor.label,
                byteSize: descriptor.byteSize,
                matrixCount: descriptor.matrixCount,
                entryMatrixKeys: descriptor.entries.map((entry) => entry.matrixKey),
            };
            // Re-upload the CURRENT matrices into the reused buffer. The cache key is the
            // stable resourceKey, so a plain cache hit would keep serving the light-VP
            // matrices captured on the first frame. The light-space ortho is recomputed
            // every frame (it tracks the light + camera-derived shadow center) and the
            // CASTER re-bakes lightVP*world every frame — so without this re-upload the
            // receiver samples a STALE light-VP and the shadow desyncs from its caster
            // the moment the camera or light moves.
            options.device.queue?.writeBuffer?.(resource.buffer, 0, packed.data);
            options.cache?.set(descriptor.resourceKey, resource);
            return report({
                status: "available",
                matrixCount: resource.matrixCount,
                byteSize: resource.byteSize,
                createdBufferCount: 0,
                reusedBufferCount: 1,
                resource,
                diagnostics: deferredDiagnostics(),
            });
        }
    }
    const buffer = createWebGpuBuffer({
        device: options.device,
        descriptor: {
            label: descriptor.label,
            size: descriptor.byteSize,
            usage: DEFAULT_SHADOW_MATRIX_BUFFER_USAGE,
            initialData: packed.data,
        },
    });
    if (!buffer.ok) {
        return report({
            status: "missing",
            matrixCount: descriptor.matrixCount,
            byteSize: descriptor.byteSize,
            createdBufferCount: 0,
            reusedBufferCount: 0,
            resource: null,
            diagnostics: [
                {
                    code: "shadowMatrixBufferResource.bufferCreationFailed",
                    severity: "warning",
                    reason: buffer.reason,
                    message: buffer.message,
                },
            ],
        });
    }
    const resource = {
        resourceKey: descriptor.resourceKey,
        label: descriptor.label,
        buffer: buffer.buffer,
        byteSize: descriptor.byteSize,
        matrixCount: descriptor.matrixCount,
        entryMatrixKeys: descriptor.entries.map((entry) => entry.matrixKey),
    };
    options.cache?.set(descriptor.resourceKey, resource);
    return report({
        status: "available",
        matrixCount: descriptor.matrixCount,
        byteSize: descriptor.byteSize,
        createdBufferCount: 1,
        reusedBufferCount: 0,
        resource,
        diagnostics: deferredDiagnostics(),
    });
}
export function shadowMatrixBufferResourceReportToJsonValue(value) {
    return {
        ready: value.ready,
        status: value.status,
        matrixCount: value.matrixCount,
        byteSize: value.byteSize,
        createdBufferCount: value.createdBufferCount,
        reusedBufferCount: value.reusedBufferCount,
        sections: { ...value.sections },
        resource: value.resource === null
            ? null
            : {
                resourceKey: value.resource.resourceKey,
                label: value.resource.label,
                byteSize: value.resource.byteSize,
                matrixCount: value.resource.matrixCount,
                entryMatrixKeys: [...value.resource.entryMatrixKeys],
            },
        diagnostics: value.diagnostics.map((diagnostic) => ({ ...diagnostic })),
    };
}
export function shadowMatrixBufferResourceReportToJson(value) {
    return JSON.stringify(shadowMatrixBufferResourceReportToJsonValue(value));
}
function packShadowMatrices(descriptor, matrices) {
    const bufferDescriptor = descriptor.descriptor;
    if (bufferDescriptor === null) {
        return {
            diagnostics: [
                {
                    code: "shadowMatrixBufferResource.missingDescriptor",
                    severity: "warning",
                    message: "Shadow matrix packing requires a matrix buffer descriptor.",
                },
            ],
        };
    }
    const matrixByKey = new Map(matrices.matrices.map((matrix) => [matrix.matrixKey, matrix]));
    const data = new Float32Array(bufferDescriptor.byteSize / 4);
    const diagnostics = [];
    for (const entry of bufferDescriptor.entries) {
        const matrix = matrixByKey.get(entry.matrixKey);
        if (matrix === undefined) {
            diagnostics.push({
                code: "shadowMatrixBufferResource.missingMatrixData",
                severity: "warning",
                matrixKey: entry.matrixKey,
                message: `Shadow matrix '${entry.matrixKey}' is missing computed matrix data.`,
            });
            continue;
        }
        data.set(matrix.viewProjectionMatrix, entry.offsetBytes / Float32Array.BYTES_PER_ELEMENT);
    }
    return diagnostics.length === 0 ? { data } : { diagnostics };
}
function report(input) {
    const available = input.status === "available";
    return {
        ready: input.status === "available" || input.status === "not-required",
        status: input.status,
        matrixCount: input.matrixCount,
        byteSize: input.byteSize,
        createdBufferCount: input.createdBufferCount,
        reusedBufferCount: input.reusedBufferCount,
        sections: {
            matrixComputation: input.status !== "missing",
            bufferDescriptor: input.status !== "missing",
            bufferAllocation: available,
            upload: available,
            bindGroupResource: false,
            shaderSampling: false,
        },
        resource: input.resource,
        diagnostics: input.diagnostics,
    };
}
function deferredDiagnostics() {
    return [
        {
            code: "shadowMatrixBufferResource.bindGroupDeferred",
            severity: "warning",
            message: "Shadow matrix buffer resource is available, but shadow bind-group creation is deferred.",
        },
        {
            code: "shadowMatrixBufferResource.shaderSamplingDeferred",
            severity: "warning",
            message: "Shadow matrix buffer resource is available, but StandardMaterial shadow sampling is deferred.",
        },
    ];
}
//# sourceMappingURL=shadow-matrix-buffer-resource.js.map