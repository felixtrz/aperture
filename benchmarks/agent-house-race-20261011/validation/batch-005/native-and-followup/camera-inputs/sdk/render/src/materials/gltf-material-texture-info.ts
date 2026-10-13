import type {
  GltfMaterialMappingDiagnostic,
  GltfMaterialTextureSlot,
} from "./gltf-material-types.js";
import {
  isNonNegativeInteger,
  isRecord,
  toDiagnosticValue,
} from "./gltf-material-utils.js";

export function mapTextureInfoSource(input: {
  readonly materialKey: string;
  readonly slot: GltfMaterialTextureSlot;
  readonly field: string;
  readonly value: unknown;
  readonly diagnostics: GltfMaterialMappingDiagnostic[];
}): Record<string, unknown> | null {
  if (isRecord(input.value)) {
    return input.value;
  }

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

export function mapTextureIndex(input: {
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

export function mapTextureTexCoord(input: {
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
