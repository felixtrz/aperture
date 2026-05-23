import {
  assetHandleKey,
  type SamplerHandle,
  type TextureHandle,
} from "@aperture-engine/simulation";
import {
  validateStandardMaterialProofPoint,
  type MaterialAsset,
  type MaterialTextureBinding,
  type StandardMaterialAsset,
  type StandardMaterialProofPointDiagnostic,
} from "@aperture-engine/render";
import type { WebGpuBufferDescriptor } from "./buffer.js";
import { WEBGPU_BUFFER_USAGE_FLAGS } from "./mesh-buffer-descriptors.js";
import { materialUniformBufferResourceKey } from "./resource-keys.js";
import { createStandardMaterialBindGroupDescriptorPlan } from "./standard-bind-group.js";

export const STANDARD_MATERIAL_UNIFORM_FLOATS = 64;
export const STANDARD_MATERIAL_UNIFORM_BYTE_LENGTH =
  STANDARD_MATERIAL_UNIFORM_FLOATS * Float32Array.BYTES_PER_ELEMENT;

export const STANDARD_MATERIAL_UNIFORM_LAYOUT = [
  "baseColorFactor.r",
  "baseColorFactor.g",
  "baseColorFactor.b",
  "baseColorFactor.a",
  "emissiveFactor.r",
  "emissiveFactor.g",
  "emissiveFactor.b",
  "metallicFactor",
  "roughnessFactor",
  "normalScale",
  "occlusionStrength",
  "alphaCutoff",
  "featureFlags.u32",
  "baseColorTexCoord.u32",
  "metallicRoughnessTexCoord.u32",
  "normalTexCoord.u32",
  "occlusionTexCoord.u32",
  "emissiveTexCoord.u32",
  "baseColorTextureOffset.u",
  "baseColorTextureOffset.v",
  "baseColorTextureScale.u",
  "baseColorTextureScale.v",
  "baseColorTextureRotation",
  "padding1",
  "metallicRoughnessTextureOffset.u",
  "metallicRoughnessTextureOffset.v",
  "metallicRoughnessTextureScale.u",
  "metallicRoughnessTextureScale.v",
  "metallicRoughnessTextureRotation",
  "padding2",
  "normalTextureOffset.u",
  "normalTextureOffset.v",
  "normalTextureScale.u",
  "normalTextureScale.v",
  "normalTextureRotation",
  "padding3",
  "occlusionTextureOffset.u",
  "occlusionTextureOffset.v",
  "occlusionTextureScale.u",
  "occlusionTextureScale.v",
  "occlusionTextureRotation",
  "padding4",
  "emissiveTextureOffset.u",
  "emissiveTextureOffset.v",
  "emissiveTextureScale.u",
  "emissiveTextureScale.v",
  "emissiveTextureRotation",
  "padding5",
  "clearcoatFactor",
  "clearcoatRoughnessFactor",
  "transmissionFactor",
  "clearcoatTexCoord.u32",
  "sheenColorFactor.r",
  "sheenColorFactor.g",
  "sheenColorFactor.b",
  "sheenRoughnessFactor",
  "iridescenceFactor",
  "iridescenceIor",
  "iridescenceThicknessMinimum",
  "iridescenceThicknessMaximum",
  "transmissionTexCoord.u32",
  "sheenColorTexCoord.u32",
  "padding6.y",
  "padding6.z",
] as const;

export const STANDARD_MATERIAL_FEATURE_FLAGS = {
  BASE_COLOR_TEXTURE: 1 << 0,
  METALLIC_ROUGHNESS_TEXTURE: 1 << 1,
  NORMAL_TEXTURE: 1 << 2,
  OCCLUSION_TEXTURE: 1 << 3,
  EMISSIVE_TEXTURE: 1 << 4,
  ALPHA_MASK: 1 << 5,
  ALPHA_BLEND: 1 << 6,
  DOUBLE_SIDED: 1 << 7,
  CLEARCOAT_TEXTURE: 1 << 8,
  TRANSMISSION_TEXTURE: 1 << 9,
  SHEEN_COLOR_TEXTURE: 1 << 10,
} as const;

export type StandardMaterialFeatureFlag =
  (typeof STANDARD_MATERIAL_FEATURE_FLAGS)[keyof typeof STANDARD_MATERIAL_FEATURE_FLAGS];

export type StandardMaterialPackingDiagnosticCode =
  | "standardMaterialPack.unsupportedMaterialKind"
  | "standardMaterialPack.missingTextureHandle"
  | "standardMaterialPack.missingSamplerHandle"
  | StandardMaterialProofPointDiagnostic["code"];

export interface StandardMaterialPackingDiagnostic {
  readonly code: StandardMaterialPackingDiagnosticCode;
  readonly message: string;
  readonly field?: string;
  readonly severity: "warning" | "error";
}

export interface StandardMaterialTextureDependency {
  readonly textureKey: string | null;
  readonly samplerKey: string | null;
  readonly texCoord: number;
}

export interface StandardMaterialResourceDependencies {
  readonly baseColor: StandardMaterialTextureDependency;
  readonly metallicRoughness: StandardMaterialTextureDependency;
  readonly normal: StandardMaterialTextureDependency;
  readonly occlusion: StandardMaterialTextureDependency;
  readonly emissive: StandardMaterialTextureDependency;
  readonly clearcoat: StandardMaterialTextureDependency;
  readonly transmission: StandardMaterialTextureDependency;
  readonly sheenColor: StandardMaterialTextureDependency;
}

export interface PackedStandardMaterial {
  readonly uniform: Uint8Array;
  readonly uniformFloat32: Float32Array;
  readonly uniformUint32: Uint32Array;
  readonly uniformLayout: typeof STANDARD_MATERIAL_UNIFORM_LAYOUT;
  readonly featureFlags: number;
  readonly dependencies: StandardMaterialResourceDependencies;
}

export interface PackStandardMaterialResult {
  readonly valid: boolean;
  readonly packed: PackedStandardMaterial | null;
  readonly diagnostics: readonly StandardMaterialPackingDiagnostic[];
}

export type StandardMaterialBufferDescriptorDiagnosticCode =
  | "standardMaterialBuffer.nullPackedMaterial"
  | "standardMaterialBuffer.invalidUniformData"
  | "standardMaterialBuffer.invalidUsageFlags";

export interface StandardMaterialBufferDescriptorDiagnostic {
  readonly code: StandardMaterialBufferDescriptorDiagnosticCode;
  readonly message: string;
  readonly field?: string;
}

export interface StandardMaterialBufferDescriptorPlan {
  readonly descriptor: WebGpuBufferDescriptor;
  readonly source: Uint8Array;
  readonly dependencies: StandardMaterialResourceDependencies;
  readonly featureFlags: number;
}

export interface StandardMaterialBufferDescriptorResult {
  readonly valid: boolean;
  readonly plan: StandardMaterialBufferDescriptorPlan | null;
  readonly diagnostics: readonly StandardMaterialBufferDescriptorDiagnostic[];
}

export interface CreateStandardMaterialBufferDescriptorOptions {
  readonly label?: string;
  readonly usage?: number;
}

export interface StandardMaterialPreparationPlan {
  readonly packed: PackedStandardMaterial;
  readonly materialBuffer: StandardMaterialBufferDescriptorPlan;
  readonly materialBufferResourceKey: string;
  readonly materialBindGroup: ReturnType<
    typeof createStandardMaterialBindGroupDescriptorPlan
  >;
}

export interface StandardMaterialPreparationResult {
  readonly valid: boolean;
  readonly plan: StandardMaterialPreparationPlan | null;
  readonly diagnostics: readonly (
    | StandardMaterialPackingDiagnostic
    | StandardMaterialBufferDescriptorDiagnostic
  )[];
}

export type CreateStandardMaterialPreparationPlanOptions =
  CreateStandardMaterialBufferDescriptorOptions;

export const DEFAULT_STANDARD_MATERIAL_BUFFER_USAGE =
  WEBGPU_BUFFER_USAGE_FLAGS.UNIFORM | WEBGPU_BUFFER_USAGE_FLAGS.COPY_DST;

export function packStandardMaterial(
  material: MaterialAsset,
): PackStandardMaterialResult {
  if (material.kind !== "standard") {
    return {
      valid: false,
      packed: null,
      diagnostics: [
        {
          code: "standardMaterialPack.unsupportedMaterialKind",
          field: "kind",
          severity: "error",
          message: `Standard material packing does not support '${material.kind}' materials.`,
        },
      ],
    };
  }

  const proofPoint = validateStandardMaterialProofPoint(material);
  const diagnostics: StandardMaterialPackingDiagnostic[] =
    proofPoint.diagnostics.map((diagnostic) => ({
      code: diagnostic.code,
      field: diagnostic.field,
      severity: diagnostic.severity,
      message: diagnostic.message,
    }));
  const dependencies = collectStandardMaterialDependencies(
    material,
    diagnostics,
  );
  const valid = diagnostics.every(
    (diagnostic) => diagnostic.severity !== "error",
  );

  if (!valid) {
    return { valid: false, packed: null, diagnostics };
  }

  const buffer = new ArrayBuffer(STANDARD_MATERIAL_UNIFORM_BYTE_LENGTH);
  const uniformFloat32 = new Float32Array(buffer);
  const uniformUint32 = new Uint32Array(buffer);
  const featureFlags = standardMaterialFeatureFlags(material);

  uniformFloat32.set(readBaseColor(material), 0);
  uniformFloat32[4] = material.emissiveFactor[0] ?? 0;
  uniformFloat32[5] = material.emissiveFactor[1] ?? 0;
  uniformFloat32[6] = material.emissiveFactor[2] ?? 0;
  uniformFloat32[7] = material.metallicFactor;
  uniformFloat32[8] = material.roughnessFactor;
  uniformFloat32[9] = material.normalScale;
  uniformFloat32[10] = material.occlusionStrength;
  uniformFloat32[11] = material.renderState.alphaCutoff;
  uniformUint32[12] = featureFlags;
  uniformUint32[13] = dependencies.baseColor.texCoord;
  uniformUint32[14] = dependencies.metallicRoughness.texCoord;
  uniformUint32[15] = dependencies.normal.texCoord;
  uniformUint32[16] = dependencies.occlusion.texCoord;
  uniformUint32[17] = dependencies.emissive.texCoord;
  uniformFloat32.set(readTextureTransform(material.baseColorTexture), 18);
  uniformFloat32.set(
    readTextureTransform(material.metallicRoughnessTexture),
    24,
  );
  uniformFloat32.set(readTextureTransform(material.normalTexture), 30);
  uniformFloat32.set(readTextureTransform(material.occlusionTexture), 36);
  uniformFloat32.set(readTextureTransform(material.emissiveTexture), 42);
  uniformFloat32[48] = material.clearcoatFactor;
  uniformFloat32[49] = material.clearcoatRoughnessFactor;
  uniformFloat32[50] = material.transmissionFactor;
  uniformUint32[51] = dependencies.clearcoat.texCoord;
  uniformFloat32.set(material.sheenColorFactor, 52);
  uniformFloat32[55] = material.sheenRoughnessFactor;
  uniformFloat32[56] = material.iridescenceFactor;
  uniformFloat32[57] = material.iridescenceIor;
  uniformFloat32[58] = material.iridescenceThicknessMinimum;
  uniformFloat32[59] = material.iridescenceThicknessMaximum;
  uniformUint32[60] = dependencies.transmission.texCoord;
  uniformUint32[61] = dependencies.sheenColor.texCoord;

  return {
    valid: true,
    packed: {
      uniform: new Uint8Array(buffer),
      uniformFloat32,
      uniformUint32,
      uniformLayout: STANDARD_MATERIAL_UNIFORM_LAYOUT,
      featureFlags,
      dependencies,
    },
    diagnostics,
  };
}

function readTextureTransform(
  binding: MaterialTextureBinding | null,
): readonly [number, number, number, number, number, number] {
  const transform = binding?.transform;

  if (transform === undefined) {
    return [0, 0, 1, 1, 0, 0];
  }

  return [
    transform.offset?.[0] ?? 0,
    transform.offset?.[1] ?? 0,
    transform.scale?.[0] ?? 1,
    transform.scale?.[1] ?? 1,
    transform.rotation ?? 0,
    0,
  ];
}

export function createStandardMaterialBufferDescriptor(
  packed: PackedStandardMaterial | null,
  options: CreateStandardMaterialBufferDescriptorOptions = {},
): StandardMaterialBufferDescriptorResult {
  const diagnostics: StandardMaterialBufferDescriptorDiagnostic[] = [];
  const usage = options.usage ?? DEFAULT_STANDARD_MATERIAL_BUFFER_USAGE;

  if (!isPositiveInteger(usage)) {
    diagnostics.push({
      code: "standardMaterialBuffer.invalidUsageFlags",
      field: "usage",
      message:
        "Standard material uniform buffer usage flags must be a positive integer.",
    });
  }

  if (packed === null) {
    diagnostics.push({
      code: "standardMaterialBuffer.nullPackedMaterial",
      message:
        "Cannot create a standard material buffer descriptor from null packed material data.",
    });
    return { valid: false, plan: null, diagnostics };
  }

  if (
    packed.uniform.byteLength !== STANDARD_MATERIAL_UNIFORM_BYTE_LENGTH ||
    packed.uniformFloat32.length !== STANDARD_MATERIAL_UNIFORM_FLOATS ||
    packed.uniformUint32.length !== STANDARD_MATERIAL_UNIFORM_FLOATS
  ) {
    diagnostics.push({
      code: "standardMaterialBuffer.invalidUniformData",
      field: "uniform",
      message: `Packed standard material uniform data must match the documented ${STANDARD_MATERIAL_UNIFORM_BYTE_LENGTH}-byte layout.`,
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
      featureFlags: packed.featureFlags,
      descriptor: {
        label: options.label ?? "StandardMaterial/uniform",
        size: packed.uniform.byteLength,
        usage,
        initialData: packed.uniform,
      },
    },
    diagnostics,
  };
}

export function createStandardMaterialPreparationPlan(
  material: MaterialAsset,
  options: CreateStandardMaterialPreparationPlanOptions = {},
): StandardMaterialPreparationResult {
  const packing = packStandardMaterial(material);
  const buffer = createStandardMaterialBufferDescriptor(
    packing.packed,
    options,
  );
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

  const materialBufferResourceKey = materialUniformBufferResourceKey(
    materialBuffer.descriptor.label ?? "standard",
  );
  const materialBindGroup = createStandardMaterialBindGroupDescriptorPlan({
    materialResourceKey: materialBufferResourceKey,
    dependencies: materialBuffer.dependencies,
  });

  return {
    valid: materialBindGroup.valid,
    plan: {
      packed: packing.packed,
      materialBuffer,
      materialBufferResourceKey,
      materialBindGroup,
    },
    diagnostics,
  };
}

function collectStandardMaterialDependencies(
  material: StandardMaterialAsset,
  diagnostics: StandardMaterialPackingDiagnostic[],
): StandardMaterialResourceDependencies {
  return {
    baseColor: textureDependency(
      "baseColorTexture",
      material.baseColorTexture,
      diagnostics,
    ),
    metallicRoughness: textureDependency(
      "metallicRoughnessTexture",
      material.metallicRoughnessTexture,
      diagnostics,
    ),
    normal: textureDependency(
      "normalTexture",
      material.normalTexture,
      diagnostics,
    ),
    occlusion: textureDependency(
      "occlusionTexture",
      material.occlusionTexture,
      diagnostics,
    ),
    emissive: textureDependency(
      "emissiveTexture",
      material.emissiveTexture,
      diagnostics,
    ),
    clearcoat: textureDependency(
      "clearcoatTexture",
      material.clearcoatTexture,
      diagnostics,
    ),
    transmission: textureDependency(
      "transmissionTexture",
      material.transmissionTexture,
      diagnostics,
    ),
    sheenColor: textureDependency(
      "sheenColorTexture",
      material.sheenColorTexture,
      diagnostics,
    ),
  };
}

function textureDependency(
  field: string,
  binding: MaterialTextureBinding | null,
  diagnostics: StandardMaterialPackingDiagnostic[],
): StandardMaterialTextureDependency {
  if (binding === null) {
    return { textureKey: null, samplerKey: null, texCoord: 0 };
  }

  if (binding.texture === null) {
    diagnostics.push({
      code: "standardMaterialPack.missingTextureHandle",
      field: `${field}.texture`,
      severity: "error",
      message: `${field} is missing a texture handle.`,
    });
  }

  if (binding.sampler === null) {
    diagnostics.push({
      code: "standardMaterialPack.missingSamplerHandle",
      field: `${field}.sampler`,
      severity: "error",
      message: `${field} is missing a sampler handle.`,
    });
  }

  return {
    textureKey: handleKey(binding.texture),
    samplerKey: handleKey(binding.sampler),
    texCoord: binding.texCoord ?? 0,
  };
}

function standardMaterialFeatureFlags(material: StandardMaterialAsset): number {
  let flags = 0;

  if (material.baseColorTexture !== null) {
    flags |= STANDARD_MATERIAL_FEATURE_FLAGS.BASE_COLOR_TEXTURE;
  }

  if (material.metallicRoughnessTexture !== null) {
    flags |= STANDARD_MATERIAL_FEATURE_FLAGS.METALLIC_ROUGHNESS_TEXTURE;
  }

  if (material.normalTexture !== null) {
    flags |= STANDARD_MATERIAL_FEATURE_FLAGS.NORMAL_TEXTURE;
  }

  if (material.occlusionTexture !== null) {
    flags |= STANDARD_MATERIAL_FEATURE_FLAGS.OCCLUSION_TEXTURE;
  }

  if (material.emissiveTexture !== null) {
    flags |= STANDARD_MATERIAL_FEATURE_FLAGS.EMISSIVE_TEXTURE;
  }

  if (material.clearcoatTexture !== null) {
    flags |= STANDARD_MATERIAL_FEATURE_FLAGS.CLEARCOAT_TEXTURE;
  }

  if (material.transmissionTexture !== null) {
    flags |= STANDARD_MATERIAL_FEATURE_FLAGS.TRANSMISSION_TEXTURE;
  }

  if (material.sheenColorTexture !== null) {
    flags |= STANDARD_MATERIAL_FEATURE_FLAGS.SHEEN_COLOR_TEXTURE;
  }

  if (material.renderState.alphaMode === "mask") {
    flags |= STANDARD_MATERIAL_FEATURE_FLAGS.ALPHA_MASK;
  }

  if (material.renderState.alphaMode === "blend") {
    flags |= STANDARD_MATERIAL_FEATURE_FLAGS.ALPHA_BLEND;
  }

  if (material.renderState.cullMode === "none") {
    flags |= STANDARD_MATERIAL_FEATURE_FLAGS.DOUBLE_SIDED;
  }

  return flags;
}

function readBaseColor(material: StandardMaterialAsset): readonly number[] {
  return [
    readColor(material.baseColorFactor, 0, "baseColorFactor"),
    readColor(material.baseColorFactor, 1, "baseColorFactor"),
    readColor(material.baseColorFactor, 2, "baseColorFactor"),
    readColor(material.baseColorFactor, 3, "baseColorFactor"),
  ];
}

function readColor(
  values: ArrayLike<number>,
  index: number,
  field: string,
): number {
  const value = values[index];

  if (value === undefined) {
    throw new RangeError(`${field} is missing value at index ${index}.`);
  }

  return value;
}

function handleKey(
  handle: TextureHandle | SamplerHandle | null,
): string | null {
  return handle === null ? null : assetHandleKey(handle);
}

function isPositiveInteger(value: number): boolean {
  return Number.isInteger(value) && value > 0;
}
