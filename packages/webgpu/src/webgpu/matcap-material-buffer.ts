import { assetHandleKey } from "@aperture-engine/simulation";
import {
  validateMaterialAsset,
  type MaterialAsset,
  type MaterialValidationDiagnostic,
  type MatcapMaterialAsset,
} from "@aperture-engine/render";
import type { WebGpuBufferDescriptor } from "./buffer.js";
import { WEBGPU_BUFFER_USAGE_FLAGS } from "./mesh-buffer-descriptors.js";
import { materialUniformBufferResourceKey } from "./resource-keys.js";

export const MATCAP_MATERIAL_UNIFORM_FLOATS = 4;
export const MATCAP_MATERIAL_UNIFORM_BYTE_LENGTH =
  MATCAP_MATERIAL_UNIFORM_FLOATS * Float32Array.BYTES_PER_ELEMENT;

export const MATCAP_MATERIAL_UNIFORM_LAYOUT = [
  "baseColorFactor.r",
  "baseColorFactor.g",
  "baseColorFactor.b",
  "baseColorFactor.a",
] as const;

export type MatcapMaterialPackingDiagnosticCode =
  | "matcapMaterialPack.unsupportedMaterialKind"
  | "matcapMaterialPack.missingTextureHandle"
  | "matcapMaterialPack.missingSamplerHandle"
  | MaterialValidationDiagnostic["code"];

export interface MatcapMaterialPackingDiagnostic {
  readonly code: MatcapMaterialPackingDiagnosticCode;
  readonly message: string;
  readonly field?: string;
  readonly severity: "warning" | "error";
}

export interface MatcapMaterialTextureDependency {
  readonly textureKey: string;
  readonly samplerKey: string;
}

export interface MatcapMaterialResourceDependencies {
  readonly matcapTexture: MatcapMaterialTextureDependency;
}

export interface PackedMatcapMaterial {
  readonly uniform: Float32Array;
  readonly uniformLayout: typeof MATCAP_MATERIAL_UNIFORM_LAYOUT;
  readonly dependencies: MatcapMaterialResourceDependencies;
}

export interface PackMatcapMaterialResult {
  readonly valid: boolean;
  readonly packed: PackedMatcapMaterial | null;
  readonly diagnostics: readonly MatcapMaterialPackingDiagnostic[];
}

export type MatcapMaterialBufferDescriptorDiagnosticCode =
  | "matcapMaterialBuffer.nullPackedMaterial"
  | "matcapMaterialBuffer.invalidUniformData"
  | "matcapMaterialBuffer.invalidUsageFlags";

export interface MatcapMaterialBufferDescriptorDiagnostic {
  readonly code: MatcapMaterialBufferDescriptorDiagnosticCode;
  readonly message: string;
  readonly field?: string;
}

export interface MatcapMaterialBufferDescriptorPlan {
  readonly descriptor: WebGpuBufferDescriptor;
  readonly source: Float32Array;
  readonly dependencies: MatcapMaterialResourceDependencies;
}

export interface MatcapMaterialBufferDescriptorResult {
  readonly valid: boolean;
  readonly plan: MatcapMaterialBufferDescriptorPlan | null;
  readonly diagnostics: readonly MatcapMaterialBufferDescriptorDiagnostic[];
}

export interface CreateMatcapMaterialBufferDescriptorOptions {
  readonly label?: string;
  readonly usage?: number;
}

export interface MatcapMaterialGpuPreparationPlan {
  readonly packed: PackedMatcapMaterial;
  readonly materialBuffer: MatcapMaterialBufferDescriptorPlan;
  readonly materialBufferResourceKey: string;
}

export interface MatcapMaterialGpuPreparationResult {
  readonly valid: boolean;
  readonly plan: MatcapMaterialGpuPreparationPlan | null;
  readonly diagnostics: readonly (
    | MatcapMaterialPackingDiagnostic
    | MatcapMaterialBufferDescriptorDiagnostic
  )[];
}

export type CreateMatcapMaterialGpuPreparationPlanOptions =
  CreateMatcapMaterialBufferDescriptorOptions;

export const DEFAULT_MATCAP_MATERIAL_BUFFER_USAGE =
  WEBGPU_BUFFER_USAGE_FLAGS.UNIFORM | WEBGPU_BUFFER_USAGE_FLAGS.COPY_DST;

export function packMatcapMaterial(
  material: MaterialAsset,
): PackMatcapMaterialResult {
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

  const valid = diagnostics.every(
    (diagnostic) => diagnostic.severity !== "error",
  );

  if (
    !valid ||
    texture === null ||
    texture === undefined ||
    texture.texture === null ||
    texture.sampler === null
  ) {
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

export function createMatcapMaterialBufferDescriptor(
  packed: PackedMatcapMaterial | null,
  options: CreateMatcapMaterialBufferDescriptorOptions = {},
): MatcapMaterialBufferDescriptorResult {
  const diagnostics: MatcapMaterialBufferDescriptorDiagnostic[] = [];
  const usage = options.usage ?? DEFAULT_MATCAP_MATERIAL_BUFFER_USAGE;

  if (!isPositiveInteger(usage)) {
    diagnostics.push({
      code: "matcapMaterialBuffer.invalidUsageFlags",
      field: "usage",
      message:
        "Matcap material uniform buffer usage flags must be a positive integer.",
    });
  }

  if (packed === null) {
    diagnostics.push({
      code: "matcapMaterialBuffer.nullPackedMaterial",
      message:
        "Cannot create a matcap material buffer descriptor from null packed material data.",
    });
    return { valid: false, plan: null, diagnostics };
  }

  if (
    packed.uniform.byteLength !== MATCAP_MATERIAL_UNIFORM_BYTE_LENGTH ||
    packed.uniform.length !== MATCAP_MATERIAL_UNIFORM_FLOATS
  ) {
    diagnostics.push({
      code: "matcapMaterialBuffer.invalidUniformData",
      field: "uniform",
      message:
        "Packed matcap material uniform data must match the documented 16-byte layout.",
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

export function createMatcapMaterialGpuPreparationPlan(
  material: MaterialAsset,
  options: CreateMatcapMaterialGpuPreparationPlanOptions = {},
): MatcapMaterialGpuPreparationResult {
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
      materialBufferResourceKey: materialUniformBufferResourceKey(
        materialBuffer.descriptor.label ?? "matcap",
      ),
    },
    diagnostics,
  };
}

function matcapValidationDiagnostics(
  material: MatcapMaterialAsset,
): MatcapMaterialPackingDiagnostic[] {
  return validateMaterialAsset(material).diagnostics.map((diagnostic) => ({
    code: diagnostic.code,
    severity: "error",
    message: diagnostic.message,
    ...(diagnostic.field === undefined ? {} : { field: diagnostic.field }),
  }));
}

function readBaseColor(material: MatcapMaterialAsset): readonly number[] {
  return [
    material.baseColorFactor[0] ?? 1,
    material.baseColorFactor[1] ?? 1,
    material.baseColorFactor[2] ?? 1,
    material.baseColorFactor[3] ?? 1,
  ];
}

function isPositiveInteger(value: number): boolean {
  return Number.isInteger(value) && value > 0;
}
