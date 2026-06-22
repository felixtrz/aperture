import type {
  GltfMaterialTextureBindingResolverDiagnostic,
  GltfMaterialTextureSlot,
  GltfTextureMappingDiagnostic,
} from "../materials/index.js";
import type {
  GltfAssetMappingDiagnostic,
  GltfAssetMappingOptions,
} from "./gltf-asset-mapping-types.js";

export function textureDiagnosticToResolverDiagnostic(
  diagnostic: GltfTextureMappingDiagnostic,
): GltfMaterialTextureBindingResolverDiagnostic {
  const samplerFailure =
    diagnostic.code === "gltfTexture.invalidSamplerIndex" ||
    diagnostic.code === "gltfTexture.invalidSampler";

  return {
    dependencyKind: samplerFailure ? "sampler" : "texture",
    message: diagnostic.message,
    ...(diagnostic.samplerIndex === undefined
      ? {}
      : { samplerIndex: diagnostic.samplerIndex }),
  };
}

export function textureDiagnosticToAssetDiagnostic(
  diagnostic: GltfTextureMappingDiagnostic,
): GltfAssetMappingDiagnostic {
  return {
    layer: "texture",
    code: diagnostic.code,
    severity: diagnostic.severity,
    message: diagnostic.message,
    textureIndex: diagnostic.textureIndex,
    slot: diagnostic.slot,
    ...(diagnostic.samplerIndex === undefined
      ? {}
      : { samplerIndex: diagnostic.samplerIndex }),
    ...(diagnostic.field === undefined ? {} : { field: diagnostic.field }),
    ...(diagnostic.value === undefined ? {} : { value: diagnostic.value }),
  };
}

export function collectMaterialTextureSlots(material: unknown): readonly {
  readonly slot: GltfMaterialTextureSlot;
  readonly textureIndex: number;
}[] {
  if (!isRecord(material)) {
    return [];
  }

  const pbr = recordField(material, "pbrMetallicRoughness");
  const clearcoat = recordField(
    recordField(material, "extensions") ?? {},
    "KHR_materials_clearcoat",
  );
  const transmission = recordField(
    recordField(material, "extensions") ?? {},
    "KHR_materials_transmission",
  );
  const sheen = recordField(
    recordField(material, "extensions") ?? {},
    "KHR_materials_sheen",
  );
  const iridescence = recordField(
    recordField(material, "extensions") ?? {},
    "KHR_materials_iridescence",
  );
  return [
    textureSlot(pbr?.baseColorTexture, "baseColorTexture"),
    textureSlot(pbr?.metallicRoughnessTexture, "metallicRoughnessTexture"),
    textureSlot(clearcoat?.clearcoatTexture, "clearcoatTexture"),
    textureSlot(
      clearcoat?.clearcoatRoughnessTexture,
      "clearcoatRoughnessTexture",
    ),
    textureSlot(transmission?.transmissionTexture, "transmissionTexture"),
    textureSlot(sheen?.sheenColorTexture, "sheenColorTexture"),
    textureSlot(sheen?.sheenRoughnessTexture, "sheenRoughnessTexture"),
    textureSlot(iridescence?.iridescenceTexture, "iridescenceTexture"),
    textureSlot(
      iridescence?.iridescenceThicknessTexture,
      "iridescenceThicknessTexture",
    ),
    textureSlot(material.normalTexture, "normalTexture"),
    textureSlot(material.occlusionTexture, "occlusionTexture"),
    textureSlot(material.emissiveTexture, "emissiveTexture"),
  ].filter(
    (slot): slot is { slot: GltfMaterialTextureSlot; textureIndex: number } =>
      slot !== null,
  );
}

export function textureReportKey(
  textureIndex: number,
  slot: GltfMaterialTextureSlot,
): string {
  return `${textureIndex}:${slot}`;
}

export function plannedHandleKey(
  options: GltfAssetMappingOptions,
  kind: "material" | "sampler" | "texture",
  index: number,
  slot?: GltfMaterialTextureSlot,
): string {
  const prefix = options.keyPrefix ?? "gltf";
  return slot === undefined
    ? `${prefix}:${kind}:${index}`
    : `${prefix}:${kind}:${index}:${slot}`;
}

export function samplerSourceForTexture(
  root: Record<string, unknown>,
  textureIndex: number,
): Record<string, unknown> | null {
  const texture = arrayField(root, "textures")[textureIndex];

  if (!isRecord(texture) || typeof texture.sampler !== "number") {
    return null;
  }

  const sampler = arrayField(root, "samplers")[texture.sampler];
  return isRecord(sampler) ? sampler : null;
}

export function arrayField(
  root: Record<string, unknown>,
  field: string,
): readonly unknown[] {
  const value = root[field];
  return Array.isArray(value) ? value : [];
}

export function stringArray(value: unknown): readonly string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function textureSlot(
  textureInfo: unknown,
  slot: GltfMaterialTextureSlot,
): {
  readonly slot: GltfMaterialTextureSlot;
  readonly textureIndex: number;
} | null {
  if (!isRecord(textureInfo) || !Number.isInteger(textureInfo.index)) {
    return null;
  }

  const textureIndex = textureInfo.index;
  return typeof textureIndex === "number" && textureIndex >= 0
    ? { slot, textureIndex }
    : null;
}

function recordField(
  source: Record<string, unknown>,
  field: string,
): Record<string, unknown> | undefined {
  const value = source[field];
  return isRecord(value) ? value : undefined;
}
