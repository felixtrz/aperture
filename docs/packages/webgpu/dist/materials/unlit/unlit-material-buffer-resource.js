import { createWebGpuBuffer, } from "../../gpu/buffer.js";
import { materialUniformBufferResourceKey } from "../../resources/core/resource-keys.js";
export function createUnlitMaterialGpuBuffer(options) {
    if (options.plan === null) {
        return {
            valid: false,
            resource: null,
            diagnostics: [
                {
                    code: "unlitMaterialGpuBuffer.nullDescriptorPlan",
                    message: "Cannot create an unlit material GPU buffer from a null descriptor plan.",
                },
            ],
        };
    }
    const resourceKey = materialUniformBufferResourceKey(options.plan.descriptor.label ?? "unlit");
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
                    code: "unlitMaterialGpuBuffer.creationFailed",
                    reason: result.reason,
                    resourceKey,
                    message: `Failed to create unlit material uniform buffer '${resourceKey}': ${result.message}`,
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
//# sourceMappingURL=unlit-material-buffer-resource.js.map