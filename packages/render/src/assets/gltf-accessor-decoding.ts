import type {
  GltfAccessorSemantic,
  GltfAccessorValidationReport,
  GltfPrimitiveAccessorPlan,
  GltfValidatedAccessorReference,
} from "./gltf-accessor-validation.js";

export type GltfDecodedArray = Float32Array | Uint16Array | Uint32Array;

export interface GltfAccessorDecodingDiagnostic {
  readonly code: string;
  readonly severity: "error" | "warning";
  readonly message: string;
  readonly meshHandleKey?: string;
  readonly meshIndex?: number;
  readonly primitiveIndex?: number;
  readonly semantic?: GltfAccessorSemantic;
  readonly accessorIndex?: number;
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
}

export interface GltfDecodedAccessor {
  readonly semantic: GltfAccessorSemantic;
  readonly accessorIndex: number;
  readonly bufferIndex: number;
  readonly sourceByteOffset: number;
  readonly sourceByteLength: number;
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
  "array"
> {
  readonly array: {
    readonly type: "Float32Array" | "Uint16Array" | "Uint32Array";
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
  readonly itemSize: number;
  readonly sourceComponentBytes: 1 | 2 | 4;
  readonly output: "float32" | "uint16" | "uint32";
}

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

  const output = createOutputArray(shape, accessor.count * shape.itemSize);
  const view = new DataView(
    sourceBytes.buffer,
    sourceBytes.byteOffset,
    sourceBytes.byteLength,
  );
  const elementByteSize = shape.itemSize * shape.sourceComponentBytes;
  for (let element = 0; element < accessor.count; element += 1) {
    const elementOffset = accessor.byteOffset + element * accessor.byteStride;
    for (let component = 0; component < shape.itemSize; component += 1) {
      const sourceOffset =
        elementOffset + component * shape.sourceComponentBytes;
      output[element * shape.itemSize + component] = readComponent(
        view,
        sourceOffset,
        accessor.expectedFormat,
      );
    }
  }

  return {
    semantic: accessor.semantic,
    accessorIndex: accessor.accessorIndex,
    bufferIndex: accessor.bufferIndex,
    sourceByteOffset: accessor.byteOffset,
    sourceByteLength:
      accessor.count === 0
        ? 0
        : (accessor.count - 1) * accessor.byteStride + elementByteSize,
    expectedFormat: accessor.expectedFormat,
    itemSize: shape.itemSize,
    array: output,
  };
}

function decodedAccessorToJsonValue(
  accessor: GltfDecodedAccessor,
): GltfDecodedAccessorJsonValue {
  return {
    ...accessor,
    array: {
      type: accessor.array.constructor.name as
        | "Float32Array"
        | "Uint16Array"
        | "Uint32Array",
      length: accessor.array.length,
    },
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
  switch (accessor.expectedFormat) {
    case "float32x2":
      return { itemSize: 2, sourceComponentBytes: 4, output: "float32" };
    case "float32x3":
      return { itemSize: 3, sourceComponentBytes: 4, output: "float32" };
    case "float32x4":
      return { itemSize: 4, sourceComponentBytes: 4, output: "float32" };
    case "uint8-to-uint16":
      return { itemSize: 1, sourceComponentBytes: 1, output: "uint16" };
    case "uint16":
      return { itemSize: 1, sourceComponentBytes: 2, output: "uint16" };
    case "uint32":
      return { itemSize: 1, sourceComponentBytes: 4, output: "uint32" };
  }
}

function createOutputArray(
  shape: DecodeShape,
  length: number,
): GltfDecodedArray {
  switch (shape.output) {
    case "float32":
      return new Float32Array(length);
    case "uint16":
      return new Uint16Array(length);
    case "uint32":
      return new Uint32Array(length);
  }
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
    case "uint8-to-uint16":
      return view.getUint8(byteOffset);
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
    case "uint8-to-uint16":
    case "uint16":
      return "Uint16Array";
    case "uint32":
      return "Uint32Array";
  }
}
