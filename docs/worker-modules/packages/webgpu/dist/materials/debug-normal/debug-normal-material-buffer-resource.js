import { createWebGpuBuffer, } from "../../gpu/buffer.js";
import { materialUniformBufferResourceKey } from "../../resources/core/resource-keys.js";
export function createDebugNormalMaterialGpuBuffer(options) {
    if (options.plan === null) {
        return {
            valid: false,
            resource: null,
            diagnostics: [
                {
                    code: "debugNormalMaterialGpuBuffer.nullDescriptorPlan",
                    message: "Cannot create a debug-normal material GPU buffer from a null descriptor plan.",
                },
            ],
        };
    }
    const resourceKey = materialUniformBufferResourceKey(options.plan.descriptor.label ?? "debug-normal");
    const result = createWebGpuBuffer({
        device: options.device,
        descriptor: options.plan.descriptor,
    });
    if (!result.ok) {
        return {
            valid: false,
            resource: null,
            diagnostics: [
                {
                    code: "debugNormalMaterialGpuBuffer.creationFailed",
                    reason: result.reason,
                    resourceKey,
                    message: `Failed to create debug-normal material uniform buffer '${resourceKey}': ${result.message}`,
                },
            ],
        };
    }
    return {
        valid: true,
        resource: {
            resourceKey,
            uniformBuffer: result.buffer,
            dependencies: options.plan.dependencies,
        },
        diagnostics: [],
    };
}
export function debugNormalMaterialGpuBufferResourceToJsonValue(resource) {
    return {
        resourceKey: resource.resourceKey,
        dependencies: resource.dependencies,
    };
}
//# sourceMappingURL=debug-normal-material-buffer-resource.js.map