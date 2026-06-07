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

  // Base values come from the (optional) bufferView. An absent bufferView leaves
  // the zero-initialized defaults — valid for a pure-sparse accessor, whose
  // entries are supplied entirely by the sparse override applied below.
  if (bufferViewIndex !== null) {
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
  }

  // KHR sparse accessors: substitute the listed elements on top of the base
  // values. A malformed sparse block fails the whole decode (returns null).
  if (isRecord(accessor.sparse)) {
    const applied = applyGltfSparseOverride({
      sparse: accessor.sparse,
      values,
      count,
      componentCount,
      componentType,
      componentBytes,
      normalized,
      bufferViews,
      resolveBufferBytes: input.resolveBufferBytes,
    });
    if (!applied) {
      return null;
    }
  }

  return { values, count, componentCount };
}

/** Resolve a bufferView index to a DataView over its buffer + its base byte offset. */
function resolveBufferViewDataView(
  bufferViews: readonly unknown[],
  bufferViewIndex: unknown,
  resolveBufferBytes: GltfBufferResolver,
): { readonly view: DataView; readonly base: number } | null {
  if (typeof bufferViewIndex !== "number") {
    return null;
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

  const bytes = bytesView(resolveBufferBytes(bufferIndex));
  if (bytes === null) {
    return null;
  }

  return {
    view: new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength),
    base: typeof bufferView.byteOffset === "number" ? bufferView.byteOffset : 0,
  };
}

/**
 * Apply a KHR sparse accessor override onto already-decoded base `values`.
 * Reads `sparse.count` (index, value-tuple) pairs and overwrites the addressed
 * elements. Returns false on any malformed/out-of-range sparse data.
 */
function applyGltfSparseOverride(input: {
  readonly sparse: Record<string, unknown>;
  readonly values: Float32Array;
  readonly count: number;
  readonly componentCount: number;
  readonly componentType: number;
  readonly componentBytes: number;
  readonly normalized: boolean;
  readonly bufferViews: readonly unknown[];
  readonly resolveBufferBytes: GltfBufferResolver;
}): boolean {
  const { sparse } = input;
  const sparseCount = typeof sparse.count === "number" ? sparse.count : null;
  if (sparseCount === null || sparseCount < 0 || sparseCount > input.count) {
    return false;
  }
  if (sparseCount === 0) {
    return true;
  }

  const indices = isRecord(sparse.indices) ? sparse.indices : null;
  const sparseValues = isRecord(sparse.values) ? sparse.values : null;
  if (indices === null || sparseValues === null) {
    return false;
  }

  const indexComponentType =
    typeof indices.componentType === "number" ? indices.componentType : null;
  if (
    indexComponentType !== GLTF_COMPONENT_UNSIGNED_BYTE &&
    indexComponentType !== GLTF_COMPONENT_UNSIGNED_SHORT &&
    indexComponentType !== GLTF_COMPONENT_UNSIGNED_INT
  ) {
    // Per spec the sparse index component type must be an unsigned int type.
    return false;
  }
  const indexBytes = componentByteSize(indexComponentType) as number;

  const indexData = resolveBufferViewDataView(
    input.bufferViews,
    indices.bufferView,
    input.resolveBufferBytes,
  );
  const valueData = resolveBufferViewDataView(
    input.bufferViews,
    sparseValues.bufferView,
    input.resolveBufferBytes,
  );
  if (indexData === null || valueData === null) {
    return false;
  }

  const indexByteOffset =
    typeof indices.byteOffset === "number" ? indices.byteOffset : 0;
  const valueByteOffset =
    typeof sparseValues.byteOffset === "number" ? sparseValues.byteOffset : 0;

  for (let entry = 0; entry < sparseCount; entry += 1) {
    const indexOffset = indexData.base + indexByteOffset + entry * indexBytes;
    if (indexOffset + indexBytes > indexData.view.byteLength) {
      return false;
    }
    const targetIndex = readComponentAsFloat(
      indexData.view,
      indexOffset,
      indexComponentType,
      false,
    );
    if (
      !Number.isInteger(targetIndex) ||
      targetIndex < 0 ||
      targetIndex >= input.count
    ) {
      return false;
    }

    for (let component = 0; component < input.componentCount; component += 1) {
      const valueOffset =
        valueData.base +
        valueByteOffset +
        (entry * input.componentCount + component) * input.componentBytes;
      if (valueOffset + input.componentBytes > valueData.view.byteLength) {
        return false;
      }
      input.values[targetIndex * input.componentCount + component] =
        readComponentAsFloat(
          valueData.view,
          valueOffset,
          input.componentType,
          input.normalized,
        );
    }
  }

  return true;
}
