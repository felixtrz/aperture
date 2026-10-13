import { WEBGPU_BUFFER_USAGE_FLAGS } from "../../resources/meshes/mesh-buffer-descriptors.js";
export const DEFAULT_UNLIT_MATERIAL_BUFFER_USAGE = WEBGPU_BUFFER_USAGE_FLAGS.UNIFORM | WEBGPU_BUFFER_USAGE_FLAGS.COPY_DST;
export function createUnlitMaterialBufferDescriptor(packed, options = {}) {
    const diagnostics = [];
    const usage = options.usage ?? DEFAULT_UNLIT_MATERIAL_BUFFER_USAGE;
    if (!isPositiveInteger(usage)) {
        diagnostics.push({
            code: "unlitMaterialBuffer.invalidUsageFlags",
            field: "usage",
            message: "Unlit material uniform buffer usage flags must be a positive integer.",
        });
    }
    if (packed === null) {
        diagnostics.push({
            code: "unlitMaterialBuffer.nullPackedMaterial",
            message: "Cannot create an unlit material buffer descriptor from null packed material data.",
        });
        return { valid: false, plan: null, diagnostics };
    }
    if (packed.uniform.byteLength === 0 || packed.uniform.length < 4) {
        diagnostics.push({
            code: "unlitMaterialBuffer.invalidUniformData",
            field: "uniform",
            message: "Packed unlit material uniform data must contain at least 4 floats.",
        });
    }
    if (diagnostics.length > 0) {
        return { valid: false, plan: null, diagnostics };
    }
    return {
        valid: true,
        plan: {
            source: packed.uniform,
            dependencies: packed.dependencies,
            descriptor: {
                label: options.label ?? "UnlitMaterial/uniform",
                size: packed.uniform.byteLength,
                usage,
                initialData: packed.uniform,
            },
        },
        diagnostics,
    };
}
function isPositiveInteger(value) {
    return Number.isInteger(value) && value > 0;
}
//# sourceMappingURL=unlit-material-buffer.js.map