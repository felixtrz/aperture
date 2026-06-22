import type { GltfDecodedAccessor } from "./gltf-accessor-decoding.js";
import type { MeshVertexAttributeDescriptor } from "../mesh/index.js";

export function isSupportedMeshAttributeArray(
  decoded: GltfDecodedAccessor,
): boolean {
  if (decoded.semantic === "JOINTS_0") {
    return (
      (decoded.expectedFormat === "uint8x4" &&
        decoded.array instanceof Uint8Array &&
        decoded.itemSize === 4) ||
      (decoded.expectedFormat === "uint16x4" &&
        decoded.array instanceof Uint16Array &&
        decoded.itemSize === 4)
    );
  }

  if (decoded.semantic === "WEIGHTS_0") {
    if (decoded.expectedFormat === "unorm8x4") {
      return decoded.array instanceof Uint8Array && decoded.itemSize === 4;
    }
    if (decoded.expectedFormat === "unorm16x4") {
      return decoded.array instanceof Uint16Array && decoded.itemSize === 4;
    }

    return decoded.array instanceof Float32Array && decoded.itemSize === 4;
  }

  if (decoded.semantic === "COLOR_0") {
    if (decoded.expectedFormat === "unorm8x4") {
      return decoded.array instanceof Uint8Array && decoded.itemSize === 4;
    }
    if (decoded.expectedFormat === "unorm16x4") {
      return decoded.array instanceof Uint16Array && decoded.itemSize === 4;
    }

    return (
      decoded.array instanceof Float32Array &&
      (decoded.itemSize === 3 || decoded.itemSize === 4)
    );
  }

  return decoded.array instanceof Float32Array;
}

export function decodedAttributeByteSize(decoded: GltfDecodedAccessor): number {
  return decoded.itemSize * decodedComponentByteSize(decoded);
}

export function decodedComponentByteSize(
  decoded: GltfDecodedAccessor,
): 1 | 2 | 4 {
  if (decoded.array instanceof Uint8Array) {
    return 1;
  }

  if (decoded.array instanceof Uint16Array) {
    return 2;
  }

  return 4;
}

export function meshVertexFormatByteSize(
  format: MeshVertexAttributeDescriptor["format"],
): number {
  switch (format) {
    case "uint8x4":
    case "unorm8x4":
      return 4;
    case "uint16x4":
    case "unorm16x4":
    case "float32x2":
      return 8;
    case "float32x3":
      return 12;
    case "float32x4":
      return 16;
  }
}

export function meshVertexFormatForDecodedAccessor(
  decoded: GltfDecodedAccessor,
): MeshVertexAttributeDescriptor["format"] {
  if (decoded.expectedFormat === "unorm8x4") {
    return "unorm8x4";
  }

  if (decoded.expectedFormat === "unorm16x4") {
    return "unorm16x4";
  }

  if (decoded.semantic === "JOINTS_0") {
    return decoded.expectedFormat === "uint8x4" ? "uint8x4" : "uint16x4";
  }

  return decoded.itemSize === 2
    ? "float32x2"
    : decoded.itemSize === 4
      ? "float32x4"
      : "float32x3";
}
