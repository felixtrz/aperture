import { assetHandleKey } from "@aperture-engine/simulation";
import { validateMaterialAsset, } from "@aperture-engine/render";
import { WEBGPU_BUFFER_USAGE_FLAGS } from "../../resources/meshes/mesh-buffer-descriptors.js";
import { materialUniformBufferResourceKey } from "../../resources/core/resource-keys.js";
export const MATCAP_MATERIAL_UNIFORM_FLOATS = 4;
export const MATCAP_MATERIAL_UNIFORM_BYTE_LENGTH = MATCAP_MATERIAL_UNIFORM_FLOATS * Float32Array.BYTES_PER_ELEMENT;
export const MATCAP_MATERIAL_UNIFORM_LAYOUT = [
    "baseColorFactor.r",
    "baseColorFactor.g",
    "baseColorFactor.b",
    "baseColorFactor.a",
];
export const DEFAULT_MATCAP_MATERIAL_BUFFER_USAGE = WEBGPU_BUFFER_USAGE_FLAGS.UNIFORM | WEBGPU_BUFFER_USAGE_FLAGS.COPY_DST;
export function packMatcapMaterial(material) {
    if (material.kind !== "matcap") {
        return {
            valid: false,
            packed: null,
            diagnostics: [
                {
                    code: "matcapMaterialPack.unsupportedMaterialKind",
                    field: "kind",
                    severity: "error",
                    message: `Matcap material packing does not support '${material.kind}' materials.`,
                },
            ],
        };
    }
    const diagnostics = matcapValidationDiagnostics(material);
    const texture = material.matcapTexture;
    if (texture?.texture === null || texture?.texture === undefined) {
        diagnostics.push({
            code: "matcapMaterialPack.missingTextureHandle",
            field: "matcapTexture.texture",
            severity: "error",
            message: "Matcap material packing requires a matcap texture handle.",
        });
    }
    if (texture?.sampler === null || texture?.sampler === undefined) {
        diagnostics.push({
            code: "matcapMaterialPack.missingSamplerHandle",
            field: "matcapTexture.sampler",
            severity: "error",
            message: "Matcap material packing requires a matcap sampler handle.",
        });
    }
    const valid = diagnostics.every((diagnostic) => diagnostic.severity !== "error");
    if (!valid ||
        texture === null ||
        texture === undefined ||
        texture.texture === null ||
        texture.sampler === null) {
        return { valid: false, packed: null, diagnostics };
    }
    const uniform = new Float32Array(MATCAP_MATERIAL_UNIFORM_FLOATS);
    uniform.set(readBaseColor(material));
    return {
        valid: true,
        packed: {
            uniform,
            uniformLayout: MATCAP_MATERIAL_UNIFORM_LAYOUT,
            dependencies: {
                matcapTexture: {
                    textureKey: assetHandleKey(texture.texture),
                    samplerKey: assetHandleKey(texture.sampler),
                },
            },
        },
        diagnostics,
    };
}
export function createMatcapMaterialBufferDescriptor(packed, options = {}) {
    const diagnostics = [];
    const usage = options.usage ?? DEFAULT_MATCAP_MATERIAL_BUFFER_USAGE;
    if (!isPositiveInteger(usage)) {
        diagnostics.push({
            code: "matcapMaterialBuffer.invalidUsageFlags",
            field: "usage",
            message: "Matcap material uniform buffer usage flags must be a positive integer.",
        });
    }
    if (packed === null) {
        diagnostics.push({
            code: "matcapMaterialBuffer.nullPackedMaterial",
            message: "Cannot create a matcap material buffer descriptor from null packed material data.",
        });
        return { valid: false, plan: null, diagnostics };
    }
    if (packed.uniform.byteLength !== MATCAP_MATERIAL_UNIFORM_BYTE_LENGTH ||
        packed.uniform.length !== MATCAP_MATERIAL_UNIFORM_FLOATS) {
        diagnostics.push({
            code: "matcapMaterialBuffer.invalidUniformData",
            field: "uniform",
            message: "Packed matcap material uniform data must match the documented 16-byte layout.",
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
                label: options.label ?? "MatcapMaterial/uniform",
                size: packed.uniform.byteLength,
                usage,
                initialData: packed.uniform,
            },
        },
        diagnostics,
    };
}
export function createMatcapMaterialGpuPreparationPlan(material, options = {}) {
    const packing = packMatcapMaterial(material);
    const buffer = createMatcapMaterialBufferDescriptor(packing.packed, options);
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
            materialBufferResourceKey: materialUniformBufferResourceKey(materialBuffer.descriptor.label ?? "matcap"),
        },
        diagnostics,
    };
}
function matcapValidationDiagnostics(material) {
    return validateMaterialAsset(material).diagnostics.map((diagnostic) => ({
        code: diagnostic.code,
        severity: "error",
        message: diagnostic.message,
        ...(diagnostic.field === undefined ? {} : { field: diagnostic.field }),
    }));
}
function readBaseColor(material) {
    return [
        material.baseColorFactor[0] ?? 1,
        material.baseColorFactor[1] ?? 1,
        material.baseColorFactor[2] ?? 1,
        material.baseColorFactor[3] ?? 1,
    ];
}
function isPositiveInteger(value) {
    return Number.isInteger(value) && value > 0;
}
//# sourceMappingURL=matcap-material-buffer.js.map