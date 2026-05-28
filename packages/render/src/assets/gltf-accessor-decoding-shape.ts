import type { GltfValidatedAccessorReference } from "./gltf-accessor-validation.js";
import type {
  DecodeShape,
  GltfDecodedArray,
} from "./gltf-accessor-decoding-types.js";

const ACCESSOR_COMPONENTS = new Map<string, number>([
  ["SCALAR", 1],
  ["VEC2", 2],
  ["VEC3", 3],
  ["VEC4", 4],
]);

export const NATIVE_LITTLE_ENDIAN =
  new Uint8Array(new Uint16Array([1]).buffer)[0] === 1;

export function decodeShape(
  accessor: GltfValidatedAccessorReference,
): DecodeShape | null {
  const sourceItemSize = ACCESSOR_COMPONENTS.get(accessor.accessorType);

  if (sourceItemSize === undefined) {
    return null;
  }

  switch (accessor.expectedFormat) {
    case "float32x2":
    case "float32x3":
    case "float32x4":
      return {
        sourceItemSize,
        outputItemSize: sourceItemSize,
        sourceComponentBytes: 4,
        output: "float32",
        paddingComponentValue: 0,
      };
    case "unorm8x4":
      return {
        sourceItemSize,
        outputItemSize: 4,
        sourceComponentBytes: 1,
        output: "uint8",
        paddingComponentValue: 255,
      };
    case "unorm16x4":
      return {
        sourceItemSize,
        outputItemSize: 4,
        sourceComponentBytes: 2,
        output: "uint16",
        paddingComponentValue: 65535,
      };
    case "uint8x4":
      return {
        sourceItemSize,
        outputItemSize: sourceItemSize,
        sourceComponentBytes: 1,
        output: "uint8",
        paddingComponentValue: 0,
      };
    case "uint16x4":
      return {
        sourceItemSize,
        outputItemSize: sourceItemSize,
        sourceComponentBytes: 2,
        output: "uint16",
        paddingComponentValue: 0,
      };
    case "uint8-to-uint16":
      return {
        sourceItemSize,
        outputItemSize: sourceItemSize,
        sourceComponentBytes: 1,
        output: "uint16",
        paddingComponentValue: 0,
      };
    case "uint16":
      return {
        sourceItemSize,
        outputItemSize: sourceItemSize,
        sourceComponentBytes: 2,
        output: "uint16",
        paddingComponentValue: 0,
      };
    case "uint32":
      return {
        sourceItemSize,
        outputItemSize: sourceItemSize,
        sourceComponentBytes: 4,
        output: "uint32",
        paddingComponentValue: 0,
      };
  }
}

export function createOutputArray(
  shape: DecodeShape,
  length: number,
): GltfDecodedArray {
  switch (shape.output) {
    case "float32":
      return new Float32Array(length);
    case "uint8":
      return new Uint8Array(length);
    case "uint16":
      return new Uint16Array(length);
    case "uint32":
      return new Uint32Array(length);
  }
}

export function createOutputArrayView(
  shape: DecodeShape,
  buffer: ArrayBufferLike,
  byteOffset: number,
  length: number,
): GltfDecodedArray {
  switch (shape.output) {
    case "float32":
      return new Float32Array(buffer, byteOffset, length);
    case "uint8":
      return new Uint8Array(buffer, byteOffset, length);
    case "uint16":
      return new Uint16Array(buffer, byteOffset, length);
    case "uint32":
      return new Uint32Array(buffer, byteOffset, length);
  }
}

export function outputComponentBytes(shape: DecodeShape): 1 | 2 | 4 {
  return shape.output === "uint8" ? 1 : shape.output === "uint16" ? 2 : 4;
}

export function readComponent(
  view: DataView,
  byteOffset: number,
  expectedFormat: GltfValidatedAccessorReference["expectedFormat"],
): number {
  switch (expectedFormat) {
    case "float32x2":
    case "float32x3":
    case "float32x4":
      return view.getFloat32(byteOffset, true);
    case "unorm8x4":
    case "uint8x4":
    case "uint8-to-uint16":
      return view.getUint8(byteOffset);
    case "unorm16x4":
    case "uint16x4":
    case "uint16":
      return view.getUint16(byteOffset, true);
    case "uint32":
      return view.getUint32(byteOffset, true);
  }
}

export function arrayTypeForExpectedFormat(
  expectedFormat: GltfValidatedAccessorReference["expectedFormat"],
): string {
  switch (expectedFormat) {
    case "float32x2":
    case "float32x3":
    case "float32x4":
      return "Float32Array";
    case "unorm8x4":
    case "uint8x4":
      return "Uint8Array";
    case "unorm16x4":
    case "uint16x4":
    case "uint8-to-uint16":
    case "uint16":
      return "Uint16Array";
    case "uint32":
      return "Uint32Array";
  }
}
