import type {
  GltfAccessorExpectation,
  GltfAccessorSemantic,
} from "./gltf-accessor-validation-types.js";
import {
  GLTF_COMPONENT_FLOAT,
  GLTF_COMPONENT_UNSIGNED_BYTE,
  GLTF_COMPONENT_UNSIGNED_INT,
  GLTF_COMPONENT_UNSIGNED_SHORT,
} from "./gltf-accessor-validation-utils.js";

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
      return accessor.type === "VEC3" &&
        accessor.componentType === GLTF_COMPONENT_FLOAT
        ? {
            type: "VEC3",
            componentTypes: [GLTF_COMPONENT_FLOAT],
            expectedFormat: "float32x3",
          }
        : null;
    case "TEXCOORD_0":
    case "TEXCOORD_1":
      return accessor.type === "VEC2" &&
        accessor.componentType === GLTF_COMPONENT_FLOAT
        ? {
            type: "VEC2",
            componentTypes: [GLTF_COMPONENT_FLOAT],
            expectedFormat: "float32x2",
          }
        : null;
    case "TANGENT":
      return accessor.type === "VEC4" &&
        accessor.componentType === GLTF_COMPONENT_FLOAT
        ? {
            type: "VEC4",
            componentTypes: [GLTF_COMPONENT_FLOAT],
            expectedFormat: "float32x4",
          }
        : null;
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
