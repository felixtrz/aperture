import {
  createStandardMaterialAsset,
  createUnlitMaterialAsset,
} from "./factories.js";
import {
  CLEARCOAT_EXTENSION,
  IRIDESCENCE_EXTENSION,
  SHEEN_EXTENSION,
  TRANSMISSION_EXTENSION,
  inspectUnsupportedClearcoatTextures,
  inspectUnsupportedUnlitFields,
} from "./gltf-material-extensions.js";
import { withTransmissionRenderState } from "./gltf-material-render-state.js";
import {
  mapBaseColorFactor,
  mapFiniteNumber,
  mapVec3,
} from "./gltf-material-scalars.js";
import { mapTextureBinding } from "./gltf-material-textures.js";
import type {
  GltfMaterialMappingDiagnostic,
  GltfMaterialTextureBindingResolver,
} from "./gltf-material-types.js";
import { recordField } from "./gltf-material-utils.js";
import type {
  RenderStateDescriptor,
  StandardMaterialAsset,
  UnlitMaterialAsset,
} from "./types.js";

export function createUnlitGltfMaterialAsset(input: {
  readonly material: Record<string, unknown>;
  readonly pbrSource: Record<string, unknown>;
  readonly materialKey: string;
  readonly label: string;
  readonly renderState: RenderStateDescriptor;
  readonly resolver?: GltfMaterialTextureBindingResolver | undefined;
  readonly diagnostics: GltfMaterialMappingDiagnostic[];
}): UnlitMaterialAsset {
  const mapped = createUnlitMaterialAsset({
    label: input.label,
    renderState: input.renderState,
    baseColorFactor: mapBaseColorFactor({
      materialKey: input.materialKey,
      field: "pbrMetallicRoughness.baseColorFactor",
      value: input.pbrSource.baseColorFactor,
      diagnostics: input.diagnostics,
    }),
    baseColorTexture: mapTextureBinding({
      materialKey: input.materialKey,
      slot: "baseColorTexture",
      field: "pbrMetallicRoughness.baseColorTexture",
      value: input.pbrSource.baseColorTexture,
      resolver: input.resolver,
      diagnostics: input.diagnostics,
    }),
  });
  inspectUnsupportedUnlitFields(
    input.material,
    input.pbrSource,
    input.materialKey,
    input.diagnostics,
  );

  return mapped;
}

export function createStandardGltfMaterialAsset(input: {
  readonly material: Record<string, unknown>;
  readonly pbrSource: Record<string, unknown>;
  readonly clearcoatSource?: Record<string, unknown> | undefined;
  readonly transmissionSource?: Record<string, unknown> | undefined;
  readonly sheenSource?: Record<string, unknown> | undefined;
  readonly iridescenceSource?: Record<string, unknown> | undefined;
  readonly materialKey: string;
  readonly label: string;
  readonly renderState: RenderStateDescriptor;
  readonly transmissionFactor: number;
  readonly resolver?: GltfMaterialTextureBindingResolver | undefined;
  readonly diagnostics: GltfMaterialMappingDiagnostic[];
}): StandardMaterialAsset {
  const mapped = createStandardMaterialAsset({
    label: input.label,
    renderState: withTransmissionRenderState(
      input.renderState,
      input.transmissionFactor,
    ),
    baseColorFactor: mapBaseColorFactor({
      materialKey: input.materialKey,
      field: "pbrMetallicRoughness.baseColorFactor",
      value: input.pbrSource.baseColorFactor,
      diagnostics: input.diagnostics,
    }),
    baseColorTexture: mapTextureBinding({
      materialKey: input.materialKey,
      slot: "baseColorTexture",
      field: "pbrMetallicRoughness.baseColorTexture",
      value: input.pbrSource.baseColorTexture,
      resolver: input.resolver,
      diagnostics: input.diagnostics,
    }),
    metallicFactor: mapFiniteNumber({
      materialKey: input.materialKey,
      field: "pbrMetallicRoughness.metallicFactor",
      value: input.pbrSource.metallicFactor,
      fallback: 1,
      diagnostics: input.diagnostics,
    }),
    roughnessFactor: mapFiniteNumber({
      materialKey: input.materialKey,
      field: "pbrMetallicRoughness.roughnessFactor",
      value: input.pbrSource.roughnessFactor,
      fallback: 1,
      diagnostics: input.diagnostics,
    }),
    clearcoatFactor: mapFiniteNumber({
      materialKey: input.materialKey,
      field: `extensions.${CLEARCOAT_EXTENSION}.clearcoatFactor`,
      value: input.clearcoatSource?.clearcoatFactor,
      fallback: 0,
      diagnostics: input.diagnostics,
    }),
    clearcoatTexture: mapTextureBinding({
      materialKey: input.materialKey,
      slot: "clearcoatTexture",
      field: `extensions.${CLEARCOAT_EXTENSION}.clearcoatTexture`,
      value: input.clearcoatSource?.clearcoatTexture,
      resolver: input.resolver,
      diagnostics: input.diagnostics,
    }),
    clearcoatRoughnessFactor: mapFiniteNumber({
      materialKey: input.materialKey,
      field: `extensions.${CLEARCOAT_EXTENSION}.clearcoatRoughnessFactor`,
      value: input.clearcoatSource?.clearcoatRoughnessFactor,
      fallback: 0,
      diagnostics: input.diagnostics,
    }),
    clearcoatRoughnessTexture: mapTextureBinding({
      materialKey: input.materialKey,
      slot: "clearcoatRoughnessTexture",
      field: `extensions.${CLEARCOAT_EXTENSION}.clearcoatRoughnessTexture`,
      value: input.clearcoatSource?.clearcoatRoughnessTexture,
      resolver: input.resolver,
      diagnostics: input.diagnostics,
    }),
    transmissionFactor: input.transmissionFactor,
    transmissionTexture: mapTextureBinding({
      materialKey: input.materialKey,
      slot: "transmissionTexture",
      field: `extensions.${TRANSMISSION_EXTENSION}.transmissionTexture`,
      value: input.transmissionSource?.transmissionTexture,
      resolver: input.resolver,
      diagnostics: input.diagnostics,
    }),
    sheenColorFactor: mapVec3({
      materialKey: input.materialKey,
      field: `extensions.${SHEEN_EXTENSION}.sheenColorFactor`,
      value: input.sheenSource?.sheenColorFactor,
      fallback: [0, 0, 0],
      diagnostics: input.diagnostics,
    }),
    sheenColorTexture: mapTextureBinding({
      materialKey: input.materialKey,
      slot: "sheenColorTexture",
      field: `extensions.${SHEEN_EXTENSION}.sheenColorTexture`,
      value: input.sheenSource?.sheenColorTexture,
      resolver: input.resolver,
      diagnostics: input.diagnostics,
    }),
    sheenRoughnessFactor: mapFiniteNumber({
      materialKey: input.materialKey,
      field: `extensions.${SHEEN_EXTENSION}.sheenRoughnessFactor`,
      value: input.sheenSource?.sheenRoughnessFactor,
      fallback: 0,
      diagnostics: input.diagnostics,
    }),
    sheenRoughnessTexture: mapTextureBinding({
      materialKey: input.materialKey,
      slot: "sheenRoughnessTexture",
      field: `extensions.${SHEEN_EXTENSION}.sheenRoughnessTexture`,
      value: input.sheenSource?.sheenRoughnessTexture,
      resolver: input.resolver,
      diagnostics: input.diagnostics,
    }),
    iridescenceFactor: mapFiniteNumber({
      materialKey: input.materialKey,
      field: `extensions.${IRIDESCENCE_EXTENSION}.iridescenceFactor`,
      value: input.iridescenceSource?.iridescenceFactor,
      fallback: 0,
      diagnostics: input.diagnostics,
    }),
    iridescenceTexture: mapTextureBinding({
      materialKey: input.materialKey,
      slot: "iridescenceTexture",
      field: `extensions.${IRIDESCENCE_EXTENSION}.iridescenceTexture`,
      value: input.iridescenceSource?.iridescenceTexture,
      resolver: input.resolver,
      diagnostics: input.diagnostics,
    }),
    iridescenceThicknessTexture: mapTextureBinding({
      materialKey: input.materialKey,
      slot: "iridescenceThicknessTexture",
      field: `extensions.${IRIDESCENCE_EXTENSION}.iridescenceThicknessTexture`,
      value: input.iridescenceSource?.iridescenceThicknessTexture,
      resolver: input.resolver,
      diagnostics: input.diagnostics,
    }),
    iridescenceIor: mapFiniteNumber({
      materialKey: input.materialKey,
      field: `extensions.${IRIDESCENCE_EXTENSION}.iridescenceIor`,
      value: input.iridescenceSource?.iridescenceIor,
      fallback: 1.3,
      diagnostics: input.diagnostics,
    }),
    iridescenceThicknessMinimum: mapFiniteNumber({
      materialKey: input.materialKey,
      field: `extensions.${IRIDESCENCE_EXTENSION}.iridescenceThicknessMinimum`,
      value: input.iridescenceSource?.iridescenceThicknessMinimum,
      fallback: 100,
      diagnostics: input.diagnostics,
    }),
    iridescenceThicknessMaximum: mapFiniteNumber({
      materialKey: input.materialKey,
      field: `extensions.${IRIDESCENCE_EXTENSION}.iridescenceThicknessMaximum`,
      value: input.iridescenceSource?.iridescenceThicknessMaximum,
      fallback: 400,
      diagnostics: input.diagnostics,
    }),
    metallicRoughnessTexture: mapTextureBinding({
      materialKey: input.materialKey,
      slot: "metallicRoughnessTexture",
      field: "pbrMetallicRoughness.metallicRoughnessTexture",
      value: input.pbrSource.metallicRoughnessTexture,
      resolver: input.resolver,
      diagnostics: input.diagnostics,
    }),
    normalTexture: mapTextureBinding({
      materialKey: input.materialKey,
      slot: "normalTexture",
      field: "normalTexture",
      value: input.material.normalTexture,
      resolver: input.resolver,
      diagnostics: input.diagnostics,
    }),
    normalScale: mapFiniteNumber({
      materialKey: input.materialKey,
      field: "normalTexture.scale",
      value: recordField(input.material, "normalTexture")?.scale,
      fallback: 1,
      diagnostics: input.diagnostics,
    }),
    occlusionTexture: mapTextureBinding({
      materialKey: input.materialKey,
      slot: "occlusionTexture",
      field: "occlusionTexture",
      value: input.material.occlusionTexture,
      resolver: input.resolver,
      diagnostics: input.diagnostics,
    }),
    occlusionStrength: mapFiniteNumber({
      materialKey: input.materialKey,
      field: "occlusionTexture.strength",
      value: recordField(input.material, "occlusionTexture")?.strength,
      fallback: 1,
      diagnostics: input.diagnostics,
    }),
    emissiveFactor: mapVec3({
      materialKey: input.materialKey,
      field: "emissiveFactor",
      value: input.material.emissiveFactor,
      fallback: [0, 0, 0],
      diagnostics: input.diagnostics,
    }),
    emissiveTexture: mapTextureBinding({
      materialKey: input.materialKey,
      slot: "emissiveTexture",
      field: "emissiveTexture",
      value: input.material.emissiveTexture,
      resolver: input.resolver,
      diagnostics: input.diagnostics,
    }),
  });
  inspectUnsupportedClearcoatTextures(
    input.clearcoatSource,
    input.materialKey,
    input.diagnostics,
  );

  return mapped;
}
