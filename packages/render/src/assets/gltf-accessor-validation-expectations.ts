import type {
  GltfAccessorExpectation,
  GltfAccessorSemantic,
} from "./gltf-accessor-validation-types.js";
import {
  GLTF_COMPONENT_BYTE,
  GLTF_COMPONENT_FLOAT,
  GLTF_COMPONENT_SHORT,
  GLTF_COMPONENT_UNSIGNED_BYTE,
  GLTF_COMPONENT_UNSIGNED_INT,
  GLTF_COMPONENT_UNSIGNED_SHORT,
} from "./gltf-accessor-validation-utils.js";

const QUANTIZED_NORMALIZED_COMPONENT_TYPES = [
  GLTF_COMPONENT_BYTE,
  GLTF_COMPONENT_UNSIGNED_BYTE,
  GLTF_COMPONENT_SHORT,
  GLTF_COMPONENT_UNSIGNED_SHORT,
] as const;

export function expectationForSemantic(
  semantic: GltfAccessorSemantic,
  accessor: Record<string, unknown>,
): GltfAccessorExpectation | null {
  switch (semantic) {
    case "POSITION":
    case "NORMAL":
    case "MORPH_POSITION_0":
    case "MORPH_POSITION_1":
    case "MORPH_NORMAL_0":
    case "MORPH_NORMAL_1":
      return floatOrQuantizedNormalizedExpectation(
        accessor,
        "VEC3",
        "float32x3",
      );
    case "TEXCOORD_0":
    case "TEXCOORD_1":
      return floatOrQuantizedNormalizedExpectation(
        accessor,
        "VEC2",
        "float32x2",
      );
    case "TANGENT":
      return floatOrQuantizedNormalizedExpectation(
        accessor,
        "VEC4",
        "float32x4",
      );
    case "COLOR_0":
      if (
        accessor.type === "VEC3" &&
        accessor.componentType === GLTF_COMPONENT_FLOAT
      ) {
        return {
          type: "VEC3",
          componentTypes: [GLTF_COMPONENT_FLOAT],
          expectedFormat: "float32x3",
        };
      }
      if (
        accessor.type === "VEC4" &&
        accessor.componentType === GLTF_COMPONENT_FLOAT
      ) {
        return {
          type: "VEC4",
          componentTypes: [GLTF_COMPONENT_FLOAT],
          expectedFormat: "float32x4",
        };
      }
      if (accessor.type !== "VEC3" && accessor.type !== "VEC4") {
        return null;
      }
      if (accessor.normalized !== true) {
        return null;
      }
      if (accessor.componentType === GLTF_COMPONENT_UNSIGNED_BYTE) {
        return {
          type: accessor.type,
          componentTypes: [GLTF_COMPONENT_UNSIGNED_BYTE],
          expectedFormat: "unorm8x4",
        };
      }
      if (accessor.componentType === GLTF_COMPONENT_UNSIGNED_SHORT) {
        return {
          type: accessor.type,
          componentTypes: [GLTF_COMPONENT_UNSIGNED_SHORT],
          expectedFormat: "unorm16x4",
        };
      }
      return null;
    case "JOINTS_0":
      if (accessor.type !== "VEC4") {
        return null;
      }
      if (accessor.componentType === GLTF_COMPONENT_UNSIGNED_BYTE) {
        return {
          type: "VEC4",
          componentTypes: [GLTF_COMPONENT_UNSIGNED_BYTE],
          expectedFormat: "uint8x4",
        };
      }
      if (accessor.componentType === GLTF_COMPONENT_UNSIGNED_SHORT) {
        return {
          type: "VEC4",
          componentTypes: [GLTF_COMPONENT_UNSIGNED_SHORT],
          expectedFormat: "uint16x4",
        };
      }
      return null;
    case "WEIGHTS_0":
      if (accessor.type !== "VEC4") {
        return null;
      }
      if (accessor.componentType === GLTF_COMPONENT_FLOAT) {
        return {
          type: "VEC4",
          componentTypes: [GLTF_COMPONENT_FLOAT],
          expectedFormat: "float32x4",
        };
      }
      if (accessor.normalized !== true) {
        return null;
      }
      if (accessor.componentType === GLTF_COMPONENT_UNSIGNED_BYTE) {
        return {
          type: "VEC4",
          componentTypes: [GLTF_COMPONENT_UNSIGNED_BYTE],
          expectedFormat: "unorm8x4",
        };
      }
      if (accessor.componentType === GLTF_COMPONENT_UNSIGNED_SHORT) {
        return {
          type: "VEC4",
          componentTypes: [GLTF_COMPONENT_UNSIGNED_SHORT],
          expectedFormat: "unorm16x4",
        };
      }
      return null;
    case "INDICES":
      if (accessor.type !== "SCALAR") {
        return null;
      }
      if (accessor.componentType === GLTF_COMPONENT_UNSIGNED_BYTE) {
        return {
          type: "SCALAR",
          componentTypes: [GLTF_COMPONENT_UNSIGNED_BYTE],
          expectedFormat: "uint8-to-uint16",
        };
      }
      if (accessor.componentType === GLTF_COMPONENT_UNSIGNED_SHORT) {
        return {
          type: "SCALAR",
          componentTypes: [GLTF_COMPONENT_UNSIGNED_SHORT],
          expectedFormat: "uint16",
        };
      }
      if (accessor.componentType === GLTF_COMPONENT_UNSIGNED_INT) {
        return {
          type: "SCALAR",
          componentTypes: [GLTF_COMPONENT_UNSIGNED_INT],
          expectedFormat: "uint32",
        };
      }
      return null;
  }
}

export function hasUnsupportedQuantizedComponentType(
  semantic: GltfAccessorSemantic,
  accessor: Record<string, unknown>,
): boolean {
  const type = quantizedAttributeType(semantic);

  return (
    type !== null &&
    accessor.type === type &&
    accessor.normalized === true &&
    accessor.componentType !== GLTF_COMPONENT_FLOAT &&
    !isQuantizedNormalizedComponentType(accessor.componentType)
  );
}

function floatOrQuantizedNormalizedExpectation(
  accessor: Record<string, unknown>,
  type: "VEC2" | "VEC3" | "VEC4",
  expectedFormat: GltfAccessorExpectation["expectedFormat"],
): GltfAccessorExpectation | null {
  if (accessor.type !== type) {
    return null;
  }

  if (accessor.componentType === GLTF_COMPONENT_FLOAT) {
    return {
      type,
      componentTypes: [GLTF_COMPONENT_FLOAT],
      expectedFormat,
    };
  }

  if (
    accessor.normalized === true &&
    isQuantizedNormalizedComponentType(accessor.componentType)
  ) {
    return {
      type,
      componentTypes: [accessor.componentType],
      expectedFormat,
    };
  }

  return null;
}

function quantizedAttributeType(
  semantic: GltfAccessorSemantic,
): "VEC2" | "VEC3" | "VEC4" | null {
  switch (semantic) {
    case "POSITION":
    case "NORMAL":
    case "MORPH_POSITION_0":
    case "MORPH_POSITION_1":
    case "MORPH_NORMAL_0":
    case "MORPH_NORMAL_1":
      return "VEC3";
    case "TEXCOORD_0":
    case "TEXCOORD_1":
      return "VEC2";
    case "TANGENT":
      return "VEC4";
    case "COLOR_0":
    case "JOINTS_0":
    case "WEIGHTS_0":
    case "INDICES":
      return null;
  }
}

function isQuantizedNormalizedComponentType(
  value: unknown,
): value is
  | typeof GLTF_COMPONENT_BYTE
  | typeof GLTF_COMPONENT_UNSIGNED_BYTE
  | typeof GLTF_COMPONENT_SHORT
  | typeof GLTF_COMPONENT_UNSIGNED_SHORT {
  return (
    typeof value === "number" &&
    (QUANTIZED_NORMALIZED_COMPONENT_TYPES as readonly number[]).includes(value)
  );
}
