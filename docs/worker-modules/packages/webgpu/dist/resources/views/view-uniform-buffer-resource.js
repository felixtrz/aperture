import { createWebGpuBuffer, } from "../../gpu/buffer.js";
import { viewUniformBufferResourceKey } from "../core/resource-keys.js";
export function createViewUniformGpuBuffer(options) {
    if (options.plan === null) {
        return {
            valid: false,
            resource: null,
            diagnostics: [
                {
                    code: "viewUniformGpuBuffer.nullDescriptorPlan",
                    message: "Cannot create a view uniform GPU buffer from a null descriptor plan.",
                },
            ],
        };
    }
    const resourceKey = viewUniformBufferResourceKey(options.plan.descriptor.label ?? "ViewUniforms/uniform");
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
                    code: "viewUniformGpuBuffer.creationFailed",
                    reason: result.reason,
                    resourceKey,
                    message: `Failed to create view uniform buffer '${resourceKey}': ${result.message}`,
                },
            ],
        };
    }
    return {
        valid: true,
        resource: {
            resourceKey,
            buffer: result.buffer,
            views: options.plan.views,
        },
        diagnostics: [],
    };
}
//# sourceMappingURL=view-uniform-buffer-resource.js.map