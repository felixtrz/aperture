import type { GltfMaterialMappingDiagnostic } from "./gltf-material-types.js";
import {
  isFiniteNumberTuple,
  toDiagnosticValue,
} from "./gltf-material-utils.js";

export function mapBaseColorFactor(input: {
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

export function mapVec3(input: {
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

export function mapFiniteNumber(input: {
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

export function mapAlphaCutoff(input: {
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
