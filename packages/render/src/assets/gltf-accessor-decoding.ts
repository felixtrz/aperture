import type {
  GltfAccessorSemantic,
  GltfAccessorValidationReport,
  GltfPrimitiveAccessorPlan,
  GltfValidatedAccessorReference,
} from "./gltf-accessor-validation.js";

export type GltfDecodedArray =
  | Float32Array
  | Uint8Array
  | Uint16Array
  | Uint32Array;

export interface GltfAccessorDecodingDiagnostic {
  readonly code: string;
  readonly severity: "error" | "warning";
  readonly message: string;
  readonly meshHandleKey?: string;
  readonly meshIndex?: number;
  readonly primitiveIndex?: number;
  readonly semantic?: GltfAccessorSemantic;
  readonly accessorIndex?: number;
  readonly bufferViewIndex?: number;
  readonly bufferIndex?: number;
  readonly byteOffset?: number;
  readonly byteLength?: number;
  readonly expectedFormat?: string;
  readonly arrayType?: string;
}

export interface GltfAccessorDecodingOptions {
  readonly validationReport: GltfAccessorValidationReport;
  readonly resolveBufferBytes: (
    bufferIndex: number,
  ) => ArrayBuffer | ArrayBufferView | null | undefined;
  readonly storageMode?: GltfAccessorStorageMode;
}

export type GltfAccessorStorageMode = "compact-copy" | "source-view";

export interface GltfDecodedAccessor {
  readonly semantic: GltfAccessorSemantic;
  readonly accessorIndex: number;
  readonly bufferIndex: number;
  readonly sourceByteOffset: number;
  readonly sourceByteLength: number;
  readonly sourceBufferViewIndex?: number;
  readonly sourceView?: Uint8Array;
  readonly sourceViewByteOffset?: number;
  readonly sourceByteStride?: number;
  readonly sourceElementByteSize?: number;
  readonly expectedFormat: GltfValidatedAccessorReference["expectedFormat"];
  readonly itemSize: number;
  readonly array: GltfDecodedArray;
}

export interface GltfDecodedPrimitiveAccessors {
  readonly meshHandleKey: string;
  readonly meshIndex: number;
  readonly primitiveIndex: number;
  readonly vertexCount: number;
  readonly attributes: readonly GltfDecodedAccessor[];
  readonly indices: GltfDecodedAccessor | null;
}

export interface GltfAccessorDecodingReport {
  readonly valid: boolean;
  readonly primitives: readonly GltfDecodedPrimitiveAccessors[];
  readonly diagnostics: readonly GltfAccessorDecodingDiagnostic[];
}

export interface GltfDecodedAccessorJsonValue extends Omit<
  GltfDecodedAccessor,
  "array" | "sourceView"
> {
  readonly array: {
    readonly type:
      | "Float32Array"
      | "Uint8Array"
      | "Uint16Array"
      | "Uint32Array";
    readonly length: number;
  };
  readonly sourceView?: {
    readonly type: "Uint8Array";
    readonly length: number;
  };
}

export interface GltfDecodedPrimitiveAccessorsJsonValue extends Omit<
  GltfDecodedPrimitiveAccessors,
  "attributes" | "indices"
> {
  readonly attributes: readonly GltfDecodedAccessorJsonValue[];
  readonly indices: GltfDecodedAccessorJsonValue | null;
}

export interface GltfAccessorDecodingReportJsonValue extends Omit<
  GltfAccessorDecodingReport,
  "primitives"
> {
  readonly primitives: readonly GltfDecodedPrimitiveAccessorsJsonValue[];
}

interface DecodeShape {
  readonly sourceItemSize: number;
  readonly outputItemSize: number;
  readonly sourceComponentBytes: 1 | 2 | 4;
  readonly output: "float32" | "uint8" | "uint16" | "uint32";
  readonly paddingComponentValue: number;
}

const ACCESSOR_COMPONENTS = new Map<string, number>([
  ["SCALAR", 1],
  ["VEC2", 2],
  ["VEC3", 3],
  ["VEC4", 4],
]);

const NATIVE_LITTLE_ENDIAN =
  new Uint8Array(new Uint16Array([1]).buffer)[0] === 1;

export function decodeGltfPrimitiveAccessors(
  options: GltfAccessorDecodingOptions,
): GltfAccessorDecodingReport {
  const diagnostics: GltfAccessorDecodingDiagnostic[] = [];
  const primitives: GltfDecodedPrimitiveAccessors[] = [];

  for (const primitive of options.validationReport.primitives) {
    const decoded = decodePrimitive(options, primitive, diagnostics);
    if (decoded !== null) {
      primitives.push(decoded);
    }
  }

  return {
    valid: diagnostics.every((diagnostic) => diagnostic.severity !== "error"),
    primitives,
    diagnostics,
  };
}

export function gltfAccessorDecodingReportToJsonValue(
  report: GltfAccessorDecodingReport,
): GltfAccessorDecodingReportJsonValue {
  return {
    valid: report.valid,
    primitives: report.primitives.map((primitive) => ({
      ...primitive,
      attributes: primitive.attributes.map(decodedAccessorToJsonValue),
      indices:
        primitive.indices === null
          ? null
          : decodedAccessorToJsonValue(primitive.indices),
    })),
    diagnostics: report.diagnostics.map((diagnostic) => ({ ...diagnostic })),
  };
}

export function gltfAccessorDecodingReportToJson(
  report: GltfAccessorDecodingReport,
): string {
  return JSON.stringify(gltfAccessorDecodingReportToJsonValue(report));
}

function decodePrimitive(
  options: GltfAccessorDecodingOptions,
  primitive: GltfPrimitiveAccessorPlan,
  diagnostics: GltfAccessorDecodingDiagnostic[],
): GltfDecodedPrimitiveAccessors | null {
  const diagnosticsBefore = diagnostics.length;
  const attributes: GltfDecodedAccessor[] = [];

  for (const attribute of primitive.attributes) {
    const decoded = decodeAccessor(options, primitive, attribute, diagnostics);
    if (decoded !== null) {
      attributes.push(decoded);
    }
  }

  const indices =
    primitive.indices === null
      ? null
      : decodeAccessor(options, primitive, primitive.indices, diagnostics);
  const hasError = diagnostics
    .slice(diagnosticsBefore)
    .some((diagnostic) => diagnostic.severity === "error");
  if (hasError || attributes.length === 0 || primitive.vertexCount === null) {
    return null;
  }

  return {
    meshHandleKey: primitive.meshHandleKey,
    meshIndex: primitive.meshIndex,
    primitiveIndex: primitive.primitiveIndex,
    vertexCount: primitive.vertexCount,
    attributes,
    indices,
  };
}

function decodeAccessor(
  options: GltfAccessorDecodingOptions,
  primitive: GltfPrimitiveAccessorPlan,
  accessor: GltfValidatedAccessorReference,
  diagnostics: GltfAccessorDecodingDiagnostic[],
): GltfDecodedAccessor | null {
  const source = options.resolveBufferBytes(accessor.bufferIndex);
  const sourceBytes = sourceBytesView(source);
  if (sourceBytes === null) {
    diagnostics.push(
      diagnostic(primitive, accessor, {
        code: "gltfDecode.missingBufferBytes",
        message: `Buffer ${accessor.bufferIndex} bytes were not provided for ${accessor.semantic}.`,
      }),
    );
    return null;
  }

  if (accessor.byteOffset + accessor.byteLength > sourceBytes.byteLength) {
    diagnostics.push(
      diagnostic(primitive, accessor, {
        code: "gltfDecode.sourceRangeOutOfBounds",
        message: `Accessor ${accessor.accessorIndex} source range exceeds resolved buffer ${accessor.bufferIndex}.`,
      }),
    );
    return null;
  }

  const shape = decodeShape(accessor);
  if (shape === null) {
    diagnostics.push(
      diagnostic(primitive, accessor, {
        code: "gltfDecode.unsupportedOutputFormat",
        message: `Accessor ${accessor.accessorIndex} has unsupported output format '${accessor.expectedFormat}'.`,
      }),
    );
    return null;
  }

  const elementByteSize = shape.sourceItemSize * shape.sourceComponentBytes;
  const output =
    decodeTightlyPackedAccessor({
      accessor,
      elementByteSize,
      shape,
      sourceBytes,
      storageMode: options.storageMode ?? "compact-copy",
    }) ?? decodeStridedAccessor(sourceBytes, accessor, shape);
  const sourceBinding = createDirectSourceBinding({
    accessor,
    elementByteSize,
    shape,
    sourceBytes,
    storageMode: options.storageMode ?? "compact-copy",
  });

  return {
    semantic: accessor.semantic,
    accessorIndex: accessor.accessorIndex,
    bufferIndex: accessor.bufferIndex,
    sourceByteOffset: accessor.byteOffset,
    sourceByteLength:
      accessor.count === 0
        ? 0
        : (accessor.count - 1) * accessor.byteStride + elementByteSize,
    ...(sourceBinding === null ? {} : sourceBinding),
    expectedFormat: accessor.expectedFormat,
    itemSize: shape.outputItemSize,
    array: output,
  };
}

function createDirectSourceBinding(input: {
  readonly accessor: GltfValidatedAccessorReference;
  readonly elementByteSize: number;
  readonly shape: DecodeShape;
  readonly sourceBytes: Uint8Array;
  readonly storageMode: NonNullable<GltfAccessorDecodingOptions["storageMode"]>;
}): Pick<
  GltfDecodedAccessor,
  | "sourceBufferViewIndex"
  | "sourceView"
  | "sourceViewByteOffset"
  | "sourceByteStride"
  | "sourceElementByteSize"
> | null {
  if (
    input.storageMode !== "source-view" ||
    !NATIVE_LITTLE_ENDIAN ||
    input.shape.sourceItemSize !== input.shape.outputItemSize ||
    input.accessor.expectedFormat === "uint8-to-uint16"
  ) {
    return null;
  }

  return {
    sourceBufferViewIndex: input.accessor.bufferViewIndex,
    sourceView: new Uint8Array(
      input.sourceBytes.buffer,
      input.sourceBytes.byteOffset + input.accessor.bufferViewByteOffset,
      input.accessor.bufferViewByteLength,
    ),
    sourceViewByteOffset:
      input.accessor.byteOffset - input.accessor.bufferViewByteOffset,
    sourceByteStride: input.accessor.byteStride,
    sourceElementByteSize: input.elementByteSize,
  };
}

function decodeTightlyPackedAccessor(input: {
  readonly accessor: GltfValidatedAccessorReference;
  readonly elementByteSize: number;
  readonly shape: DecodeShape;
  readonly sourceBytes: Uint8Array;
  readonly storageMode: NonNullable<GltfAccessorDecodingOptions["storageMode"]>;
}): GltfDecodedArray | null {
  if (
    !NATIVE_LITTLE_ENDIAN ||
    input.accessor.byteStride !== input.elementByteSize ||
    input.shape.sourceItemSize !== input.shape.outputItemSize ||
    input.accessor.expectedFormat === "uint8-to-uint16"
  ) {
    return null;
  }

  const length = input.accessor.count * input.shape.outputItemSize;
  const byteLength = length * outputComponentBytes(input.shape);
  const sourceByteOffset =
    input.sourceBytes.byteOffset + input.accessor.byteOffset;

  if (input.storageMode === "source-view") {
    if (sourceByteOffset % outputComponentBytes(input.shape) !== 0) {
      return null;
    }

    return createOutputArrayView(
      input.shape,
      input.sourceBytes.buffer,
      sourceByteOffset,
      length,
    );
  }

  const compact = input.sourceBytes
    .subarray(input.accessor.byteOffset, input.accessor.byteOffset + byteLength)
    .slice();

  return createOutputArrayView(
    input.shape,
    compact.buffer,
    compact.byteOffset,
    length,
  );
}

function decodeStridedAccessor(
  sourceBytes: Uint8Array,
  accessor: GltfValidatedAccessorReference,
  shape: DecodeShape,
): GltfDecodedArray {
  const output = createOutputArray(
    shape,
    accessor.count * shape.outputItemSize,
  );
  const view = new DataView(
    sourceBytes.buffer,
    sourceBytes.byteOffset,
    sourceBytes.byteLength,
  );

  for (let element = 0; element < accessor.count; element += 1) {
    const elementOffset = accessor.byteOffset + element * accessor.byteStride;
    for (let component = 0; component < shape.outputItemSize; component += 1) {
      output[element * shape.outputItemSize + component] =
        component < shape.sourceItemSize
          ? readComponent(
              view,
              elementOffset + component * shape.sourceComponentBytes,
              accessor.expectedFormat,
            )
          : shape.paddingComponentValue;
    }
  }

  return output;
}

function decodedAccessorToJsonValue(
  accessor: GltfDecodedAccessor,
): GltfDecodedAccessorJsonValue {
  const { array, sourceView, ...metadata } = accessor;

  return {
    ...metadata,
    array: {
      type: array.constructor.name as
        | "Float32Array"
        | "Uint8Array"
        | "Uint16Array"
        | "Uint32Array",
      length: array.length,
    },
    ...(sourceView === undefined
      ? {}
      : {
          sourceView: {
            type: "Uint8Array" as const,
            length: sourceView.length,
          },
        }),
  };
}

function sourceBytesView(
  source: ArrayBuffer | ArrayBufferView | null | undefined,
): Uint8Array | null {
  if (source === null || source === undefined) {
    return null;
  }

  return source instanceof ArrayBuffer
    ? new Uint8Array(source)
    : new Uint8Array(source.buffer, source.byteOffset, source.byteLength);
}

function decodeShape(
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

function createOutputArray(
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

function createOutputArrayView(
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

function outputComponentBytes(shape: DecodeShape): 1 | 2 | 4 {
  return shape.output === "uint8" ? 1 : shape.output === "uint16" ? 2 : 4;
}

function readComponent(
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

function diagnostic(
  primitive: GltfPrimitiveAccessorPlan,
  accessor: GltfValidatedAccessorReference,
  input: Pick<GltfAccessorDecodingDiagnostic, "code" | "message">,
): GltfAccessorDecodingDiagnostic {
  return {
    code: input.code,
    severity: "error",
    message: input.message,
    meshHandleKey: primitive.meshHandleKey,
    meshIndex: primitive.meshIndex,
    primitiveIndex: primitive.primitiveIndex,
    semantic: accessor.semantic,
    accessorIndex: accessor.accessorIndex,
    bufferIndex: accessor.bufferIndex,
    byteOffset: accessor.byteOffset,
    byteLength: accessor.byteLength,
    expectedFormat: accessor.expectedFormat,
    arrayType: arrayTypeForExpectedFormat(accessor.expectedFormat),
  };
}

function arrayTypeForExpectedFormat(
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
