import { shaderModuleResourceKey } from "../resources/core/resource-keys.js";
import { createWebGpuShaderModule, } from "./shader.js";
export async function createShaderModuleResource(options) {
    if (options.descriptor === null) {
        return {
            valid: false,
            resource: null,
            diagnostics: [
                {
                    code: "shaderResource.nullDescriptor",
                    message: "Cannot create shader module resource from a null descriptor.",
                },
            ],
        };
    }
    const result = await createWebGpuShaderModule({
        device: options.device,
        descriptor: options.descriptor,
    });
    const diagnostics = result.diagnostics.map((diagnostic) => ({
        code: "shaderResource.compilationDiagnostic",
        severity: diagnostic.severity,
        message: diagnostic.message,
    }));
    if (!result.ok) {
        return {
            valid: false,
            resource: null,
            diagnostics: [
                ...diagnostics,
                {
                    code: "shaderResource.creationFailed",
                    reason: result.reason,
                    message: result.message,
                },
            ],
        };
    }
    return {
        valid: true,
        resource: {
            resourceKey: shaderModuleResourceKey(options.descriptor.label ?? "shader"),
            module: result.module,
            entryPoints: options.descriptor.entryPoints ?? [],
        },
        diagnostics,
    };
}
//# sourceMappingURL=shader-resource.js.map