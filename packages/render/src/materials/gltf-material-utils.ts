import type {
  GltfMaterialDiagnosticValue,
  GltfMaterialMappingDiagnostic,
  GltfMaterialTextureBindingResolverReport,
  GltfMaterialTextureSlot,
} from "./gltf-material.js";
import type {
  MaterialTextureBinding,
  MaterialTextureTransform,
} from "./types.js";

export function recordField(
  source: Record<string, unknown>,
  field: string,
): Record<string, unknown> | undefined {
  const value = source[field];
  return isRecord(value) ? value : undefined;
}

export function optionalRecordField(input: {
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

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isMaterialTextureBinding(
  value: unknown,
): value is MaterialTextureBinding {
  return isRecord(value) && "texture" in value && "sampler" in value;
}

export function isTextureBindingResolverReport(
  value: unknown,
): value is GltfMaterialTextureBindingResolverReport {
  return (
    isRecord(value) &&
    !isMaterialTextureBinding(value) &&
    ("binding" in value || "diagnostics" in value)
  );
}

export function isNonNegativeInteger(value: unknown): value is number {
  return Number.isInteger(value) && typeof value === "number" && value >= 0;
}

export function isFiniteNumberTuple(
  value: unknown,
  length: number,
): value is readonly number[] {
  return (
    Array.isArray(value) &&
    value.length === length &&
    value.every((item) => typeof item === "number" && Number.isFinite(item))
  );
}

export function isIdentityTransform(
  transform: MaterialTextureTransform,
): boolean {
  return (
    (transform.offset === undefined ||
      (transform.offset[0] === 0 && transform.offset[1] === 0)) &&
    (transform.scale === undefined ||
      (transform.scale[0] === 1 && transform.scale[1] === 1)) &&
    (transform.rotation === undefined || transform.rotation === 0)
  );
}

export function isSupportedTextureTransform(
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

export function isFiniteTextureTransform(
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

export function toDiagnosticValue(value: unknown): GltfMaterialDiagnosticValue {
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
