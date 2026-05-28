import {
  CLEARCOAT_EXTENSION,
  IRIDESCENCE_EXTENSION,
  SHEEN_EXTENSION,
  TRANSMISSION_EXTENSION,
} from "./gltf-material-extensions.js";
import { mapFiniteNumber, mapVec3 } from "./gltf-material-scalars.js";
import { mapTextureBinding } from "./gltf-material-textures.js";
import type { StandardMaterialAsset } from "./types.js";
import type { GltfStandardMaterialFieldInput } from "./gltf-material-standard-fields.js";

export function mapStandardClearcoatFields(
  input: GltfStandardMaterialFieldInput,
): Pick<
  StandardMaterialAsset,
  | "clearcoatFactor"
  | "clearcoatTexture"
  | "clearcoatRoughnessFactor"
  | "clearcoatRoughnessTexture"
> {
  return {
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
  };
}

export function mapStandardTransmissionFields(
  input: GltfStandardMaterialFieldInput,
): Pick<StandardMaterialAsset, "transmissionFactor" | "transmissionTexture"> {
  return {
    transmissionFactor: input.transmissionFactor,
    transmissionTexture: mapTextureBinding({
      materialKey: input.materialKey,
      slot: "transmissionTexture",
      field: `extensions.${TRANSMISSION_EXTENSION}.transmissionTexture`,
      value: input.transmissionSource?.transmissionTexture,
      resolver: input.resolver,
      diagnostics: input.diagnostics,
    }),
  };
}

export function mapStandardSheenFields(
  input: GltfStandardMaterialFieldInput,
): Pick<
  StandardMaterialAsset,
  | "sheenColorFactor"
  | "sheenColorTexture"
  | "sheenRoughnessFactor"
  | "sheenRoughnessTexture"
> {
  return {
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
  };
}

export function mapStandardIridescenceFields(
  input: GltfStandardMaterialFieldInput,
): Pick<
  StandardMaterialAsset,
  | "iridescenceFactor"
  | "iridescenceTexture"
  | "iridescenceThicknessTexture"
  | "iridescenceIor"
  | "iridescenceThicknessMinimum"
  | "iridescenceThicknessMaximum"
> {
  return {
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
  };
}
