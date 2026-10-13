import { createWebGpuBuffer, } from "../../gpu/buffer.js";
import { materialUniformBufferResourceKey } from "../../resources/core/resource-keys.js";
export function createStandardMaterialGpuBuffer(options) {
    if (options.plan === null) {
        return {
            valid: false,
            resource: null,
            diagnostics: [
                {
                    code: "standardMaterialGpuBuffer.nullDescriptorPlan",
                    message: "Cannot create a standard material GPU buffer from a null descriptor plan.",
                },
            ],
        };
    }
    const resourceKey = materialUniformBufferResourceKey(options.plan.descriptor.label ?? "standard");
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
                    code: "standardMaterialGpuBuffer.creationFailed",
                    reason: result.reason,
                    resourceKey,
                    message: `Failed to create standard material uniform buffer '${resourceKey}': ${result.message}`,
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
            featureFlags: options.plan.featureFlags,
        },
        diagnostics: [],
    };
}
//# sourceMappingURL=standard-material-buffer-resource.js.map