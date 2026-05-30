import {
  GLTF_COMPONENT_BYTE,
  GLTF_COMPONENT_FLOAT,
  GLTF_COMPONENT_SHORT,
  GLTF_COMPONENT_UNSIGNED_BYTE,
  GLTF_COMPONENT_UNSIGNED_INT,
  GLTF_COMPONENT_UNSIGNED_SHORT,
} from "./gltf-accessor-validation-utils.js";

/**
 * Standalone float accessor reader for non-primitive accessors — inverse-bind
 * matrices (skins, M2-T3) and animation sampler input/output (M2-T4). The
 * primitive accessor decoder (`decodeGltfPrimitiveAccessors`) is shaped for
 * vertex attributes (vec2/3/4) and cannot express MAT4 / SCALAR / dynamic-width
 * weights outputs, so this is the single engine reader those import paths share
 * — replacing the hand-rolled `readGltfFloatAccessorTuples` in the glb-viewer
 * worker rather than adding a second drifting decoder.
 */

/** Resolves a glTF buffer index to its backing bytes (e.g. the GLB BIN chunk). */
export type GltfBufferResolver = (
  bufferIndex: number,
) => ArrayBuffer | ArrayBufferView | null | undefined;

export interface GltfDecodedFloatAccessor {
  /** Flat output, length === `count * componentCount`. */
  readonly values: Float32Array;
  readonly count: number;
  readonly componentCount: number;
}

const ACCESSOR_TYPE_COMPONENTS = new Map<string, number>([
  ["SCALAR", 1],
  ["VEC2", 2],
  ["VEC3", 3],
  ["VEC4", 4],
  ["MAT2", 4],
  ["MAT3", 9],
  ["MAT4", 16],
]);

function componentByteSize(componentType: number): number | null {
  switch (componentType) {
    case GLTF_COMPONENT_BYTE:
    case GLTF_COMPONENT_UNSIGNED_BYTE:
      return 1;
    case GLTF_COMPONENT_SHORT:
    case GLTF_COMPONENT_UNSIGNED_SHORT:
      return 2;
    case GLTF_COMPONENT_FLOAT:
    case GLTF_COMPONENT_UNSIGNED_INT:
      return 4;
    default:
      return null;
  }
}

function readComponentAsFloat(
  view: DataView,
  byteOffset: number,
  componentType: number,
  normalized: boolean,
): number {
  switch (componentType) {
    case GLTF_COMPONENT_FLOAT:
      return view.getFloat32(byteOffset, true);
    case GLTF_COMPONENT_BYTE: {
      const value = view.getInt8(byteOffset);
      return normalized ? Math.max(value / 127, -1) : value;
    }
    case GLTF_COMPONENT_UNSIGNED_BYTE: {
      const value = view.getUint8(byteOffset);
      return normalized ? value / 255 : value;
    }
    case GLTF_COMPONENT_SHORT: {
      const value = view.getInt16(byteOffset, true);
      return normalized ? Math.max(value / 32767, -1) : value;
    }
    case GLTF_COMPONENT_UNSIGNED_SHORT: {
      const value = view.getUint16(byteOffset, true);
      return normalized ? value / 65535 : value;
    }
    case GLTF_COMPONENT_UNSIGNED_INT:
      return view.getUint32(byteOffset, true);
    default:
      return 0;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function bytesView(
  source: ArrayBuffer | ArrayBufferView | null | undefined,
): Uint8Array | null {
  if (source === null || source === undefined) {
    return null;
  }
  return source instanceof ArrayBuffer
    ? new Uint8Array(source)
    : new Uint8Array(source.buffer, source.byteOffset, source.byteLength);
}

/**
 * Decode a glTF accessor (by index) into a flat `Float32Array`. Honors
 * bufferView byteStride, accessor byteOffset, and normalized integer
 * components. Returns `null` if the accessor/bufferView/buffer is malformed or
 * the component type is unsupported.
 */
export function decodeGltfFloatAccessor(input: {
  readonly root: unknown;
  readonly accessorIndex: number;
  readonly resolveBufferBytes: GltfBufferResolver;
}): GltfDecodedFloatAccessor | null {
  const { root, accessorIndex } = input;
  if (!isRecord(root) || !Array.isArray(root.accessors)) {
    return null;
  }

  const accessor = root.accessors[accessorIndex];
  if (!isRecord(accessor)) {
    return null;
  }

  const accessorType = typeof accessor.type === "string" ? accessor.type : null;
  const componentCount =
    accessorType === null
      ? undefined
      : ACCESSOR_TYPE_COMPONENTS.get(accessorType);
  const componentType =
    typeof accessor.componentType === "number" ? accessor.componentType : null;
  const count = typeof accessor.count === "number" ? accessor.count : null;

  if (
    componentCount === undefined ||
    componentType === null ||
    count === null ||
    count < 0
  ) {
    return null;
  }

  const componentBytes = componentByteSize(componentType);
  if (componentBytes === null) {
    return null;
  }

  const elementByteSize = componentBytes * componentCount;
  const accessorByteOffset =
    typeof accessor.byteOffset === "number" ? accessor.byteOffset : 0;
  const normalized = accessor.normalized === true;

  const bufferViews = Array.isArray(root.bufferViews) ? root.bufferViews : [];
  const bufferViewIndex =
    typeof accessor.bufferView === "number" ? accessor.bufferView : null;

  const values = new Float32Array(count * componentCount);

  // A sparse-or-absent bufferView yields the zero-initialized default values.
  if (bufferViewIndex === null) {
    return { values, count, componentCount };
  }

  const bufferView = bufferViews[bufferViewIndex];
  if (!isRecord(bufferView)) {
    return null;
  }

  const bufferIndex =
    typeof bufferView.buffer === "number" ? bufferView.buffer : null;
  if (bufferIndex === null) {
    return null;
  }

  const bytes = bytesView(input.resolveBufferBytes(bufferIndex));
  if (bytes === null) {
    return null;
  }

  const bufferViewByteOffset =
    typeof bufferView.byteOffset === "number" ? bufferView.byteOffset : 0;
  const byteStride =
    typeof bufferView.byteStride === "number" && bufferView.byteStride > 0
      ? bufferView.byteStride
      : elementByteSize;

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const baseOffset = bufferViewByteOffset + accessorByteOffset;

  for (let element = 0; element < count; element += 1) {
    const elementOffset = baseOffset + element * byteStride;
    for (let component = 0; component < componentCount; component += 1) {
      const byteOffset = elementOffset + component * componentBytes;
      if (byteOffset + componentBytes > bytes.byteLength) {
        return null;
      }
      values[element * componentCount + component] = readComponentAsFloat(
        view,
        byteOffset,
        componentType,
        normalized,
      );
    }
  }

  return { values, count, componentCount };
}
