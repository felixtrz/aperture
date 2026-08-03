import { assetHandleKey } from "@aperture-engine/simulation";
import type {
  MaterialAsset,
  MaterialTextureBinding,
  UnlitMaterialAsset,
} from "./types.js";

export const UNLIT_MATERIAL_UNIFORM_FLOATS = 12;

export const UNLIT_MATERIAL_UNIFORM_LAYOUT = [
  "baseColorFactor.r",
  "baseColorFactor.g",
  "baseColorFactor.b",
  "baseColorFactor.a",
  "baseColorTextureTransform.offsetX",
  "baseColorTextureTransform.offsetY",
  "baseColorTextureTransform.scaleX",
  "baseColorTextureTransform.scaleY",
  "baseColorTextureTransform.rotation",
  "padding0",
  "padding1",
  "padding2",
] as const;

export type UnlitMaterialPackingDiagnosticCode =
  | "materialPack.unsupportedMaterialKind"
  | "materialPack.missingTextureHandle"
  | "materialPack.missingSamplerHandle";

export interface UnlitMaterialPackingDiagnostic {
  readonly code: UnlitMaterialPackingDiagnosticCode;
  readonly message: string;
  readonly field?: string;
}

export interface UnlitMaterialResourceDependencies {
  readonly baseColorTextureKey: string | null;
  readonly baseColorSamplerKey: string | null;
}

export interface PackedUnlitMaterial {
  readonly uniform: Float32Array;
  readonly uniformLayout: typeof UNLIT_MATERIAL_UNIFORM_LAYOUT;
  readonly dependencies: UnlitMaterialResourceDependencies;
}

export interface PackUnlitMaterialResult {
  readonly valid: boolean;
  readonly packed: PackedUnlitMaterial | null;
  readonly diagnostics: readonly UnlitMaterialPackingDiagnostic[];
}

export function packUnlitMaterial(
  material: MaterialAsset,
): PackUnlitMaterialResult {
  if (material.kind !== "unlit") {
    return {
      valid: false,
      packed: null,
      diagnostics: [
        {
          code: "materialPack.unsupportedMaterialKind",
          field: "kind",
          message: `Unlit material packing does not support '${material.kind}' materials.`,
        },
      ],
    };
  }

  const diagnostics: UnlitMaterialPackingDiagnostic[] = [];
  const dependencies = collectUnlitDependencies(
    material.baseColorTexture,
    diagnostics,
  );
  const packed: PackedUnlitMaterial = {
    uniform: new Float32Array([
      readColor(material, 0),
      readColor(material, 1),
      readColor(material, 2),
      readColor(material, 3),
      // KHR_texture_transform-shaped atlas sub-rect for the base color
      // binding; identity when the material does not declare one, so
      // untransformed materials render byte-identically to the 4-float era.
      ...readBaseColorTextureTransform(material.baseColorTexture),
    ]),
    uniformLayout: UNLIT_MATERIAL_UNIFORM_LAYOUT,
    dependencies,
  };

  return {
    valid: diagnostics.length === 0,
    packed: diagnostics.length === 0 ? packed : null,
    diagnostics,
  };
}

function collectUnlitDependencies(
  binding: MaterialTextureBinding | null,
  diagnostics: UnlitMaterialPackingDiagnostic[],
): UnlitMaterialResourceDependencies {
  if (binding === null) {
    return { baseColorTextureKey: null, baseColorSamplerKey: null };
  }

  if (binding.texture === null) {
    diagnostics.push({
      code: "materialPack.missingTextureHandle",
      field: "baseColorTexture.texture",
      message: "Unlit base color texture binding is missing a texture handle.",
    });
  }

  if (binding.sampler === null) {
    diagnostics.push({
      code: "materialPack.missingSamplerHandle",
      field: "baseColorTexture.sampler",
      message: "Unlit base color texture binding is missing a sampler handle.",
    });
  }

  return {
    baseColorTextureKey:
      binding.texture === null ? null : assetHandleKey(binding.texture),
    baseColorSamplerKey:
      binding.sampler === null ? null : assetHandleKey(binding.sampler),
  };
}

function readBaseColorTextureTransform(
  binding: MaterialTextureBinding | null,
): readonly [number, number, number, number, number, number, number, number] {
  const transform = binding?.transform;

  if (transform === undefined) {
    return [0, 0, 1, 1, 0, 0, 0, 0];
  }

  return [
    transform.offset?.[0] ?? 0,
    transform.offset?.[1] ?? 0,
    transform.scale?.[0] ?? 1,
    transform.scale?.[1] ?? 1,
    transform.rotation ?? 0,
    0,
    0,
    0,
  ];
}

function readColor(material: UnlitMaterialAsset, index: number): number {
  const value = material.baseColorFactor[index];

  if (value === undefined) {
    throw new RangeError(
      `Unlit baseColorFactor is missing value at index ${index}.`,
    );
  }

  return value;
}
