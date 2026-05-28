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
import { mapTextureBinding } from "./gltf-material-textures.js";
import {
  isFiniteNumberTuple,
  isRecord,
  optionalRecordField,
  recordField,
  toDiagnosticValue,
} from "./gltf-material-utils.js";

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
