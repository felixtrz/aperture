import type {
  PackedUnlitMaterial,
  UnlitMaterialResourceDependencies,
} from "@aperture-engine/render";
import type { WebGpuBufferDescriptor } from "../../gpu/buffer.js";
import { WEBGPU_BUFFER_USAGE_FLAGS } from "../../resources/meshes/mesh-buffer-descriptors.js";

export type UnlitMaterialBufferDescriptorDiagnosticCode =
  | "unlitMaterialBuffer.nullPackedMaterial"
  | "unlitMaterialBuffer.invalidUniformData"
  | "unlitMaterialBuffer.invalidUsageFlags";

export interface UnlitMaterialBufferDescriptorDiagnostic {
  readonly code: UnlitMaterialBufferDescriptorDiagnosticCode;
  readonly message: string;
  readonly field?: string;
}

export interface UnlitMaterialBufferDescriptorPlan {
  readonly descriptor: WebGpuBufferDescriptor;
  readonly source: Float32Array;
  readonly dependencies: UnlitMaterialResourceDependencies;
}

export interface UnlitMaterialBufferDescriptorResult {
  readonly valid: boolean;
  readonly plan: UnlitMaterialBufferDescriptorPlan | null;
  readonly diagnostics: readonly UnlitMaterialBufferDescriptorDiagnostic[];
}

export interface CreateUnlitMaterialBufferDescriptorOptions {
  readonly label?: string;
  readonly usage?: number;
}

export const DEFAULT_UNLIT_MATERIAL_BUFFER_USAGE =
  WEBGPU_BUFFER_USAGE_FLAGS.UNIFORM | WEBGPU_BUFFER_USAGE_FLAGS.COPY_DST;

export function createUnlitMaterialBufferDescriptor(
  packed: PackedUnlitMaterial | null,
  options: CreateUnlitMaterialBufferDescriptorOptions = {},
): UnlitMaterialBufferDescriptorResult {
  const diagnostics: UnlitMaterialBufferDescriptorDiagnostic[] = [];
  const usage = options.usage ?? DEFAULT_UNLIT_MATERIAL_BUFFER_USAGE;

  if (!isPositiveInteger(usage)) {
    diagnostics.push({
      code: "unlitMaterialBuffer.invalidUsageFlags",
      field: "usage",
      message:
        "Unlit material uniform buffer usage flags must be a positive integer.",
    });
  }

  if (packed === null) {
    diagnostics.push({
      code: "unlitMaterialBuffer.nullPackedMaterial",
      message:
        "Cannot create an unlit material buffer descriptor from null packed material data.",
    });
    return { valid: false, plan: null, diagnostics };
  }

  if (packed.uniform.byteLength === 0 || packed.uniform.length < 4) {
    diagnostics.push({
      code: "unlitMaterialBuffer.invalidUniformData",
      field: "uniform",
      message:
        "Packed unlit material uniform data must contain at least 4 floats.",
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

function isPositiveInteger(value: number): boolean {
  return Number.isInteger(value) && value > 0;
}
