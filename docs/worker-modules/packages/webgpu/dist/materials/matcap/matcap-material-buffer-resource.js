import { createWebGpuBuffer, } from "../../gpu/buffer.js";
import { materialUniformBufferResourceKey } from "../../resources/core/resource-keys.js";
export function createMatcapMaterialGpuBuffer(options) {
    if (options.plan === null) {
        return {
            valid: false,
            resource: null,
            diagnostics: [
                {
                    code: "matcapMaterialGpuBuffer.nullDescriptorPlan",
                    message: "Cannot create a matcap material GPU buffer from a null descriptor plan.",
                },
            ],
        };
    }
    const resourceKey = materialUniformBufferResourceKey(options.plan.descriptor.label ?? "matcap");
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
                    code: "matcapMaterialGpuBuffer.creationFailed",
                    reason: result.reason,
                    resourceKey,
                    message: `Failed to create matcap material uniform buffer '${resourceKey}': ${result.message}`,
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
//# sourceMappingURL=matcap-material-buffer-resource.js.map