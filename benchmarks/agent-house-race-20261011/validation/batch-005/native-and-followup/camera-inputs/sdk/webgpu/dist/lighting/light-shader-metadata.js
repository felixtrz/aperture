import { DEFAULT_LIGHT_BIND_GROUP } from "./light-bind-group-layout.js";
import { PACKED_LIGHT_FLOAT_STRIDE, PACKED_LIGHT_METADATA_STRIDE, } from "./light-packing.js";
export const LIGHT_SHADER_BINDING_METADATA = {
    group: DEFAULT_LIGHT_BIND_GROUP,
    bindings: [
        {
            id: "lightFloats",
            label: "Packed light float storage",
            group: DEFAULT_LIGHT_BIND_GROUP,
            binding: 0,
            resource: "read-only-storage-buffer",
        },
        {
            id: "lightMetadata",
            label: "Packed light metadata storage",
            group: DEFAULT_LIGHT_BIND_GROUP,
            binding: 1,
            resource: "read-only-storage-buffer",
        },
    ],
};
export const LIGHT_SHADER_WGSL_DECLARATION = createLightShaderWgslDeclarationContract();
export function createLightShaderWgslDeclarationContract(metadata = LIGHT_SHADER_BINDING_METADATA) {
    const floatBinding = requireLightBinding(metadata, "lightFloats");
    const metadataBinding = requireLightBinding(metadata, "lightMetadata");
    const bindings = [
        {
            id: "lightFloats",
            group: floatBinding.group,
            binding: floatBinding.binding,
            addressSpace: "storage",
            accessMode: "read",
            elementType: "f32",
        },
        {
            id: "lightMetadata",
            group: metadataBinding.group,
            binding: metadataBinding.binding,
            addressSpace: "storage",
            accessMode: "read",
            elementType: "i32",
        },
    ];
    return {
        group: metadata.group,
        floatStride: PACKED_LIGHT_FLOAT_STRIDE,
        metadataStride: PACKED_LIGHT_METADATA_STRIDE,
        bindings,
        source: createLightShaderWgslSource(floatBinding, metadataBinding),
    };
}
export function lightShaderWgslDeclarationContractToJsonValue(contract = LIGHT_SHADER_WGSL_DECLARATION) {
    return {
        group: contract.group,
        strides: {
            floats: contract.floatStride,
            metadata: contract.metadataStride,
        },
        bindings: contract.bindings.map((binding) => ({ ...binding })),
        source: contract.source,
    };
}
export function lightShaderWgslDeclarationContractToJson(contract = LIGHT_SHADER_WGSL_DECLARATION) {
    return JSON.stringify(lightShaderWgslDeclarationContractToJsonValue(contract));
}
export function validateLightBindGroupLayoutMetadata(layout, metadata = LIGHT_SHADER_BINDING_METADATA) {
    const diagnostics = [];
    for (const binding of metadata.bindings) {
        const entry = layout.entries.find((candidate) => candidate.binding === binding.binding);
        if (entry === undefined) {
            diagnostics.push({
                code: "lightShaderBinding.missingBinding",
                bindingId: binding.id,
                binding: binding.binding,
                message: `Light bind group layout is missing '${binding.id}' at binding ${binding.binding}.`,
            });
            continue;
        }
        const resource = layoutEntryResource(entry);
        if (resource !== binding.resource) {
            diagnostics.push({
                code: "lightShaderBinding.resourceMismatch",
                bindingId: binding.id,
                binding: binding.binding,
                message: `Light bind group layout binding ${binding.binding} uses '${resource}' but metadata requires '${binding.resource}'.`,
            });
        }
    }
    return { valid: diagnostics.length === 0, diagnostics };
}
export function createLightShaderResourceReadinessReport(input) {
    const diagnostics = [];
    if (input.lightGpuBufferResourceKey === null) {
        diagnostics.push({
            code: "lightShaderReadiness.missingLightGpuBuffers",
            message: "Light shader readiness requires light GPU buffers.",
        });
    }
    if (input.layoutKey === null) {
        diagnostics.push({
            code: "lightShaderReadiness.missingLayout",
            message: "Light shader readiness requires a light bind group layout.",
        });
    }
    if (input.bindGroupResourceKey === null) {
        diagnostics.push({
            code: "lightShaderReadiness.missingBindGroup",
            message: "Light shader readiness requires a light bind group resource.",
        });
    }
    if (!input.metadata.valid) {
        diagnostics.push({
            code: "lightShaderReadiness.metadataInvalid",
            message: "Light shader binding metadata validation failed.",
        });
    }
    return {
        ready: diagnostics.length === 0,
        sections: {
            lightGpuBuffers: input.lightGpuBufferResourceKey !== null,
            layout: input.layoutKey !== null,
            bindGroup: input.bindGroupResourceKey !== null,
            metadata: input.metadata.valid,
        },
        diagnostics,
    };
}
export function lightShaderResourceReadinessReportToJsonValue(report) {
    return {
        ready: report.ready,
        sections: { ...report.sections },
        diagnostics: report.diagnostics.map((diagnostic) => ({ ...diagnostic })),
    };
}
export function lightShaderResourceReadinessReportToJson(report) {
    return JSON.stringify(lightShaderResourceReadinessReportToJsonValue(report));
}
export function lightShaderReadinessToResourceSummaryDiagnostics(report) {
    return report.diagnostics.map((diagnostic) => ({
        code: diagnostic.code,
        message: diagnostic.message,
        severity: "warning",
        ...(diagnostic.resourceKey === undefined
            ? {}
            : { resourceKey: diagnostic.resourceKey }),
    }));
}
function layoutEntryResource(entry) {
    const record = entry;
    const buffer = record.buffer;
    if (buffer?.type === "read-only-storage") {
        return "read-only-storage-buffer";
    }
    if (buffer?.type === "uniform") {
        return "uniform-buffer";
    }
    if ("texture" in record) {
        return "texture";
    }
    if ("sampler" in record) {
        return "sampler";
    }
    return "unsupported";
}
function requireLightBinding(metadata, id) {
    const binding = metadata.bindings.find((candidate) => candidate.id === id);
    if (binding === undefined) {
        throw new Error(`Light shader metadata is missing '${id}'.`);
    }
    return binding;
}
function createLightShaderWgslSource(floatBinding, metadataBinding) {
    return `
// Aperture packed light buffer contract.
// lightFloats field order per light:
// 0 color.r, 1 color.g, 2 color.b, 3 color.a, 4 intensity, 5 range, 6 innerConeAngle, 7 outerConeAngle, 8 width, 9 height, 10 areaShape, 11 reserved.
// lightMetadata field order per light:
// 0 kind, 1 worldTransformOffset, 2 layerMask, 3 lightId, 4 entity.index, 5 entity.generation.
const PACKED_LIGHT_FLOAT_STRIDE: u32 = ${PACKED_LIGHT_FLOAT_STRIDE}u;
const PACKED_LIGHT_METADATA_STRIDE: u32 = ${PACKED_LIGHT_METADATA_STRIDE}u;

struct PackedLightFloatFields {
  color: vec4f,
  intensity: f32,
  range: f32,
  innerConeAngle: f32,
  outerConeAngle: f32,
  width: f32,
  height: f32,
  areaShape: f32,
  reserved1: f32,
};

struct PackedLightMetadataFields {
  kind: i32,
  worldTransformOffset: i32,
  layerMask: i32,
  lightId: i32,
  entityIndex: i32,
  entityGeneration: i32,
};

@group(${floatBinding.group}) @binding(${floatBinding.binding}) var<storage, read> lightFloats: array<f32>;
@group(${metadataBinding.group}) @binding(${metadataBinding.binding}) var<storage, read> lightMetadata: array<i32>;
`.trim();
}
//# sourceMappingURL=light-shader-metadata.js.map