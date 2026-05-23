import { createDefaultRenderState } from "./factories.js";
import {
  createStandardMaterialAsset,
  createUnlitMaterialAsset,
} from "./factories.js";
import type {
  MaterialAsset,
  MaterialTextureBinding,
  MaterialTextureTransform,
  RenderStateDescriptor,
} from "./types.js";

export type GltfMaterialTextureSlot =
  | "baseColorTexture"
  | "metallicRoughnessTexture"
  | "clearcoatTexture"
  | "clearcoatRoughnessTexture"
  | "transmissionTexture"
  | "sheenColorTexture"
  | "sheenRoughnessTexture"
  | "iridescenceTexture"
  | "iridescenceThicknessTexture"
  | "normalTexture"
  | "occlusionTexture"
  | "emissiveTexture";

export type GltfMaterialTextureDependencyKind = "texture" | "sampler";

export type GltfMaterialMappingDiagnosticSeverity = "error" | "warning";

export type GltfMaterialMappingDiagnosticCode =
  | "gltfMaterial.unsupportedRequiredExtension"
  | "gltfMaterial.unsupportedOptionalExtension"
  | "gltfMaterial.malformedMaterial"
  | "gltfMaterial.invalidField"
  | "gltfMaterial.invalidTextureInfo"
  | "gltfMaterial.unresolvedTextureBinding"
  | "gltfMaterial.unsupportedUnlitField"
  | "gltfMaterial.unsupportedTextureTransform";

export type GltfMaterialDiagnosticValue = string | number | boolean | null;

export interface GltfMaterialMappingDiagnostic {
  readonly code: GltfMaterialMappingDiagnosticCode;
  readonly severity: GltfMaterialMappingDiagnosticSeverity;
  readonly message: string;
  readonly materialKey: string;
  readonly field?: string;
  readonly slot?: GltfMaterialTextureSlot;
  readonly extensionName?: string;
  readonly dependencyKind?: GltfMaterialTextureDependencyKind;
  readonly textureIndex?: number;
  readonly samplerIndex?: number;
  readonly value?: GltfMaterialDiagnosticValue;
}

export interface GltfMaterialTextureBindingResolverInput {
  readonly materialKey: string;
  readonly slot: GltfMaterialTextureSlot;
  readonly field: string;
  readonly textureInfo: Record<string, unknown>;
  readonly textureIndex: number;
  readonly texCoord: number;
  readonly transform?: MaterialTextureTransform;
}

export interface GltfMaterialTextureBindingResolverDiagnostic {
  readonly code?: GltfMaterialMappingDiagnosticCode;
  readonly severity?: GltfMaterialMappingDiagnosticSeverity;
  readonly message: string;
  readonly field?: string;
  readonly dependencyKind?: GltfMaterialTextureDependencyKind;
  readonly textureIndex?: number;
  readonly samplerIndex?: number;
  readonly value?: GltfMaterialDiagnosticValue;
}

export interface GltfMaterialTextureBindingResolverReport {
  readonly binding?: MaterialTextureBinding | null;
  readonly diagnostics?: readonly GltfMaterialTextureBindingResolverDiagnostic[];
}

export type GltfMaterialTextureBindingResolverResult =
  | MaterialTextureBinding
  | GltfMaterialTextureBindingResolverReport
  | null
  | undefined;

export type GltfMaterialTextureBindingResolver = (
  input: GltfMaterialTextureBindingResolverInput,
) => GltfMaterialTextureBindingResolverResult;

export interface GltfMaterialMappingOptions {
  readonly materialKey?: string;
  readonly extensionsRequired?: readonly string[];
  readonly resolveTextureBinding?: GltfMaterialTextureBindingResolver;
}

export interface GltfMaterialMappingReport {
  readonly valid: boolean;
  readonly material: MaterialAsset | null;
  readonly diagnostics: readonly GltfMaterialMappingDiagnostic[];
}

export interface GltfMaterialMappingReportJsonValue {
  readonly valid: boolean;
  readonly material: Record<string, unknown> | null;
  readonly diagnostics: readonly GltfMaterialMappingDiagnostic[];
}

const CLEARCOAT_EXTENSION = "KHR_materials_clearcoat";
const TRANSMISSION_EXTENSION = "KHR_materials_transmission";
const SHEEN_EXTENSION = "KHR_materials_sheen";
const IRIDESCENCE_EXTENSION = "KHR_materials_iridescence";
const SUPPORTED_MATERIAL_EXTENSIONS = new Set([
  "KHR_materials_unlit",
  CLEARCOAT_EXTENSION,
  TRANSMISSION_EXTENSION,
  SHEEN_EXTENSION,
  IRIDESCENCE_EXTENSION,
]);
const TEXTURE_TRANSFORM_EXTENSION = "KHR_texture_transform";

export function createMaterialAssetFromGltfMaterial(
  material: unknown,
  options: GltfMaterialMappingOptions = {},
): GltfMaterialMappingReport {
  const diagnostics: GltfMaterialMappingDiagnostic[] = [];
  const materialKey = options.materialKey ?? "material";

  if (!isRecord(material)) {
    diagnostics.push({
      code: "gltfMaterial.malformedMaterial",
      severity: "error",
      materialKey,
      message: "glTF material must be an object.",
    });
    return {
      valid: false,
      material: null,
      diagnostics,
    };
  }

  const materialExtensions = optionalRecordField({
    source: material,
    field: "extensions",
    materialKey,
    diagnostics,
  });
  inspectMaterialExtensions({
    materialKey,
    extensions: materialExtensions,
    required: options.extensionsRequired ?? [],
    diagnostics,
  });

  const pbrSource =
    optionalRecordField({
      source: material,
      field: "pbrMetallicRoughness",
      materialKey,
      diagnostics,
    }) ?? {};
  const label = materialLabel(material, materialKey);
  const renderState = gltfRenderState(material, materialKey, diagnostics);
  const unlit = isRecord(materialExtensions)
    ? materialExtensions.KHR_materials_unlit !== undefined
    : false;
  const clearcoatSource =
    isRecord(materialExtensions) &&
    materialExtensions[CLEARCOAT_EXTENSION] !== undefined
      ? optionalRecordField({
          source: materialExtensions,
          field: CLEARCOAT_EXTENSION,
          materialKey,
          diagnostics,
        })
      : undefined;
  const transmissionSource =
    isRecord(materialExtensions) &&
    materialExtensions[TRANSMISSION_EXTENSION] !== undefined
      ? optionalRecordField({
          source: materialExtensions,
          field: TRANSMISSION_EXTENSION,
          materialKey,
          diagnostics,
        })
      : undefined;
  const sheenSource =
    isRecord(materialExtensions) &&
    materialExtensions[SHEEN_EXTENSION] !== undefined
      ? optionalRecordField({
          source: materialExtensions,
          field: SHEEN_EXTENSION,
          materialKey,
          diagnostics,
        })
      : undefined;
  const iridescenceSource =
    isRecord(materialExtensions) &&
    materialExtensions[IRIDESCENCE_EXTENSION] !== undefined
      ? optionalRecordField({
          source: materialExtensions,
          field: IRIDESCENCE_EXTENSION,
          materialKey,
          diagnostics,
        })
      : undefined;
  const transmissionFactor = mapFiniteNumber({
    materialKey,
    field: `extensions.${TRANSMISSION_EXTENSION}.transmissionFactor`,
    value: transmissionSource?.transmissionFactor,
    fallback: 0,
    diagnostics,
  });

  if (unlit) {
    const mapped = createUnlitMaterialAsset({
      label,
      renderState,
      baseColorFactor: mapBaseColorFactor({
        materialKey,
        field: "pbrMetallicRoughness.baseColorFactor",
        value: pbrSource.baseColorFactor,
        diagnostics,
      }),
      baseColorTexture: mapTextureBinding({
        materialKey,
        slot: "baseColorTexture",
        field: "pbrMetallicRoughness.baseColorTexture",
        value: pbrSource.baseColorTexture,
        resolver: options.resolveTextureBinding,
        diagnostics,
      }),
    });
    inspectUnsupportedUnlitFields(
      material,
      pbrSource,
      materialKey,
      diagnostics,
    );

    return {
      valid: diagnostics.every((diagnostic) => diagnostic.severity !== "error"),
      material: mapped,
      diagnostics,
    };
  }

  const mapped = createStandardMaterialAsset({
    label,
    renderState: withTransmissionRenderState(renderState, transmissionFactor),
    baseColorFactor: mapBaseColorFactor({
      materialKey,
      field: "pbrMetallicRoughness.baseColorFactor",
      value: pbrSource.baseColorFactor,
      diagnostics,
    }),
    baseColorTexture: mapTextureBinding({
      materialKey,
      slot: "baseColorTexture",
      field: "pbrMetallicRoughness.baseColorTexture",
      value: pbrSource.baseColorTexture,
      resolver: options.resolveTextureBinding,
      diagnostics,
    }),
    metallicFactor: mapFiniteNumber({
      materialKey,
      field: "pbrMetallicRoughness.metallicFactor",
      value: pbrSource.metallicFactor,
      fallback: 1,
      diagnostics,
    }),
    roughnessFactor: mapFiniteNumber({
      materialKey,
      field: "pbrMetallicRoughness.roughnessFactor",
      value: pbrSource.roughnessFactor,
      fallback: 1,
      diagnostics,
    }),
    clearcoatFactor: mapFiniteNumber({
      materialKey,
      field: `extensions.${CLEARCOAT_EXTENSION}.clearcoatFactor`,
      value: clearcoatSource?.clearcoatFactor,
      fallback: 0,
      diagnostics,
    }),
    clearcoatTexture: mapTextureBinding({
      materialKey,
      slot: "clearcoatTexture",
      field: `extensions.${CLEARCOAT_EXTENSION}.clearcoatTexture`,
      value: clearcoatSource?.clearcoatTexture,
      resolver: options.resolveTextureBinding,
      diagnostics,
    }),
    clearcoatRoughnessFactor: mapFiniteNumber({
      materialKey,
      field: `extensions.${CLEARCOAT_EXTENSION}.clearcoatRoughnessFactor`,
      value: clearcoatSource?.clearcoatRoughnessFactor,
      fallback: 0,
      diagnostics,
    }),
    clearcoatRoughnessTexture: mapTextureBinding({
      materialKey,
      slot: "clearcoatRoughnessTexture",
      field: `extensions.${CLEARCOAT_EXTENSION}.clearcoatRoughnessTexture`,
      value: clearcoatSource?.clearcoatRoughnessTexture,
      resolver: options.resolveTextureBinding,
      diagnostics,
    }),
    transmissionFactor,
    transmissionTexture: mapTextureBinding({
      materialKey,
      slot: "transmissionTexture",
      field: `extensions.${TRANSMISSION_EXTENSION}.transmissionTexture`,
      value: transmissionSource?.transmissionTexture,
      resolver: options.resolveTextureBinding,
      diagnostics,
    }),
    sheenColorFactor: mapVec3({
      materialKey,
      field: `extensions.${SHEEN_EXTENSION}.sheenColorFactor`,
      value: sheenSource?.sheenColorFactor,
      fallback: [0, 0, 0],
      diagnostics,
    }),
    sheenColorTexture: mapTextureBinding({
      materialKey,
      slot: "sheenColorTexture",
      field: `extensions.${SHEEN_EXTENSION}.sheenColorTexture`,
      value: sheenSource?.sheenColorTexture,
      resolver: options.resolveTextureBinding,
      diagnostics,
    }),
    sheenRoughnessFactor: mapFiniteNumber({
      materialKey,
      field: `extensions.${SHEEN_EXTENSION}.sheenRoughnessFactor`,
      value: sheenSource?.sheenRoughnessFactor,
      fallback: 0,
      diagnostics,
    }),
    sheenRoughnessTexture: mapTextureBinding({
      materialKey,
      slot: "sheenRoughnessTexture",
      field: `extensions.${SHEEN_EXTENSION}.sheenRoughnessTexture`,
      value: sheenSource?.sheenRoughnessTexture,
      resolver: options.resolveTextureBinding,
      diagnostics,
    }),
    iridescenceFactor: mapFiniteNumber({
      materialKey,
      field: `extensions.${IRIDESCENCE_EXTENSION}.iridescenceFactor`,
      value: iridescenceSource?.iridescenceFactor,
      fallback: 0,
      diagnostics,
    }),
    iridescenceTexture: mapTextureBinding({
      materialKey,
      slot: "iridescenceTexture",
      field: `extensions.${IRIDESCENCE_EXTENSION}.iridescenceTexture`,
      value: iridescenceSource?.iridescenceTexture,
      resolver: options.resolveTextureBinding,
      diagnostics,
    }),
    iridescenceThicknessTexture: mapTextureBinding({
      materialKey,
      slot: "iridescenceThicknessTexture",
      field: `extensions.${IRIDESCENCE_EXTENSION}.iridescenceThicknessTexture`,
      value: iridescenceSource?.iridescenceThicknessTexture,
      resolver: options.resolveTextureBinding,
      diagnostics,
    }),
    iridescenceIor: mapFiniteNumber({
      materialKey,
      field: `extensions.${IRIDESCENCE_EXTENSION}.iridescenceIor`,
      value: iridescenceSource?.iridescenceIor,
      fallback: 1.3,
      diagnostics,
    }),
    iridescenceThicknessMinimum: mapFiniteNumber({
      materialKey,
      field: `extensions.${IRIDESCENCE_EXTENSION}.iridescenceThicknessMinimum`,
      value: iridescenceSource?.iridescenceThicknessMinimum,
      fallback: 100,
      diagnostics,
    }),
    iridescenceThicknessMaximum: mapFiniteNumber({
      materialKey,
      field: `extensions.${IRIDESCENCE_EXTENSION}.iridescenceThicknessMaximum`,
      value: iridescenceSource?.iridescenceThicknessMaximum,
      fallback: 400,
      diagnostics,
    }),
    metallicRoughnessTexture: mapTextureBinding({
      materialKey,
      slot: "metallicRoughnessTexture",
      field: "pbrMetallicRoughness.metallicRoughnessTexture",
      value: pbrSource.metallicRoughnessTexture,
      resolver: options.resolveTextureBinding,
      diagnostics,
    }),
    normalTexture: mapTextureBinding({
      materialKey,
      slot: "normalTexture",
      field: "normalTexture",
      value: material.normalTexture,
      resolver: options.resolveTextureBinding,
      diagnostics,
    }),
    normalScale: mapFiniteNumber({
      materialKey,
      field: "normalTexture.scale",
      value: recordField(material, "normalTexture")?.scale,
      fallback: 1,
      diagnostics,
    }),
    occlusionTexture: mapTextureBinding({
      materialKey,
      slot: "occlusionTexture",
      field: "occlusionTexture",
      value: material.occlusionTexture,
      resolver: options.resolveTextureBinding,
      diagnostics,
    }),
    occlusionStrength: mapFiniteNumber({
      materialKey,
      field: "occlusionTexture.strength",
      value: recordField(material, "occlusionTexture")?.strength,
      fallback: 1,
      diagnostics,
    }),
    emissiveFactor: mapVec3({
      materialKey,
      field: "emissiveFactor",
      value: material.emissiveFactor,
      fallback: [0, 0, 0],
      diagnostics,
    }),
    emissiveTexture: mapTextureBinding({
      materialKey,
      slot: "emissiveTexture",
      field: "emissiveTexture",
      value: material.emissiveTexture,
      resolver: options.resolveTextureBinding,
      diagnostics,
    }),
  });
  inspectUnsupportedClearcoatTextures(
    clearcoatSource,
    materialKey,
    diagnostics,
  );
  return {
    valid: diagnostics.every((diagnostic) => diagnostic.severity !== "error"),
    material: mapped,
    diagnostics,
  };
}

export function gltfMaterialMappingReportToJsonValue(
  report: GltfMaterialMappingReport,
): GltfMaterialMappingReportJsonValue {
  return {
    valid: report.valid,
    material:
      report.material === null ? null : cloneMaterialAsset(report.material),
    diagnostics: report.diagnostics.map((diagnostic) => ({ ...diagnostic })),
  };
}

export function gltfMaterialMappingReportToJson(
  report: GltfMaterialMappingReport,
): string {
  return JSON.stringify(gltfMaterialMappingReportToJsonValue(report));
}

function withTransmissionRenderState(
  renderState: RenderStateDescriptor,
  transmissionFactor: number,
): RenderStateDescriptor {
  if (transmissionFactor <= 0 || renderState.alphaMode !== "opaque") {
    return renderState;
  }

  return createDefaultRenderState({
    ...renderState,
    alphaMode: "blend",
    depth: { ...renderState.depth, write: false },
    blend: { preset: "alpha" },
  });
}

function inspectUnsupportedClearcoatTextures(
  clearcoatSource: Record<string, unknown> | undefined,
  materialKey: string,
  diagnostics: GltfMaterialMappingDiagnostic[],
): void {
  if (clearcoatSource === undefined) {
    return;
  }

  for (const field of ["clearcoatNormalTexture"] as const) {
    if (clearcoatSource[field] === undefined) {
      continue;
    }

    diagnostics.push({
      code: "gltfMaterial.unsupportedOptionalExtension",
      severity: "warning",
      materialKey,
      field: `extensions.${CLEARCOAT_EXTENSION}.${field}`,
      extensionName: CLEARCOAT_EXTENSION,
      message: `${CLEARCOAT_EXTENSION}.${field} is preserved in source data but current clearcoat rendering only samples clearcoatTexture and clearcoatRoughnessTexture.`,
    });
  }
}

function gltfRenderState(
  material: Record<string, unknown>,
  materialKey: string,
  diagnostics: GltfMaterialMappingDiagnostic[],
): RenderStateDescriptor {
  const alphaMode = material.alphaMode ?? "OPAQUE";
  const doubleSided = material.doubleSided ?? false;

  if (!["OPAQUE", "MASK", "BLEND"].includes(String(alphaMode))) {
    diagnostics.push({
      code: "gltfMaterial.invalidField",
      severity: "error",
      materialKey,
      field: "alphaMode",
      value: toDiagnosticValue(alphaMode),
      message: "alphaMode must be OPAQUE, MASK, or BLEND.",
    });
  }

  if (typeof doubleSided !== "boolean") {
    diagnostics.push({
      code: "gltfMaterial.invalidField",
      severity: "error",
      materialKey,
      field: "doubleSided",
      value: toDiagnosticValue(doubleSided),
      message: "doubleSided must be a boolean when present.",
    });
  }

  const alphaCutoff = mapAlphaCutoff({
    materialKey,
    field: "alphaCutoff",
    value: material.alphaCutoff,
    fallback: 0.5,
    diagnostics,
  });

  if (alphaMode === "BLEND") {
    return createDefaultRenderState({
      alphaMode: "blend",
      alphaCutoff,
      cullMode: doubleSided === true ? "none" : "back",
      depth: { test: true, write: false, compare: "less" },
      blend: { preset: "alpha" },
    });
  }

  if (alphaMode === "MASK") {
    return createDefaultRenderState({
      alphaMode: "mask",
      alphaCutoff,
      cullMode: doubleSided === true ? "none" : "back",
    });
  }

  return createDefaultRenderState({
    alphaMode: "opaque",
    alphaCutoff,
    cullMode: doubleSided === true ? "none" : "back",
  });
}

function mapTextureBinding(input: {
  readonly materialKey: string;
  readonly slot: GltfMaterialTextureSlot;
  readonly field: string;
  readonly value: unknown;
  readonly resolver: GltfMaterialTextureBindingResolver | undefined;
  readonly diagnostics: GltfMaterialMappingDiagnostic[];
}): MaterialTextureBinding | null {
  if (input.value === undefined) {
    return null;
  }

  if (!isRecord(input.value)) {
    input.diagnostics.push({
      code: "gltfMaterial.invalidTextureInfo",
      severity: "error",
      materialKey: input.materialKey,
      field: input.field,
      slot: input.slot,
      value: toDiagnosticValue(input.value),
      message: `${input.field} must be a glTF texture info object.`,
    });
    return null;
  }

  const textureInfo = input.value;
  const textureInput = { ...input, value: textureInfo };
  const textureIndex = mapTextureIndex(textureInput);
  const texCoord = mapTexCoord(textureInput);
  const transform = mapTextureTransform(textureInput);

  if (textureIndex === null || texCoord === null) {
    return null;
  }

  const resolved = input.resolver?.({
    materialKey: input.materialKey,
    slot: input.slot,
    field: input.field,
    textureInfo: input.value,
    textureIndex,
    texCoord,
    ...(transform === undefined ? {} : { transform }),
  });

  const binding = resolveTextureBindingResult({
    materialKey: input.materialKey,
    field: input.field,
    slot: input.slot,
    textureIndex,
    resolved,
    diagnostics: input.diagnostics,
  });

  if (binding === null) {
    return null;
  }

  return {
    texture: binding.texture,
    sampler: binding.sampler,
    texCoord,
    ...(transform === undefined ? {} : { transform }),
  };
}

function resolveTextureBindingResult(input: {
  readonly materialKey: string;
  readonly field: string;
  readonly slot: GltfMaterialTextureSlot;
  readonly textureIndex: number;
  readonly resolved: GltfMaterialTextureBindingResolverResult;
  readonly diagnostics: GltfMaterialMappingDiagnostic[];
}): MaterialTextureBinding | null {
  if (isMaterialTextureBinding(input.resolved)) {
    return input.resolved;
  }

  if (isTextureBindingResolverReport(input.resolved)) {
    const resolverDiagnostics = input.resolved.diagnostics ?? [];
    for (const diagnostic of resolverDiagnostics) {
      pushResolverDiagnostic({
        materialKey: input.materialKey,
        field: input.field,
        slot: input.slot,
        textureIndex: input.textureIndex,
        diagnostic,
        diagnostics: input.diagnostics,
      });
    }

    if (
      input.resolved.binding !== null &&
      input.resolved.binding !== undefined
    ) {
      return input.resolved.binding;
    }

    if (resolverDiagnostics.length === 0) {
      pushUnresolvedTextureBindingDiagnostic(input);
    }
    return null;
  }

  pushUnresolvedTextureBindingDiagnostic(input);
  return null;
}

function pushResolverDiagnostic(input: {
  readonly materialKey: string;
  readonly field: string;
  readonly slot: GltfMaterialTextureSlot;
  readonly textureIndex: number;
  readonly diagnostic: GltfMaterialTextureBindingResolverDiagnostic;
  readonly diagnostics: GltfMaterialMappingDiagnostic[];
}): void {
  input.diagnostics.push({
    code: input.diagnostic.code ?? "gltfMaterial.unresolvedTextureBinding",
    severity: input.diagnostic.severity ?? "error",
    materialKey: input.materialKey,
    field: input.diagnostic.field ?? input.field,
    slot: input.slot,
    textureIndex: input.diagnostic.textureIndex ?? input.textureIndex,
    message: input.diagnostic.message,
    ...(input.diagnostic.dependencyKind === undefined
      ? {}
      : { dependencyKind: input.diagnostic.dependencyKind }),
    ...(input.diagnostic.samplerIndex === undefined
      ? {}
      : { samplerIndex: input.diagnostic.samplerIndex }),
    ...(input.diagnostic.value === undefined
      ? {}
      : { value: input.diagnostic.value }),
  });
}

function pushUnresolvedTextureBindingDiagnostic(input: {
  readonly materialKey: string;
  readonly field: string;
  readonly slot: GltfMaterialTextureSlot;
  readonly textureIndex: number;
  readonly diagnostics: GltfMaterialMappingDiagnostic[];
}): void {
  input.diagnostics.push({
    code: "gltfMaterial.unresolvedTextureBinding",
    severity: "error",
    materialKey: input.materialKey,
    field: input.field,
    slot: input.slot,
    textureIndex: input.textureIndex,
    message: `${input.field} could not be resolved to texture and sampler handles.`,
  });
}

function mapTextureIndex(input: {
  readonly materialKey: string;
  readonly slot: GltfMaterialTextureSlot;
  readonly field: string;
  readonly value: Record<string, unknown>;
  readonly diagnostics: GltfMaterialMappingDiagnostic[];
}): number | null {
  const textureIndex = input.value.index;
  if (isNonNegativeInteger(textureIndex)) {
    return textureIndex;
  }

  input.diagnostics.push({
    code: "gltfMaterial.invalidTextureInfo",
    severity: "error",
    materialKey: input.materialKey,
    field: `${input.field}.index`,
    slot: input.slot,
    value: toDiagnosticValue(textureIndex),
    message: `${input.field}.index must be a non-negative integer.`,
  });
  return null;
}

function mapTexCoord(input: {
  readonly materialKey: string;
  readonly slot: GltfMaterialTextureSlot;
  readonly field: string;
  readonly value: Record<string, unknown>;
  readonly diagnostics: GltfMaterialMappingDiagnostic[];
}): number | null {
  const texCoord = input.value.texCoord ?? 0;
  if (isNonNegativeInteger(texCoord)) {
    return texCoord;
  }

  input.diagnostics.push({
    code: "gltfMaterial.invalidTextureInfo",
    severity: "error",
    materialKey: input.materialKey,
    field: `${input.field}.texCoord`,
    slot: input.slot,
    value: toDiagnosticValue(texCoord),
    message: `${input.field}.texCoord must be a non-negative integer.`,
  });
  return null;
}

function mapTextureTransform(input: {
  readonly materialKey: string;
  readonly slot: GltfMaterialTextureSlot;
  readonly field: string;
  readonly value: Record<string, unknown>;
  readonly diagnostics: GltfMaterialMappingDiagnostic[];
}): MaterialTextureTransform | undefined {
  const extensions = recordField(input.value, "extensions");
  if (extensions === undefined) {
    return undefined;
  }

  const transformSource = extensions[TEXTURE_TRANSFORM_EXTENSION];
  if (transformSource === undefined) {
    return undefined;
  }

  if (!isRecord(transformSource)) {
    input.diagnostics.push({
      code: "gltfMaterial.invalidTextureInfo",
      severity: "error",
      materialKey: input.materialKey,
      field: `${input.field}.extensions.${TEXTURE_TRANSFORM_EXTENSION}`,
      slot: input.slot,
      value: toDiagnosticValue(transformSource),
      message: `${TEXTURE_TRANSFORM_EXTENSION} must be an object when present.`,
    });
    return undefined;
  }

  const transform: MaterialTextureTransform = {
    ...mapVec2Property({
      source: transformSource,
      property: "offset",
      materialKey: input.materialKey,
      field: input.field,
      slot: input.slot,
      diagnostics: input.diagnostics,
    }),
    ...mapVec2Property({
      source: transformSource,
      property: "scale",
      materialKey: input.materialKey,
      field: input.field,
      slot: input.slot,
      diagnostics: input.diagnostics,
    }),
    ...mapRotationProperty({
      source: transformSource,
      materialKey: input.materialKey,
      field: input.field,
      slot: input.slot,
      diagnostics: input.diagnostics,
    }),
  };

  if (Object.keys(transform).length === 0 || isIdentityTransform(transform)) {
    return transform;
  }

  const textureIndex = isNonNegativeInteger(input.value.index)
    ? input.value.index
    : undefined;
  const texCoord = isNonNegativeInteger(input.value.texCoord)
    ? input.value.texCoord
    : 0;

  if (!isSupportedTextureTransform(input.slot, texCoord, transform)) {
    input.diagnostics.push({
      code: "gltfMaterial.unsupportedTextureTransform",
      severity: "warning",
      materialKey: input.materialKey,
      field: `${input.field}.extensions.${TEXTURE_TRANSFORM_EXTENSION}`,
      slot: input.slot,
      ...(textureIndex === undefined ? {} : { textureIndex }),
      message: `${TEXTURE_TRANSFORM_EXTENSION} is preserved, but only base-color, metallic-roughness, clearcoat, normal, occlusion, and emissive transforms on TEXCOORD_0 or TEXCOORD_1 are rendered by current material shaders.`,
    });
  }

  return transform;
}

function mapVec2Property(input: {
  readonly source: Record<string, unknown>;
  readonly property: "offset" | "scale";
  readonly materialKey: string;
  readonly field: string;
  readonly slot: GltfMaterialTextureSlot;
  readonly diagnostics: GltfMaterialMappingDiagnostic[];
}): Pick<MaterialTextureTransform, "offset" | "scale"> {
  const value = input.source[input.property];
  if (value === undefined) {
    return {};
  }

  if (isFiniteNumberTuple(value, 2)) {
    const tuple = value as readonly [number, number];
    return { [input.property]: [tuple[0], tuple[1]] };
  }

  input.diagnostics.push({
    code: "gltfMaterial.invalidTextureInfo",
    severity: "error",
    materialKey: input.materialKey,
    field: `${input.field}.extensions.${TEXTURE_TRANSFORM_EXTENSION}.${input.property}`,
    slot: input.slot,
    value: toDiagnosticValue(value),
    message: `${TEXTURE_TRANSFORM_EXTENSION}.${input.property} must be a two-number array.`,
  });
  return {};
}

function mapRotationProperty(input: {
  readonly source: Record<string, unknown>;
  readonly materialKey: string;
  readonly field: string;
  readonly slot: GltfMaterialTextureSlot;
  readonly diagnostics: GltfMaterialMappingDiagnostic[];
}): Pick<MaterialTextureTransform, "rotation"> {
  const value = input.source.rotation;
  if (value === undefined) {
    return {};
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return { rotation: value };
  }

  input.diagnostics.push({
    code: "gltfMaterial.invalidTextureInfo",
    severity: "error",
    materialKey: input.materialKey,
    field: `${input.field}.extensions.${TEXTURE_TRANSFORM_EXTENSION}.rotation`,
    slot: input.slot,
    value: toDiagnosticValue(value),
    message: `${TEXTURE_TRANSFORM_EXTENSION}.rotation must be a finite number.`,
  });
  return {};
}

function mapBaseColorFactor(input: {
  readonly materialKey: string;
  readonly field: string;
  readonly value: unknown;
  readonly diagnostics: GltfMaterialMappingDiagnostic[];
}): Float32Array {
  const fallback = [1, 1, 1, 1] as const;

  if (input.value === undefined) {
    return new Float32Array(fallback);
  }

  if (isFiniteNumberTuple(input.value, 4)) {
    const tuple = input.value as readonly [number, number, number, number];
    return new Float32Array(tuple);
  }

  input.diagnostics.push({
    code: "gltfMaterial.invalidField",
    severity: "error",
    materialKey: input.materialKey,
    field: input.field,
    value: toDiagnosticValue(input.value),
    message: `${input.field} must be a four-number array.`,
  });
  return new Float32Array(fallback);
}

function mapVec3(input: {
  readonly materialKey: string;
  readonly field: string;
  readonly value: unknown;
  readonly fallback: readonly [number, number, number];
  readonly diagnostics: GltfMaterialMappingDiagnostic[];
}): readonly [number, number, number] {
  if (input.value === undefined) {
    return input.fallback;
  }

  if (isFiniteNumberTuple(input.value, 3)) {
    const tuple = input.value as readonly [number, number, number];
    return [tuple[0], tuple[1], tuple[2]];
  }

  input.diagnostics.push({
    code: "gltfMaterial.invalidField",
    severity: "error",
    materialKey: input.materialKey,
    field: input.field,
    value: toDiagnosticValue(input.value),
    message: `${input.field} must be a three-number array.`,
  });
  return input.fallback;
}

function mapFiniteNumber(input: {
  readonly materialKey: string;
  readonly field: string;
  readonly value: unknown;
  readonly fallback: number;
  readonly diagnostics: GltfMaterialMappingDiagnostic[];
}): number {
  if (input.value === undefined) {
    return input.fallback;
  }

  if (typeof input.value === "number" && Number.isFinite(input.value)) {
    return input.value;
  }

  input.diagnostics.push({
    code: "gltfMaterial.invalidField",
    severity: "error",
    materialKey: input.materialKey,
    field: input.field,
    value: toDiagnosticValue(input.value),
    message: `${input.field} must be a finite number.`,
  });
  return input.fallback;
}

function mapAlphaCutoff(input: {
  readonly materialKey: string;
  readonly field: string;
  readonly value: unknown;
  readonly fallback: number;
  readonly diagnostics: GltfMaterialMappingDiagnostic[];
}): number {
  if (input.value === undefined) {
    return input.fallback;
  }

  if (
    typeof input.value === "number" &&
    Number.isFinite(input.value) &&
    input.value >= 0 &&
    input.value <= 1
  ) {
    return input.value;
  }

  input.diagnostics.push({
    code: "gltfMaterial.invalidField",
    severity: "error",
    materialKey: input.materialKey,
    field: input.field,
    value: toDiagnosticValue(input.value),
    message: `${input.field} must be a finite number between 0 and 1.`,
  });
  return input.fallback;
}

function inspectMaterialExtensions(input: {
  readonly materialKey: string;
  readonly extensions: Record<string, unknown> | undefined;
  readonly required: readonly string[];
  readonly diagnostics: GltfMaterialMappingDiagnostic[];
}): void {
  if (input.extensions === undefined) {
    return;
  }

  const required = new Set(input.required);
  for (const extensionName of Object.keys(input.extensions)) {
    if (SUPPORTED_MATERIAL_EXTENSIONS.has(extensionName)) {
      continue;
    }

    const requiredExtension = required.has(extensionName);
    input.diagnostics.push({
      code: requiredExtension
        ? "gltfMaterial.unsupportedRequiredExtension"
        : "gltfMaterial.unsupportedOptionalExtension",
      severity: requiredExtension ? "error" : "warning",
      materialKey: input.materialKey,
      field: `extensions.${extensionName}`,
      extensionName,
      message: requiredExtension
        ? `Required glTF material extension '${extensionName}' is not supported.`
        : `Optional glTF material extension '${extensionName}' is not rendered by the minimal mapper.`,
    });
  }
}

function inspectUnsupportedUnlitFields(
  material: Record<string, unknown>,
  pbr: Record<string, unknown>,
  materialKey: string,
  diagnostics: GltfMaterialMappingDiagnostic[],
): void {
  const fields = [
    ["pbrMetallicRoughness.metallicFactor", pbr.metallicFactor],
    ["pbrMetallicRoughness.roughnessFactor", pbr.roughnessFactor],
    [
      "pbrMetallicRoughness.metallicRoughnessTexture",
      pbr.metallicRoughnessTexture,
    ],
    ["normalTexture", material.normalTexture],
    ["occlusionTexture", material.occlusionTexture],
    ["emissiveFactor", material.emissiveFactor],
    ["emissiveTexture", material.emissiveTexture],
  ] as const;

  for (const [field, value] of fields) {
    if (value === undefined) {
      continue;
    }

    diagnostics.push({
      code: "gltfMaterial.unsupportedUnlitField",
      severity: "warning",
      materialKey,
      field,
      message: `${field} is present on a KHR_materials_unlit material and will not affect rendering.`,
    });
  }
}

function materialLabel(
  material: Record<string, unknown>,
  materialKey: string,
): string {
  return typeof material.name === "string" && material.name.length > 0
    ? material.name
    : `glTF Material ${materialKey}`;
}

function cloneMaterialAsset(material: MaterialAsset): Record<string, unknown> {
  const cloned: Record<string, unknown> = {
    ...material,
    renderState: {
      ...material.renderState,
      depth: { ...material.renderState.depth },
      blend: { ...material.renderState.blend },
    },
  };

  if ("baseColorFactor" in material) {
    cloned.baseColorFactor = Array.from(material.baseColorFactor);
  }

  return cloned;
}

function recordField(
  source: Record<string, unknown>,
  field: string,
): Record<string, unknown> | undefined {
  const value = source[field];
  return isRecord(value) ? value : undefined;
}

function optionalRecordField(input: {
  readonly source: Record<string, unknown>;
  readonly field: string;
  readonly materialKey: string;
  readonly diagnostics: GltfMaterialMappingDiagnostic[];
}): Record<string, unknown> | undefined {
  const value = input.source[input.field];
  if (value === undefined) {
    return undefined;
  }

  if (isRecord(value)) {
    return value;
  }

  input.diagnostics.push({
    code: "gltfMaterial.invalidField",
    severity: "error",
    materialKey: input.materialKey,
    field: input.field,
    value: toDiagnosticValue(value),
    message: `${input.field} must be an object when present.`,
  });
  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isMaterialTextureBinding(
  value: unknown,
): value is MaterialTextureBinding {
  return isRecord(value) && "texture" in value && "sampler" in value;
}

function isTextureBindingResolverReport(
  value: unknown,
): value is GltfMaterialTextureBindingResolverReport {
  return (
    isRecord(value) &&
    !isMaterialTextureBinding(value) &&
    ("binding" in value || "diagnostics" in value)
  );
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isInteger(value) && typeof value === "number" && value >= 0;
}

function isFiniteNumberTuple(
  value: unknown,
  length: number,
): value is readonly number[] {
  return (
    Array.isArray(value) &&
    value.length === length &&
    value.every((item) => typeof item === "number" && Number.isFinite(item))
  );
}

function isIdentityTransform(transform: MaterialTextureTransform): boolean {
  return (
    (transform.offset === undefined ||
      (transform.offset[0] === 0 && transform.offset[1] === 0)) &&
    (transform.scale === undefined ||
      (transform.scale[0] === 1 && transform.scale[1] === 1)) &&
    (transform.rotation === undefined || transform.rotation === 0)
  );
}

function isSupportedTextureTransform(
  slot: GltfMaterialTextureSlot,
  texCoord: number,
  transform: MaterialTextureTransform,
): boolean {
  return (
    (slot === "baseColorTexture" ||
      slot === "metallicRoughnessTexture" ||
      slot === "clearcoatTexture" ||
      slot === "normalTexture" ||
      slot === "occlusionTexture" ||
      slot === "emissiveTexture") &&
    (texCoord === 0 || texCoord === 1) &&
    isFiniteTextureTransform(transform)
  );
}

function isFiniteTextureTransform(
  transform: MaterialTextureTransform,
): boolean {
  const offset = transform.offset ?? [0, 0];
  const scale = transform.scale ?? [1, 1];
  const rotation = transform.rotation ?? 0;

  return (
    Number.isFinite(offset[0]) &&
    Number.isFinite(offset[1]) &&
    Number.isFinite(scale[0]) &&
    Number.isFinite(scale[1]) &&
    Number.isFinite(rotation)
  );
}

function toDiagnosticValue(value: unknown): GltfMaterialDiagnosticValue {
  if (value === null) {
    return null;
  }

  switch (typeof value) {
    case "string":
    case "boolean":
      return value;
    case "number":
      return Number.isFinite(value) ? value : String(value);
    case "undefined":
      return "undefined";
    case "bigint":
    case "symbol":
    case "function":
    case "object":
      return Object.prototype.toString.call(value);
  }

  return String(value);
}
