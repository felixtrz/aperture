export const GLTF_COMPONENT_BYTE = 5120;
export const GLTF_COMPONENT_UNSIGNED_BYTE = 5121;
export const GLTF_COMPONENT_SHORT = 5122;
export const GLTF_COMPONENT_UNSIGNED_SHORT = 5123;
export const GLTF_COMPONENT_UNSIGNED_INT = 5125;
export const GLTF_COMPONENT_FLOAT = 5126;

export const COMPONENT_BYTE_SIZE = new Map<number, number>([
  [GLTF_COMPONENT_BYTE, 1],
  [GLTF_COMPONENT_UNSIGNED_BYTE, 1],
  [GLTF_COMPONENT_SHORT, 2],
  [GLTF_COMPONENT_UNSIGNED_SHORT, 2],
  [5124, 4],
  [GLTF_COMPONENT_UNSIGNED_INT, 4],
  [GLTF_COMPONENT_FLOAT, 4],
]);

export const ACCESSOR_COMPONENTS = new Map<string, number>([
  ["SCALAR", 1],
  ["VEC2", 2],
  ["VEC3", 3],
  ["VEC4", 4],
  ["MAT2", 4],
  ["MAT3", 9],
  ["MAT4", 16],
]);

export function arrayField(
  root: Record<string, unknown>,
  field: "accessors" | "bufferViews" | "buffers",
): readonly unknown[] | null {
  const value = root[field];
  return Array.isArray(value) ? value : null;
}

export function integerField(value: unknown): number | null {
  return Number.isInteger(value) && typeof value === "number" ? value : null;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function toDiagnosticValue(
  value: unknown,
): string | number | boolean | null {
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
