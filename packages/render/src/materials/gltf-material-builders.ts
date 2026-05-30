import {
  createStandardMaterialAsset,
  createUnlitMaterialAsset,
} from "./factories.js";
import {
  inspectUnsupportedClearcoatTextures,
  inspectUnsupportedUnlitFields,
} from "./gltf-material-extensions.js";
import { withTransmissionRenderState } from "./gltf-material-render-state.js";
import { mapBaseColorFactor } from "./gltf-material-scalars.js";
import {
  mapStandardClearcoatFields,
  mapStandardIridescenceFields,
  mapStandardSheenFields,
  mapStandardTransmissionFields,
  mapStandardVolumeFields,
} from "./gltf-material-standard-extension-fields.js";
import {
  mapStandardPbrFields,
  mapStandardSurfaceFields,
} from "./gltf-material-standard-fields.js";
import { mapTextureBinding } from "./gltf-material-textures.js";
import type {
  GltfMaterialMappingDiagnostic,
  GltfMaterialTextureBindingResolver,
} from "./gltf-material-types.js";
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
  readonly iorSource?: Record<string, unknown> | undefined;
  readonly volumeSource?: Record<string, unknown> | undefined;
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
    ...mapStandardPbrFields(input),
    ...mapStandardClearcoatFields(input),
    ...mapStandardTransmissionFields(input),
    ...mapStandardVolumeFields(input),
    ...mapStandardSheenFields(input),
    ...mapStandardIridescenceFields(input),
    ...mapStandardSurfaceFields(input),
  });
  inspectUnsupportedClearcoatTextures(
    input.clearcoatSource,
    input.materialKey,
    input.diagnostics,
  );

  return mapped;
}
