import {
  createStandardGltfMaterialAsset,
  createUnlitGltfMaterialAsset,
} from "./gltf-material-builders.js";
import {
  CLEARCOAT_EXTENSION,
  IRIDESCENCE_EXTENSION,
  IOR_EXTENSION,
  SHEEN_EXTENSION,
  TRANSMISSION_EXTENSION,
  VOLUME_EXTENSION,
  inspectMaterialExtensions,
} from "./gltf-material-extensions.js";
import { gltfRenderState } from "./gltf-material-render-state.js";
import { mapFiniteNumber } from "./gltf-material-scalars.js";
import type {
  GltfMaterialMappingDiagnostic,
  GltfMaterialMappingOptions,
  GltfMaterialMappingReport,
} from "./gltf-material-types.js";
import { isRecord, optionalRecordField } from "./gltf-material-utils.js";

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
  const iorSource =
    isRecord(materialExtensions) &&
    materialExtensions[IOR_EXTENSION] !== undefined
      ? optionalRecordField({
          source: materialExtensions,
          field: IOR_EXTENSION,
          materialKey,
          diagnostics,
        })
      : undefined;
  const volumeSource =
    isRecord(materialExtensions) &&
    materialExtensions[VOLUME_EXTENSION] !== undefined
      ? optionalRecordField({
          source: materialExtensions,
          field: VOLUME_EXTENSION,
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
    const mapped = createUnlitGltfMaterialAsset({
      material,
      pbrSource,
      materialKey,
      label,
      renderState,
      resolver: options.resolveTextureBinding,
      diagnostics,
    });

    return {
      valid: diagnostics.every((diagnostic) => diagnostic.severity !== "error"),
      material: mapped,
      diagnostics,
    };
  }

  const mapped = createStandardGltfMaterialAsset({
    material,
    pbrSource,
    clearcoatSource,
    transmissionSource,
    sheenSource,
    iridescenceSource,
    iorSource,
    volumeSource,
    materialKey,
    label,
    renderState,
    transmissionFactor,
    resolver: options.resolveTextureBinding,
    diagnostics,
  });
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
