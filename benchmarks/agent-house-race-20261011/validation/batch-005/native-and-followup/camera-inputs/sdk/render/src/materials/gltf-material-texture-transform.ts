import type {
  GltfMaterialMappingDiagnostic,
  GltfMaterialTextureSlot,
} from "./gltf-material-types.js";
import {
  isFiniteNumberTuple,
  isIdentityTransform,
  isNonNegativeInteger,
  isRecord,
  isSupportedTextureTransform,
  recordField,
  toDiagnosticValue,
} from "./gltf-material-utils.js";
import type { MaterialTextureTransform } from "./types.js";

const TEXTURE_TRANSFORM_EXTENSION = "KHR_texture_transform";

export function mapTextureTransform(input: {
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
