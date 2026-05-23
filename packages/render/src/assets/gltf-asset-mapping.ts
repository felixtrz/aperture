import {
  assetHandleKey,
  createMaterialHandle,
  createSamplerHandle,
  createTextureHandle,
} from "@aperture-engine/simulation";
import {
  createMaterialAssetFromGltfMaterial,
  createTextureAssetFromGltfTexture,
  gltfMaterialMappingReportToJsonValue,
  gltfTextureMappingReportToJsonValue,
  type GltfImageDataResolver,
  type GltfMaterialDiagnosticValue,
  type GltfMaterialMappingDiagnosticSeverity,
  type GltfMaterialTextureDependencyKind,
  type GltfMaterialMappingReportJsonValue,
  type GltfMaterialTextureBindingResolver,
  type GltfMaterialTextureBindingResolverDiagnostic,
  type GltfMaterialTextureSlot,
  type GltfTextureMappingDiagnostic,
  type GltfTextureMappingReport,
  type GltfTextureMappingReportJsonValue,
  type MaterialAsset,
  type SamplerAsset,
  type TextureAsset,
} from "../materials/index.js";
import {
  gltfRootValidationReportToJsonValue,
  validateGltfRootForAssetMapping,
  type GltfRootValidationReportJsonValue,
} from "./gltf-root.js";

export type GltfAssetMappingLayer = "root" | "texture" | "material";

export interface GltfAssetMappingDiagnostic {
  readonly layer: GltfAssetMappingLayer;
  readonly code: string;
  readonly severity: GltfMaterialMappingDiagnosticSeverity;
  readonly message: string;
  readonly materialIndex?: number;
  readonly textureIndex?: number;
  readonly samplerIndex?: number;
  readonly slot?: GltfMaterialTextureSlot;
  readonly field?: string;
  readonly extensionName?: string;
  readonly dependencyKind?: GltfMaterialTextureDependencyKind;
  readonly value?: GltfMaterialDiagnosticValue;
}

export interface GltfPlannedTextureAsset {
  readonly handleKey: string;
  readonly textureIndex: number;
  readonly slot: GltfMaterialTextureSlot;
  readonly texture: TextureAsset | null;
  readonly report: GltfTextureMappingReportJsonValue;
}

export interface GltfPlannedSamplerAsset {
  readonly handleKey: string;
  readonly textureIndex: number;
  readonly slot: GltfMaterialTextureSlot;
  readonly source: Record<string, unknown> | null;
  readonly sampler: SamplerAsset | null;
}

export interface GltfPlannedMaterialAsset {
  readonly handleKey: string;
  readonly materialIndex: number;
  readonly material: MaterialAsset | null;
  readonly report: GltfMaterialMappingReportJsonValue;
}

export interface GltfAssetMappingOptions {
  readonly root: unknown;
  readonly resolveImageData: GltfImageDataResolver;
  readonly materialIndices?: readonly number[];
  readonly keyPrefix?: string;
}

export interface GltfAssetMappingReport {
  readonly valid: boolean;
  readonly root: GltfRootValidationReportJsonValue;
  readonly textures: readonly GltfPlannedTextureAsset[];
  readonly samplers: readonly GltfPlannedSamplerAsset[];
  readonly materials: readonly GltfPlannedMaterialAsset[];
  readonly diagnostics: readonly GltfAssetMappingDiagnostic[];
}

export interface GltfPlannedTextureAssetJsonValue {
  readonly handleKey: string;
  readonly textureIndex: number;
  readonly slot: GltfMaterialTextureSlot;
  readonly texture: Record<string, unknown> | null;
  readonly report: GltfTextureMappingReportJsonValue;
}

export interface GltfPlannedMaterialAssetJsonValue {
  readonly handleKey: string;
  readonly materialIndex: number;
  readonly material: Record<string, unknown> | null;
  readonly report: GltfMaterialMappingReportJsonValue;
}

export interface GltfAssetMappingReportJsonValue {
  readonly valid: boolean;
  readonly root: GltfRootValidationReportJsonValue;
  readonly textures: readonly GltfPlannedTextureAssetJsonValue[];
  readonly samplers: readonly GltfPlannedSamplerAsset[];
  readonly materials: readonly GltfPlannedMaterialAssetJsonValue[];
  readonly diagnostics: readonly GltfAssetMappingDiagnostic[];
}

interface TextureReportEntry {
  readonly key: string;
  readonly report: GltfTextureMappingReport;
  readonly textureHandleKey: string;
  readonly samplerHandleKey: string;
}

export function createGltfAssetMappingReport(
  options: GltfAssetMappingOptions,
): GltfAssetMappingReport {
  const rootValidation = validateGltfRootForAssetMapping(options.root);
  const root = gltfRootValidationReportToJsonValue(rootValidation);
  const diagnostics: GltfAssetMappingDiagnostic[] = [
    ...rootValidation.diagnostics.map((diagnostic) => ({
      layer: "root" as const,
      code: diagnostic.code,
      severity: diagnostic.severity,
      message: diagnostic.message,
      ...(diagnostic.field === undefined ? {} : { field: diagnostic.field }),
    })),
  ];

  if (!isRecord(options.root)) {
    return {
      valid: false,
      root,
      textures: [],
      samplers: [],
      materials: [],
      diagnostics,
    };
  }

  const materials = Array.isArray(options.root.materials)
    ? options.root.materials
    : [];
  const materialIndices =
    options.materialIndices ?? materials.map((_, index) => index);
  const textureEntries = new Map<string, TextureReportEntry>();
  const textures: GltfPlannedTextureAsset[] = [];
  const samplers: GltfPlannedSamplerAsset[] = [];
  const plannedMaterials: GltfPlannedMaterialAsset[] = [];
  const extensionsRequired = stringArray(options.root.extensionsRequired);

  for (const materialIndex of materialIndices) {
    const material = materials[materialIndex];
    const materialKey = plannedHandleKey(options, "material", materialIndex);
    const textureSlots = collectMaterialTextureSlots(material);

    for (const textureSlot of textureSlots) {
      const key = textureReportKey(textureSlot.textureIndex, textureSlot.slot);
      if (textureEntries.has(key)) {
        continue;
      }

      const report = createTextureAssetFromGltfTexture({
        textureIndex: textureSlot.textureIndex,
        slot: textureSlot.slot,
        textures: arrayField(options.root, "textures"),
        images: arrayField(options.root, "images"),
        samplers: arrayField(options.root, "samplers"),
        resolveImageData: options.resolveImageData,
        extensionsRequired,
      });
      const textureHandleKey = plannedHandleKey(
        options,
        "texture",
        textureSlot.textureIndex,
        textureSlot.slot,
      );
      const samplerHandleKey = plannedHandleKey(
        options,
        "sampler",
        textureSlot.textureIndex,
        textureSlot.slot,
      );
      textureEntries.set(key, {
        key,
        report,
        textureHandleKey,
        samplerHandleKey,
      });
      textures.push({
        handleKey: textureHandleKey,
        textureIndex: textureSlot.textureIndex,
        slot: textureSlot.slot,
        texture: report.texture,
        report: gltfTextureMappingReportToJsonValue(report),
      });
      samplers.push({
        handleKey: samplerHandleKey,
        textureIndex: textureSlot.textureIndex,
        slot: textureSlot.slot,
        source: samplerSourceForTexture(options.root, textureSlot.textureIndex),
        sampler: report.sampler,
      });
      diagnostics.push(
        ...report.diagnostics.map((diagnostic) =>
          textureDiagnosticToAssetDiagnostic(diagnostic),
        ),
      );
    }

    const materialReport = createMaterialAssetFromGltfMaterial(material, {
      materialKey,
      extensionsRequired,
      resolveTextureBinding: resolverFromTextureEntries(textureEntries),
    });
    plannedMaterials.push({
      handleKey: assetHandleKey(createMaterialHandle(materialKey)),
      materialIndex,
      material: materialReport.material,
      report: gltfMaterialMappingReportToJsonValue(materialReport),
    });
    diagnostics.push(
      ...materialReport.diagnostics.map((diagnostic) => ({
        layer: "material" as const,
        code: diagnostic.code,
        severity: diagnostic.severity,
        message: diagnostic.message,
        materialIndex,
        ...(diagnostic.textureIndex === undefined
          ? {}
          : { textureIndex: diagnostic.textureIndex }),
        ...(diagnostic.samplerIndex === undefined
          ? {}
          : { samplerIndex: diagnostic.samplerIndex }),
        ...(diagnostic.slot === undefined ? {} : { slot: diagnostic.slot }),
        ...(diagnostic.field === undefined ? {} : { field: diagnostic.field }),
        ...(diagnostic.extensionName === undefined
          ? {}
          : { extensionName: diagnostic.extensionName }),
        ...(diagnostic.dependencyKind === undefined
          ? {}
          : { dependencyKind: diagnostic.dependencyKind }),
        ...(diagnostic.value === undefined ? {} : { value: diagnostic.value }),
      })),
    );
  }

  return {
    valid: diagnostics.every((diagnostic) => diagnostic.severity !== "error"),
    root,
    textures,
    samplers,
    materials: plannedMaterials,
    diagnostics,
  };
}

export function gltfAssetMappingReportToJsonValue(
  report: GltfAssetMappingReport,
): GltfAssetMappingReportJsonValue {
  return {
    valid: report.valid,
    root: report.root,
    textures: report.textures.map((texture) => ({
      ...texture,
      texture: texture.report.texture,
    })),
    samplers: report.samplers.map((sampler) => ({ ...sampler })),
    materials: report.materials.map((material) => ({
      ...material,
      material: material.report.material,
    })),
    diagnostics: report.diagnostics.map((diagnostic) => ({ ...diagnostic })),
  };
}

export function gltfAssetMappingReportToJson(
  report: GltfAssetMappingReport,
): string {
  return JSON.stringify(gltfAssetMappingReportToJsonValue(report));
}

function resolverFromTextureEntries(
  entries: ReadonlyMap<string, TextureReportEntry>,
): GltfMaterialTextureBindingResolver {
  return (input) => {
    const entry = entries.get(textureReportKey(input.textureIndex, input.slot));
    if (
      entry !== undefined &&
      entry.report.valid &&
      entry.report.texture !== null &&
      entry.report.sampler !== null
    ) {
      return {
        texture: createTextureHandle(entry.textureHandleKey),
        sampler: createSamplerHandle(entry.samplerHandleKey),
      };
    }

    return {
      diagnostics: (entry?.report.diagnostics ?? []).map((diagnostic) =>
        textureDiagnosticToResolverDiagnostic(diagnostic),
      ),
    };
  };
}

function textureDiagnosticToResolverDiagnostic(
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

function textureDiagnosticToAssetDiagnostic(
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

function collectMaterialTextureSlots(material: unknown): readonly {
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
  return [
    textureSlot(pbr?.baseColorTexture, "baseColorTexture"),
    textureSlot(pbr?.metallicRoughnessTexture, "metallicRoughnessTexture"),
    textureSlot(clearcoat?.clearcoatTexture, "clearcoatTexture"),
    textureSlot(material.normalTexture, "normalTexture"),
    textureSlot(material.occlusionTexture, "occlusionTexture"),
    textureSlot(material.emissiveTexture, "emissiveTexture"),
  ].filter(
    (slot): slot is { slot: GltfMaterialTextureSlot; textureIndex: number } =>
      slot !== null,
  );
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

function textureReportKey(
  textureIndex: number,
  slot: GltfMaterialTextureSlot,
): string {
  return `${textureIndex}:${slot}`;
}

function plannedHandleKey(
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

function samplerSourceForTexture(
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

function arrayField(
  root: Record<string, unknown>,
  field: string,
): readonly unknown[] {
  const value = root[field];
  return Array.isArray(value) ? value : [];
}

function stringArray(value: unknown): readonly string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function recordField(
  source: Record<string, unknown>,
  field: string,
): Record<string, unknown> | undefined {
  const value = source[field];
  return isRecord(value) ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
