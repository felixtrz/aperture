import type {
  GltfMaterialMappingDiagnostic,
  GltfMaterialTextureBindingResolver,
  GltfMaterialTextureBindingResolverDiagnostic,
  GltfMaterialTextureBindingResolverResult,
  GltfMaterialTextureSlot,
} from "./gltf-material.js";
import type {
  MaterialTextureBinding,
  MaterialTextureTransform,
} from "./types.js";
import {
  isFiniteNumberTuple,
  isIdentityTransform,
  isMaterialTextureBinding,
  isNonNegativeInteger,
  isRecord,
  isSupportedTextureTransform,
  isTextureBindingResolverReport,
  recordField,
  toDiagnosticValue,
} from "./gltf-material-utils.js";

const TEXTURE_TRANSFORM_EXTENSION = "KHR_texture_transform";

export function mapTextureBinding(input: {
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
