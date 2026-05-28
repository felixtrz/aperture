import type { GltfMeshPrimitiveDiagnosticValue } from "./gltf-mesh-primitive.js";

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function integerField(value: unknown): number | null {
  return Number.isInteger(value) && typeof value === "number" ? value : null;
}

export function toDiagnosticValue(
  value: unknown,
): GltfMeshPrimitiveDiagnosticValue {
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
