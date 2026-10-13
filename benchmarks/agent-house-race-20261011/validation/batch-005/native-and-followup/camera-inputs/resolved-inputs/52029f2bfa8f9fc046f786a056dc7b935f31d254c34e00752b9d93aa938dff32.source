import { validateMaterialAsset, } from "@aperture-engine/render";
import { WEBGPU_BUFFER_USAGE_FLAGS } from "../../resources/meshes/mesh-buffer-descriptors.js";
import { materialUniformBufferResourceKey } from "../../resources/core/resource-keys.js";
export const DEBUG_NORMAL_MATERIAL_UNIFORM_WORDS = 4;
export const DEBUG_NORMAL_MATERIAL_UNIFORM_BYTE_LENGTH = DEBUG_NORMAL_MATERIAL_UNIFORM_WORDS * Uint32Array.BYTES_PER_ELEMENT;
export const DEBUG_NORMAL_MATERIAL_UNIFORM_LAYOUT = [
    "mode.u32",
    "padding0.u32",
    "padding1.u32",
    "padding2.u32",
];
export const DEFAULT_DEBUG_NORMAL_MATERIAL_BUFFER_USAGE = WEBGPU_BUFFER_USAGE_FLAGS.UNIFORM | WEBGPU_BUFFER_USAGE_FLAGS.COPY_DST;
export function packDebugNormalMaterial(material) {
    if (material.kind !== "debug-normal") {
        return {
            valid: false,
            packed: null,
            diagnostics: [
                {
                    code: "debugNormalMaterialPack.unsupportedMaterialKind",
                    field: "kind",
                    severity: "error",
                    message: `DebugNormal material packing does not support '${material.kind}' materials.`,
                },
            ],
        };
    }
    const diagnostics = debugNormalValidationDiagnostics(material);
    const valid = diagnostics.every((diagnostic) => diagnostic.severity !== "error");
    if (!valid) {
        return { valid: false, packed: null, diagnostics };
    }
    const buffer = new ArrayBuffer(DEBUG_NORMAL_MATERIAL_UNIFORM_BYTE_LENGTH);
    const uniformUint32 = new Uint32Array(buffer);
    uniformUint32[0] = 0;
    return {
        valid: true,
        packed: {
            uniform: new Uint8Array(buffer),
            uniformUint32,
            uniformLayout: DEBUG_NORMAL_MATERIAL_UNIFORM_LAYOUT,
            dependencies: {},
        },
        diagnostics,
    };
}
export function createDebugNormalMaterialBufferDescriptor(packed, options = {}) {
    const diagnostics = [];
    const usage = options.usage ?? DEFAULT_DEBUG_NORMAL_MATERIAL_BUFFER_USAGE;
    if (!isPositiveInteger(usage)) {
        diagnostics.push({
            code: "debugNormalMaterialBuffer.invalidUsageFlags",
            field: "usage",
            message: "DebugNormal material uniform buffer usage flags must be a positive integer.",
        });
    }
    if (packed === null) {
        diagnostics.push({
            code: "debugNormalMaterialBuffer.nullPackedMaterial",
            message: "Cannot create a debug-normal material buffer descriptor from null packed material data.",
        });
        return { valid: false, plan: null, diagnostics };
    }
    if (packed.uniform.byteLength !== DEBUG_NORMAL_MATERIAL_UNIFORM_BYTE_LENGTH ||
        packed.uniformUint32.length !== DEBUG_NORMAL_MATERIAL_UNIFORM_WORDS) {
        diagnostics.push({
            code: "debugNormalMaterialBuffer.invalidUniformData",
            field: "uniform",
            message: `Packed debug-normal material uniform data must match the documented ${DEBUG_NORMAL_MATERIAL_UNIFORM_BYTE_LENGTH}-byte layout.`,
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
                label: options.label ?? "DebugNormalMaterial/uniform",
                size: packed.uniform.byteLength,
                usage,
                initialData: packed.uniform,
            },
        },
        diagnostics,
    };
}
export function createDebugNormalMaterialGpuPreparationPlan(material, options = {}) {
    const packing = packDebugNormalMaterial(material);
    const buffer = createDebugNormalMaterialBufferDescriptor(packing.packed, options);
    const diagnostics = [...packing.diagnostics, ...buffer.diagnostics];
    if (!packing.valid || !buffer.valid || packing.packed === null) {
        return {
            valid: false,
            plan: null,
            diagnostics,
        };
    }
    const materialBuffer = buffer.plan;
    if (materialBuffer === null) {
        return {
            valid: false,
            plan: null,
            diagnostics,
        };
    }
    return {
        valid: true,
        plan: {
            packed: packing.packed,
            materialBuffer,
            materialBufferResourceKey: materialUniformBufferResourceKey(materialBuffer.descriptor.label ?? "debug-normal"),
        },
        diagnostics,
    };
}
function debugNormalValidationDiagnostics(material) {
    return validateMaterialAsset(material).diagnostics.map((diagnostic) => ({
        code: diagnostic.code,
        severity: "error",
        message: diagnostic.message,
        ...(diagnostic.field === undefined ? {} : { field: diagnostic.field }),
    }));
}
function isPositiveInteger(value) {
    return Number.isInteger(value) && value > 0;
}
//# sourceMappingURL=debug-normal-material-buffer.js.map