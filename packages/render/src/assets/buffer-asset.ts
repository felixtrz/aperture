// A2 (three.js parity plan): renderer-independent GPU buffer source asset.
// `BufferAsset` is the data-only source for custom-material storage-buffer
// bindings (and, later, compute→draw plumbing). It registers in the
// `AssetRegistry` under a `BufferHandle` like any other source asset, is
// structured-clone-safe for the worker asset mirror (typed-array data), and
// never carries live GPU objects; the WebGPU backend owns the realized
// `GPUBuffer`.

/**
 * Typed element schema for a {@link BufferAsset}.
 *
 * Byte layout is std430-style for `var<storage, read> array<T>` bindings:
 * `f32`/`u32`/`i32` stride 4, `vec2f` stride 8, `vec4f` stride 16. `vec3f`
 * is a declared element type but is REJECTED by {@link validateBufferAsset}
 * (`bufferAsset.vec3fUnsupported`): a storage array of `vec3f` has a 16-byte
 * stride in WGSL, so tightly-packed 12-byte CPU data would silently shear.
 * Use `vec4f` (or three `f32` arrays) instead.
 */
export type BufferElementType =
  | "f32"
  | "vec2f"
  | "vec3f"
  | "vec4f"
  | "u32"
  | "i32";

export type BufferAssetUsage = "read-only-storage";

export type BufferAssetData = Float32Array | Uint32Array | Int32Array;

export interface BufferAsset {
  readonly kind: "buffer";
  readonly label: string;
  readonly elementType: BufferElementType;
  readonly elementCount: number;
  readonly usage: BufferAssetUsage;
  /**
   * Optional initial contents (`elementCount * componentCount` elements).
   * Absent data means the renderer zero-initializes the GPU buffer.
   */
  readonly data?: BufferAssetData;
}

export type BufferAssetDiagnosticCode =
  | "bufferAsset.invalidLabel"
  | "bufferAsset.invalidElementType"
  | "bufferAsset.vec3fUnsupported"
  | "bufferAsset.invalidElementCount"
  | "bufferAsset.invalidUsage"
  | "bufferAsset.dataTypeMismatch"
  | "bufferAsset.dataLengthMismatch"
  | "bufferAsset.liveRendererObject";

export interface BufferAssetValidationDiagnostic {
  readonly code: BufferAssetDiagnosticCode;
  readonly message: string;
  readonly severity: "error" | "warning";
  readonly field?: string;
}

export interface BufferAssetValidationReport {
  readonly valid: boolean;
  readonly diagnostics: readonly BufferAssetValidationDiagnostic[];
}

export interface CreateBufferAssetInput {
  readonly label?: string;
  readonly elementType: BufferElementType;
  readonly elementCount: number;
  readonly usage?: BufferAssetUsage;
  readonly data?: BufferAssetData;
}

export function createBufferAsset(input: CreateBufferAssetInput): BufferAsset {
  return {
    kind: "buffer",
    label: input.label ?? "Buffer",
    elementType: input.elementType,
    elementCount: input.elementCount,
    usage: input.usage ?? "read-only-storage",
    ...(input.data === undefined ? {} : { data: input.data }),
  };
}

export function isBufferAsset(value: unknown): value is BufferAsset {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const asset = value as BufferAsset;

  return (
    asset.kind === "buffer" &&
    typeof asset.label === "string" &&
    typeof asset.elementType === "string" &&
    typeof asset.elementCount === "number"
  );
}

/** Number of CPU-side array elements per buffer element. */
export function bufferElementComponentCount(type: BufferElementType): number {
  switch (type) {
    case "vec2f":
      return 2;
    case "vec3f":
      return 3;
    case "vec4f":
      return 4;
    default:
      return 1;
  }
}

/**
 * std430-style array stride in bytes for `var<storage, read> array<T>`.
 * Note the vec3f case: WGSL rounds the array stride up to 16 bytes, which is
 * exactly why {@link validateBufferAsset} rejects vec3f buffer assets.
 */
export function bufferElementByteStride(type: BufferElementType): number {
  switch (type) {
    case "vec2f":
      return 8;
    case "vec3f":
    case "vec4f":
      return 16;
    default:
      return 4;
  }
}

/** Total GPU byte length of the realized storage buffer. */
export function bufferAssetByteLength(
  asset: Pick<BufferAsset, "elementType" | "elementCount">,
): number {
  return bufferElementByteStride(asset.elementType) * asset.elementCount;
}

const BUFFER_ELEMENT_TYPES: readonly BufferElementType[] = [
  "f32",
  "vec2f",
  "vec3f",
  "vec4f",
  "u32",
  "i32",
];

export function validateBufferAsset(
  asset: BufferAsset,
): BufferAssetValidationReport {
  const diagnostics: BufferAssetValidationDiagnostic[] = [];

  if (typeof asset.label !== "string" || asset.label.trim().length === 0) {
    diagnostics.push({
      code: "bufferAsset.invalidLabel",
      severity: "warning",
      field: "label",
      message: "Buffer asset should provide a non-empty label.",
    });
  }

  const knownElementType = BUFFER_ELEMENT_TYPES.includes(asset.elementType);

  if (!knownElementType) {
    diagnostics.push({
      code: "bufferAsset.invalidElementType",
      severity: "error",
      field: "elementType",
      message: `Buffer asset elementType '${String(asset.elementType)}' must be one of ${BUFFER_ELEMENT_TYPES.join(", ")}.`,
    });
  } else if (asset.elementType === "vec3f") {
    diagnostics.push({
      code: "bufferAsset.vec3fUnsupported",
      severity: "error",
      field: "elementType",
      message:
        "Buffer asset elementType 'vec3f' is not supported: a WGSL storage array of vec3f has a 16-byte std430 stride, so tightly-packed 12-byte CPU data would read sheared. Use 'vec4f' (padding the fourth component) or split into 'f32' buffers.",
    });
  }

  if (
    !Number.isInteger(asset.elementCount) ||
    asset.elementCount <= 0 ||
    !Number.isSafeInteger(asset.elementCount)
  ) {
    diagnostics.push({
      code: "bufferAsset.invalidElementCount",
      severity: "error",
      field: "elementCount",
      message: `Buffer asset elementCount must be a positive safe integer, received ${String(asset.elementCount)}.`,
    });
  }

  if (asset.usage !== "read-only-storage") {
    diagnostics.push({
      code: "bufferAsset.invalidUsage",
      severity: "error",
      field: "usage",
      message: `Buffer asset usage '${String(asset.usage)}' must be 'read-only-storage'.`,
    });
  }

  validateBufferAssetData(asset, knownElementType, diagnostics);

  return {
    valid: !diagnostics.some((diagnostic) => diagnostic.severity === "error"),
    diagnostics,
  };
}

function validateBufferAssetData(
  asset: BufferAsset,
  knownElementType: boolean,
  diagnostics: BufferAssetValidationDiagnostic[],
): void {
  const data = asset.data;

  if (data === undefined) {
    return;
  }

  // Consistent with customMaterialSource.liveRendererObject: buffer sources
  // must stay data-only. Anything GPU-shaped (or otherwise non-clonable) in
  // the data slot is rejected before it can reach the registry mirror.
  if (looksLikeLiveRendererObject(data)) {
    diagnostics.push({
      code: "bufferAsset.liveRendererObject",
      severity: "error",
      field: "data",
      message:
        "Buffer asset data contains renderer-owned or non-serializable data. Provide a Float32Array, Uint32Array, or Int32Array; the WebGPU backend owns the realized GPUBuffer.",
    });
    return;
  }

  const expectedConstructor = expectedBufferDataConstructor(asset.elementType);

  if (
    knownElementType &&
    expectedConstructor !== null &&
    !(data instanceof expectedConstructor)
  ) {
    diagnostics.push({
      code: "bufferAsset.dataTypeMismatch",
      severity: "error",
      field: "data",
      message: `Buffer asset data for elementType '${asset.elementType}' must be a ${expectedConstructor.name}.`,
    });
    return;
  }

  if (
    knownElementType &&
    Number.isInteger(asset.elementCount) &&
    asset.elementCount > 0
  ) {
    const expectedLength =
      asset.elementCount * bufferElementComponentCount(asset.elementType);

    if (data.length !== expectedLength) {
      diagnostics.push({
        code: "bufferAsset.dataLengthMismatch",
        severity: "error",
        field: "data",
        message: `Buffer asset data length ${String(data.length)} does not match elementCount ${String(asset.elementCount)} x ${String(bufferElementComponentCount(asset.elementType))} = ${String(expectedLength)} components.`,
      });
    }
  }
}

function expectedBufferDataConstructor(
  type: BufferElementType,
): (new (length: number) => BufferAssetData) | null {
  switch (type) {
    case "u32":
      return Uint32Array;
    case "i32":
      return Int32Array;
    case "f32":
    case "vec2f":
    case "vec3f":
    case "vec4f":
      return Float32Array;
    default:
      return null;
  }
}

function looksLikeLiveRendererObject(value: object): boolean {
  if (
    value instanceof Float32Array ||
    value instanceof Uint32Array ||
    value instanceof Int32Array
  ) {
    return false;
  }

  const constructorName = value.constructor?.name ?? "";

  return (
    constructorName.startsWith("GPU") ||
    "destroy" in value ||
    "mapAsync" in value ||
    "getMappedRange" in value
  );
}
