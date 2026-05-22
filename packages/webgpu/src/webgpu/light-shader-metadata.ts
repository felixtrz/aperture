import type { BuiltInShaderBindingResource } from "./unlit-shader.js";
import { DEFAULT_LIGHT_BIND_GROUP } from "./light-bind-group-layout.js";
import {
  PACKED_LIGHT_FLOAT_STRIDE,
  PACKED_LIGHT_METADATA_STRIDE,
} from "./light-packing.js";
import type { WebGpuBindGroupLayoutDescriptor } from "./bind-group-layout-cache.js";
import type { RenderResourceSummaryDiagnostic } from "./resource-summary.js";

export type LightShaderBindingId = "lightFloats" | "lightMetadata";

export interface LightShaderBindingMetadata {
  readonly id: LightShaderBindingId;
  readonly label: string;
  readonly group: number;
  readonly binding: number;
  readonly resource: BuiltInShaderBindingResource;
}

export interface LightShaderBindingMetadataContract {
  readonly group: number;
  readonly bindings: readonly LightShaderBindingMetadata[];
}

export interface LightShaderWgslStorageBinding {
  readonly id: LightShaderBindingId;
  readonly group: number;
  readonly binding: number;
  readonly addressSpace: "storage";
  readonly accessMode: "read";
  readonly elementType: "f32" | "i32";
}

export interface LightShaderWgslDeclarationContract {
  readonly group: number;
  readonly floatStride: number;
  readonly metadataStride: number;
  readonly bindings: readonly LightShaderWgslStorageBinding[];
  readonly source: string;
}

export interface LightShaderWgslDeclarationContractJsonValue {
  readonly group: number;
  readonly strides: {
    readonly floats: number;
    readonly metadata: number;
  };
  readonly bindings: readonly LightShaderWgslStorageBinding[];
  readonly source: string;
}

export const LIGHT_SHADER_BINDING_METADATA: LightShaderBindingMetadataContract =
  {
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

export const LIGHT_SHADER_WGSL_DECLARATION =
  createLightShaderWgslDeclarationContract();

export function createLightShaderWgslDeclarationContract(
  metadata: LightShaderBindingMetadataContract = LIGHT_SHADER_BINDING_METADATA,
): LightShaderWgslDeclarationContract {
  const floatBinding = requireLightBinding(metadata, "lightFloats");
  const metadataBinding = requireLightBinding(metadata, "lightMetadata");
  const bindings: readonly LightShaderWgslStorageBinding[] = [
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

export function lightShaderWgslDeclarationContractToJsonValue(
  contract: LightShaderWgslDeclarationContract = LIGHT_SHADER_WGSL_DECLARATION,
): LightShaderWgslDeclarationContractJsonValue {
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

export function lightShaderWgslDeclarationContractToJson(
  contract: LightShaderWgslDeclarationContract = LIGHT_SHADER_WGSL_DECLARATION,
): string {
  return JSON.stringify(
    lightShaderWgslDeclarationContractToJsonValue(contract),
  );
}

export type LightShaderBindingValidationDiagnosticCode =
  | "lightShaderBinding.missingBinding"
  | "lightShaderBinding.resourceMismatch";

export interface LightShaderBindingValidationDiagnostic {
  readonly code: LightShaderBindingValidationDiagnosticCode;
  readonly message: string;
  readonly bindingId?: LightShaderBindingId;
  readonly binding?: number;
}

export interface LightShaderBindingValidationReport {
  readonly valid: boolean;
  readonly diagnostics: readonly LightShaderBindingValidationDiagnostic[];
}

export type LightShaderResourceReadinessDiagnosticCode =
  | "lightShaderReadiness.missingLightGpuBuffers"
  | "lightShaderReadiness.missingLayout"
  | "lightShaderReadiness.missingBindGroup"
  | "lightShaderReadiness.metadataInvalid";

export interface LightShaderResourceReadinessDiagnostic {
  readonly code: LightShaderResourceReadinessDiagnosticCode;
  readonly message: string;
  readonly resourceKey?: string;
  readonly layoutKey?: string;
}

export interface LightShaderResourceReadinessInput {
  readonly lightGpuBufferResourceKey: string | null;
  readonly layoutKey: string | null;
  readonly bindGroupResourceKey: string | null;
  readonly metadata: LightShaderBindingValidationReport;
}

export interface LightShaderResourceReadinessReport {
  readonly ready: boolean;
  readonly sections: {
    readonly lightGpuBuffers: boolean;
    readonly layout: boolean;
    readonly bindGroup: boolean;
    readonly metadata: boolean;
  };
  readonly diagnostics: readonly LightShaderResourceReadinessDiagnostic[];
}

export interface LightShaderResourceReadinessReportJsonValue {
  readonly ready: boolean;
  readonly sections: LightShaderResourceReadinessReport["sections"];
  readonly diagnostics: readonly LightShaderResourceReadinessDiagnostic[];
}

export function validateLightBindGroupLayoutMetadata(
  layout: WebGpuBindGroupLayoutDescriptor,
  metadata: LightShaderBindingMetadataContract = LIGHT_SHADER_BINDING_METADATA,
): LightShaderBindingValidationReport {
  const diagnostics: LightShaderBindingValidationDiagnostic[] = [];

  for (const binding of metadata.bindings) {
    const entry = layout.entries.find(
      (candidate) => candidate.binding === binding.binding,
    );

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

export function createLightShaderResourceReadinessReport(
  input: LightShaderResourceReadinessInput,
): LightShaderResourceReadinessReport {
  const diagnostics: LightShaderResourceReadinessDiagnostic[] = [];

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

export function lightShaderResourceReadinessReportToJsonValue(
  report: LightShaderResourceReadinessReport,
): LightShaderResourceReadinessReportJsonValue {
  return {
    ready: report.ready,
    sections: { ...report.sections },
    diagnostics: report.diagnostics.map((diagnostic) => ({ ...diagnostic })),
  };
}

export function lightShaderResourceReadinessReportToJson(
  report: LightShaderResourceReadinessReport,
): string {
  return JSON.stringify(lightShaderResourceReadinessReportToJsonValue(report));
}

export function lightShaderReadinessToResourceSummaryDiagnostics(
  report: LightShaderResourceReadinessReport,
): readonly RenderResourceSummaryDiagnostic[] {
  return report.diagnostics.map((diagnostic) => ({
    code: diagnostic.code,
    message: diagnostic.message,
    severity: "warning",
    ...(diagnostic.resourceKey === undefined
      ? {}
      : { resourceKey: diagnostic.resourceKey }),
  }));
}

function layoutEntryResource(
  entry: WebGpuBindGroupLayoutDescriptor["entries"][number],
): BuiltInShaderBindingResource | "unsupported" {
  const record = entry as Readonly<Record<string, unknown>>;
  const buffer = record.buffer as Readonly<Record<string, unknown>> | undefined;

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

function requireLightBinding(
  metadata: LightShaderBindingMetadataContract,
  id: LightShaderBindingId,
): LightShaderBindingMetadata {
  const binding = metadata.bindings.find((candidate) => candidate.id === id);

  if (binding === undefined) {
    throw new Error(`Light shader metadata is missing '${id}'.`);
  }

  return binding;
}

function createLightShaderWgslSource(
  floatBinding: LightShaderBindingMetadata,
  metadataBinding: LightShaderBindingMetadata,
): string {
  return `
// Aperture packed light buffer contract.
// lightFloats field order per light:
// 0 color.r, 1 color.g, 2 color.b, 3 color.a, 4 intensity, 5 range, 6 innerConeAngle, 7 outerConeAngle, 8 width, 9 height, 10-11 reserved.
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
  reserved0: f32,
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
