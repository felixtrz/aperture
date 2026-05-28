import {
  createStandardMaterialAsset,
  createUnlitMaterialAsset,
} from "./factories.js";
import {
  CLEARCOAT_EXTENSION,
  IRIDESCENCE_EXTENSION,
  SHEEN_EXTENSION,
  TRANSMISSION_EXTENSION,
  inspectMaterialExtensions,
  inspectUnsupportedClearcoatTextures,
  inspectUnsupportedUnlitFields,
} from "./gltf-material-extensions.js";
import {
  gltfRenderState,
  withTransmissionRenderState,
} from "./gltf-material-render-state.js";
import {
  mapBaseColorFactor,
  mapFiniteNumber,
  mapVec3,
} from "./gltf-material-scalars.js";
import type {
  GltfMaterialMappingDiagnostic,
  GltfMaterialMappingOptions,
  GltfMaterialMappingReport,
} from "./gltf-material-types.js";
import { mapTextureBinding } from "./gltf-material-textures.js";
import {
  isRecord,
  optionalRecordField,
  recordField,
} from "./gltf-material-utils.js";

export {
  gltfMaterialMappingReportToJson,
  gltfMaterialMappingReportToJsonValue,
} from "./gltf-material-report.js";
export type {
  GltfMaterialDiagnosticValue,
  GltfMaterialMappingDiagnostic,
  GltfMaterialMappingDiagnosticCode,
  GltfMaterialMappingDiagnosticSeverity,
  GltfMaterialMappingOptions,
  GltfMaterialMappingReport,
  GltfMaterialMappingReportJsonValue,
  GltfMaterialTextureBindingResolver,
  GltfMaterialTextureBindingResolverDiagnostic,
  GltfMaterialTextureBindingResolverInput,
  GltfMaterialTextureBindingResolverReport,
  GltfMaterialTextureBindingResolverResult,
  GltfMaterialTextureDependencyKind,
  GltfMaterialTextureSlot,
} from "./gltf-material-types.js";
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

function materialLabel(
  material: Record<string, unknown>,
  materialKey: string,
): string {
  return typeof material.name === "string" && material.name.length > 0
    ? material.name
    : `glTF Material ${materialKey}`;
}
