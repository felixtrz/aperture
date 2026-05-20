import type {
  GltfMeshPrimitiveAttributeReference,
  GltfMeshPrimitiveAttributeSemantic,
  GltfMeshPrimitiveIndexReference,
  GltfMeshPrimitiveMappingReport,
  GltfPlannedMeshPrimitiveAsset,
} from "./gltf-mesh-primitive.js";

export type GltfAccessorValidationDiagnosticSeverity = "error" | "warning";

export type GltfAccessorSemantic =
  | GltfMeshPrimitiveAttributeSemantic
  | "INDICES";

export interface GltfAccessorValidationDiagnostic {
  readonly code: string;
  readonly severity: GltfAccessorValidationDiagnosticSeverity;
  readonly message: string;
  readonly meshHandleKey?: string;
  readonly meshIndex?: number;
  readonly primitiveIndex?: number;
  readonly semantic?: GltfAccessorSemantic;
  readonly accessorIndex?: number;
  readonly bufferViewIndex?: number;
  readonly bufferIndex?: number;
  readonly field?: string;
  readonly value?: string | number | boolean | null;
  readonly byteOffset?: number;
  readonly byteLength?: number;
  readonly requiredByteLength?: number;
}

export interface GltfAccessorValidationOptions {
  readonly root: unknown;
  readonly primitiveReport: GltfMeshPrimitiveMappingReport;
  readonly binaryChunkByteLength?: number;
  readonly externalBufferByteLengths?: ReadonlyMap<number, number>;
}

export interface GltfValidatedAccessorReference {
  readonly semantic: GltfAccessorSemantic;
  readonly accessorIndex: number;
  readonly bufferViewIndex: number;
  readonly bufferIndex: number;
  readonly byteOffset: number;
  readonly byteLength: number;
  readonly componentType: number;
  readonly accessorType: string;
  readonly count: number;
  readonly byteStride: number;
  readonly normalized: boolean;
  readonly expectedFormat:
    | "float32x2"
    | "float32x3"
    | "float32x4"
    | "uint8-to-uint16"
    | "uint16"
    | "uint32";
}

export interface GltfPrimitiveAccessorPlan {
  readonly meshHandleKey: string;
  readonly meshIndex: number;
  readonly primitiveIndex: number;
  readonly vertexCount: number | null;
  readonly attributes: readonly GltfValidatedAccessorReference[];
  readonly indices: GltfValidatedAccessorReference | null;
}

export interface GltfAccessorValidationReport {
  readonly valid: boolean;
  readonly primitives: readonly GltfPrimitiveAccessorPlan[];
  readonly diagnostics: readonly GltfAccessorValidationDiagnostic[];
}

export type GltfAccessorValidationReportJsonValue =
  GltfAccessorValidationReport;

interface ValidationContext {
  readonly root: Record<string, unknown>;
  readonly options: GltfAccessorValidationOptions;
  readonly diagnostics: GltfAccessorValidationDiagnostic[];
}

interface AccessorExpectation {
  readonly type: string;
  readonly componentTypes: readonly number[];
  readonly expectedFormat: GltfValidatedAccessorReference["expectedFormat"];
}

const GLTF_COMPONENT_UNSIGNED_BYTE = 5121;
const GLTF_COMPONENT_UNSIGNED_SHORT = 5123;
const GLTF_COMPONENT_UNSIGNED_INT = 5125;
const GLTF_COMPONENT_FLOAT = 5126;

const COMPONENT_BYTE_SIZE = new Map<number, number>([
  [5120, 1],
  [GLTF_COMPONENT_UNSIGNED_BYTE, 1],
  [5122, 2],
  [GLTF_COMPONENT_UNSIGNED_SHORT, 2],
  [5124, 4],
  [GLTF_COMPONENT_UNSIGNED_INT, 4],
  [GLTF_COMPONENT_FLOAT, 4],
]);

const ACCESSOR_COMPONENTS = new Map<string, number>([
  ["SCALAR", 1],
  ["VEC2", 2],
  ["VEC3", 3],
  ["VEC4", 4],
  ["MAT2", 4],
  ["MAT3", 9],
  ["MAT4", 16],
]);

export function validateGltfPrimitiveAccessorReferences(
  options: GltfAccessorValidationOptions,
): GltfAccessorValidationReport {
  const diagnostics: GltfAccessorValidationDiagnostic[] = [];
  if (!isRecord(options.root)) {
    diagnostics.push({
      code: "gltfAccessor.malformedAccessors",
      severity: "error",
      field: "root",
      value: toDiagnosticValue(options.root),
      message: "glTF root must be an object for accessor validation.",
    });
    return result({ diagnostics, primitives: [] });
  }

  const context: ValidationContext = {
    root: options.root,
    options,
    diagnostics,
  };
  validateRootArrays(context);

  const primitives: GltfPrimitiveAccessorPlan[] = [];
  for (const primitive of options.primitiveReport.meshes) {
    const planned = validatePrimitive(context, primitive);
    if (planned !== null) {
      primitives.push(planned);
    }
  }

  return result({ diagnostics, primitives });
}

export function gltfAccessorValidationReportToJsonValue(
  report: GltfAccessorValidationReport,
): GltfAccessorValidationReportJsonValue {
  return {
    valid: report.valid,
    primitives: report.primitives.map((primitive) => ({
      ...primitive,
      attributes: primitive.attributes.map((attribute) => ({ ...attribute })),
      indices: primitive.indices === null ? null : { ...primitive.indices },
    })),
    diagnostics: report.diagnostics.map((diagnostic) => ({ ...diagnostic })),
  };
}

export function gltfAccessorValidationReportToJson(
  report: GltfAccessorValidationReport,
): string {
  return JSON.stringify(gltfAccessorValidationReportToJsonValue(report));
}

function validateRootArrays(context: ValidationContext): void {
  for (const field of ["buffers", "bufferViews", "accessors"] as const) {
    if (!Array.isArray(context.root[field])) {
      context.diagnostics.push({
        code:
          field === "buffers"
            ? "gltfAccessor.malformedBuffers"
            : field === "bufferViews"
              ? "gltfAccessor.malformedBufferViews"
              : "gltfAccessor.malformedAccessors",
        severity: "error",
        field,
        value: toDiagnosticValue(context.root[field]),
        message: `glTF ${field} must be an array for accessor validation.`,
      });
    }
  }
}

function validatePrimitive(
  context: ValidationContext,
  primitive: GltfPlannedMeshPrimitiveAsset,
): GltfPrimitiveAccessorPlan | null {
  const diagnosticsBefore = context.diagnostics.length;
  const attributes: GltfValidatedAccessorReference[] = [];

  appendAttribute(
    context,
    primitive,
    primitive.attributes.position,
    attributes,
  );
  appendOptionalAttribute(
    context,
    primitive,
    primitive.attributes.normal,
    attributes,
  );
  appendOptionalAttribute(
    context,
    primitive,
    primitive.attributes.texcoord0,
    attributes,
  );
  appendOptionalAttribute(
    context,
    primitive,
    primitive.attributes.tangent,
    attributes,
  );
  appendOptionalAttribute(
    context,
    primitive,
    primitive.attributes.texcoord1,
    attributes,
  );
  appendOptionalAttribute(
    context,
    primitive,
    primitive.attributes.color0,
    attributes,
  );
  const indices = validateIndexReference(context, primitive, primitive.indices);

  const hasNewError = context.diagnostics
    .slice(diagnosticsBefore)
    .some((diagnostic) => diagnostic.severity === "error");
  if (hasNewError) {
    return null;
  }

  if (!attributes.some((attribute) => attribute.semantic === "POSITION")) {
    return null;
  }

  return {
    meshHandleKey: primitive.registeredHandleKey,
    meshIndex: primitive.meshIndex,
    primitiveIndex: primitive.primitiveIndex,
    vertexCount: attributes[0]?.count ?? null,
    attributes,
    indices,
  };
}

function appendAttribute(
  context: ValidationContext,
  primitive: GltfPlannedMeshPrimitiveAsset,
  attribute: GltfMeshPrimitiveAttributeReference,
  output: GltfValidatedAccessorReference[],
): void {
  const validated = validateAccessorReference(context, primitive, {
    semantic: attribute.semantic,
    accessorIndex: attribute.accessorIndex,
  });
  if (validated !== null) {
    output.push(validated);
  }
}

function appendOptionalAttribute(
  context: ValidationContext,
  primitive: GltfPlannedMeshPrimitiveAsset,
  attribute: GltfMeshPrimitiveAttributeReference | undefined,
  output: GltfValidatedAccessorReference[],
): void {
  if (attribute === undefined) {
    return;
  }

  appendAttribute(context, primitive, attribute, output);
}

function validateIndexReference(
  context: ValidationContext,
  primitive: GltfPlannedMeshPrimitiveAsset,
  indices: GltfMeshPrimitiveIndexReference | null,
): GltfValidatedAccessorReference | null {
  if (indices === null) {
    return null;
  }

  return validateAccessorReference(context, primitive, {
    semantic: "INDICES",
    accessorIndex: indices.accessorIndex,
  });
}

function validateAccessorReference(
  context: ValidationContext,
  primitive: GltfPlannedMeshPrimitiveAsset,
  input: {
    readonly semantic: GltfAccessorSemantic;
    readonly accessorIndex: number;
  },
): GltfValidatedAccessorReference | null {
  const accessors = arrayField(context.root, "accessors");
  const accessor = accessors?.[input.accessorIndex];
  if (!isRecord(accessor)) {
    pushDiagnostic(context, primitive, input, {
      code: "gltfAccessor.invalidAccessor",
      field: `accessors[${input.accessorIndex}]`,
      value: toDiagnosticValue(accessor),
      message: `Accessor ${input.accessorIndex} for ${input.semantic} is missing or malformed.`,
    });
    return null;
  }

  if (accessor.sparse !== undefined) {
    pushDiagnostic(context, primitive, input, {
      code: "gltfAccessor.sparseAccessorDeferred",
      severity: "warning",
      field: `accessors[${input.accessorIndex}].sparse`,
      message: `Accessor ${input.accessorIndex} for ${input.semantic} uses sparse data, which is deferred by this validator.`,
    });
    return null;
  }

  const expectation = expectationForSemantic(input.semantic, accessor);
  if (expectation === null) {
    pushDiagnostic(context, primitive, input, {
      code: "gltfAccessor.unsupportedSemanticFormat",
      field: `accessors[${input.accessorIndex}]`,
      value: toDiagnosticValue(accessor.type),
      message: `Accessor ${input.accessorIndex} has an unsupported format for ${input.semantic}.`,
    });
    return null;
  }

  const count = integerField(accessor.count);
  const byteOffset = integerField(accessor.byteOffset ?? 0);
  const bufferViewIndex = integerField(accessor.bufferView);
  if (count === null || count < 0 || byteOffset === null || byteOffset < 0) {
    pushDiagnostic(context, primitive, input, {
      code: "gltfAccessor.invalidAccessor",
      field: `accessors[${input.accessorIndex}]`,
      message: `Accessor ${input.accessorIndex} has invalid count or byteOffset fields.`,
    });
    return null;
  }

  if (bufferViewIndex === null) {
    pushDiagnostic(context, primitive, input, {
      code: "gltfAccessor.zeroFillAccessorDeferred",
      severity: "warning",
      field: `accessors[${input.accessorIndex}].bufferView`,
      message: `Accessor ${input.accessorIndex} has no bufferView; zero-filled accessors are deferred for renderable mesh data.`,
    });
    return null;
  }

  const bufferView = validateBufferView(
    context,
    primitive,
    input,
    bufferViewIndex,
  );
  if (bufferView === null) {
    return null;
  }

  const componentType = integerField(accessor.componentType);
  const accessorType = typeof accessor.type === "string" ? accessor.type : null;
  const componentByteSize =
    componentType === null ? undefined : COMPONENT_BYTE_SIZE.get(componentType);
  const componentCount =
    accessorType === null ? undefined : ACCESSOR_COMPONENTS.get(accessorType);
  if (
    componentType === null ||
    accessorType === null ||
    componentByteSize === undefined ||
    componentCount === undefined
  ) {
    pushDiagnostic(context, primitive, input, {
      code:
        componentByteSize === undefined
          ? "gltfAccessor.unsupportedComponentType"
          : "gltfAccessor.unsupportedAccessorType",
      field: `accessors[${input.accessorIndex}]`,
      value: toDiagnosticValue(
        componentByteSize === undefined ? accessor.componentType : accessorType,
      ),
      message: `Accessor ${input.accessorIndex} uses unsupported component or accessor type metadata.`,
    });
    return null;
  }

  const elementByteSize = componentByteSize * componentCount;
  const byteStride =
    bufferView.byteStride === null ? elementByteSize : bufferView.byteStride;
  if (byteStride < elementByteSize) {
    pushDiagnostic(context, primitive, input, {
      code: "gltfAccessor.invalidByteStride",
      bufferViewIndex,
      byteLength: byteStride,
      requiredByteLength: elementByteSize,
      field: `bufferViews[${bufferViewIndex}].byteStride`,
      message: `bufferView ${bufferViewIndex} byteStride is smaller than the ${input.semantic} accessor element size.`,
    });
    return null;
  }

  const requiredByteLength =
    count === 0 ? 0 : byteOffset + (count - 1) * byteStride + elementByteSize;
  if (requiredByteLength > bufferView.byteLength) {
    pushDiagnostic(context, primitive, input, {
      code: "gltfAccessor.accessorRangeOutOfBounds",
      bufferViewIndex,
      bufferIndex: bufferView.bufferIndex,
      byteOffset,
      byteLength: bufferView.byteLength,
      requiredByteLength,
      field: `accessors[${input.accessorIndex}]`,
      message: `Accessor ${input.accessorIndex} byte range exceeds bufferView ${bufferViewIndex}.`,
    });
    return null;
  }

  return {
    semantic: input.semantic,
    accessorIndex: input.accessorIndex,
    bufferViewIndex,
    bufferIndex: bufferView.bufferIndex,
    byteOffset: bufferView.byteOffset + byteOffset,
    byteLength: requiredByteLength,
    componentType,
    accessorType,
    count,
    byteStride,
    normalized: accessor.normalized === true,
    expectedFormat: expectation.expectedFormat,
  };
}

function validateBufferView(
  context: ValidationContext,
  primitive: GltfPlannedMeshPrimitiveAsset,
  input: {
    readonly semantic: GltfAccessorSemantic;
    readonly accessorIndex: number;
  },
  bufferViewIndex: number,
): {
  readonly bufferIndex: number;
  readonly byteOffset: number;
  readonly byteLength: number;
  readonly byteStride: number | null;
} | null {
  const bufferViews = arrayField(context.root, "bufferViews");
  const bufferView = bufferViews?.[bufferViewIndex];
  if (!isRecord(bufferView)) {
    pushDiagnostic(context, primitive, input, {
      code: "gltfAccessor.invalidBufferView",
      bufferViewIndex,
      field: `bufferViews[${bufferViewIndex}]`,
      value: toDiagnosticValue(bufferView),
      message: `bufferView ${bufferViewIndex} is missing or malformed.`,
    });
    return null;
  }

  const bufferIndex = integerField(bufferView.buffer);
  const byteOffset = integerField(bufferView.byteOffset ?? 0);
  const byteLength = integerField(bufferView.byteLength);
  const byteStride =
    bufferView.byteStride === undefined
      ? null
      : integerField(bufferView.byteStride);
  if (
    bufferIndex === null ||
    byteOffset === null ||
    byteLength === null ||
    byteOffset < 0 ||
    byteLength < 0 ||
    (byteStride !== null && byteStride <= 0)
  ) {
    pushDiagnostic(context, primitive, input, {
      code: "gltfAccessor.invalidBufferView",
      bufferViewIndex,
      field: `bufferViews[${bufferViewIndex}]`,
      message: `bufferView ${bufferViewIndex} has invalid buffer, byteOffset, byteLength, or byteStride fields.`,
    });
    return null;
  }

  const bufferByteLength = validateBuffer(
    context,
    primitive,
    input,
    bufferIndex,
  );
  if (bufferByteLength === null) {
    return null;
  }

  if (byteOffset + byteLength > bufferByteLength) {
    pushDiagnostic(context, primitive, input, {
      code: "gltfAccessor.bufferRangeOutOfBounds",
      bufferViewIndex,
      bufferIndex,
      byteOffset,
      byteLength,
      requiredByteLength: byteOffset + byteLength,
      field: `bufferViews[${bufferViewIndex}]`,
      message: `bufferView ${bufferViewIndex} byte range exceeds buffer ${bufferIndex}.`,
    });
    return null;
  }

  return { bufferIndex, byteOffset, byteLength, byteStride };
}

function validateBuffer(
  context: ValidationContext,
  primitive: GltfPlannedMeshPrimitiveAsset,
  input: {
    readonly semantic: GltfAccessorSemantic;
    readonly accessorIndex: number;
  },
  bufferIndex: number,
): number | null {
  const buffers = arrayField(context.root, "buffers");
  const buffer = buffers?.[bufferIndex];
  if (!isRecord(buffer)) {
    pushDiagnostic(context, primitive, input, {
      code: "gltfAccessor.invalidBuffer",
      bufferIndex,
      field: `buffers[${bufferIndex}]`,
      value: toDiagnosticValue(buffer),
      message: `buffer ${bufferIndex} is missing or malformed.`,
    });
    return null;
  }

  const declaredByteLength = integerField(buffer.byteLength);
  if (declaredByteLength === null || declaredByteLength < 0) {
    pushDiagnostic(context, primitive, input, {
      code: "gltfAccessor.invalidBuffer",
      bufferIndex,
      field: `buffers[${bufferIndex}].byteLength`,
      value: toDiagnosticValue(buffer.byteLength),
      message: `buffer ${bufferIndex} has an invalid byteLength.`,
    });
    return null;
  }

  if (
    typeof buffer.uri === "string" &&
    !context.options.externalBufferByteLengths?.has(bufferIndex)
  ) {
    pushDiagnostic(context, primitive, input, {
      code: "gltfAccessor.externalBufferUnresolved",
      severity: "warning",
      bufferIndex,
      field: `buffers[${bufferIndex}].uri`,
      message: `buffer ${bufferIndex} is external and has no caller-provided resolved byte length.`,
    });
  }

  const externalLength =
    context.options.externalBufferByteLengths?.get(bufferIndex);
  const binaryLength =
    typeof buffer.uri === "string"
      ? undefined
      : context.options.binaryChunkByteLength;
  return Math.min(
    declaredByteLength,
    externalLength ?? binaryLength ?? declaredByteLength,
  );
}

function expectationForSemantic(
  semantic: GltfAccessorSemantic,
  accessor: Record<string, unknown>,
): AccessorExpectation | null {
  switch (semantic) {
    case "POSITION":
    case "NORMAL":
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
    case "COLOR_0":
      return accessor.type === "VEC4" &&
        accessor.componentType === GLTF_COMPONENT_FLOAT
        ? {
            type: "VEC4",
            componentTypes: [GLTF_COMPONENT_FLOAT],
            expectedFormat: "float32x4",
          }
        : null;
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

function pushDiagnostic(
  context: ValidationContext,
  primitive: GltfPlannedMeshPrimitiveAsset,
  input: {
    readonly semantic: GltfAccessorSemantic;
    readonly accessorIndex: number;
  },
  diagnostic: Omit<
    GltfAccessorValidationDiagnostic,
    | "severity"
    | "meshHandleKey"
    | "meshIndex"
    | "primitiveIndex"
    | "semantic"
    | "accessorIndex"
  > & {
    readonly severity?: GltfAccessorValidationDiagnosticSeverity;
  },
): void {
  context.diagnostics.push({
    severity: diagnostic.severity ?? "error",
    meshHandleKey: primitive.registeredHandleKey,
    meshIndex: primitive.meshIndex,
    primitiveIndex: primitive.primitiveIndex,
    semantic: input.semantic,
    accessorIndex: input.accessorIndex,
    ...diagnostic,
  });
}

function result(input: {
  readonly diagnostics: readonly GltfAccessorValidationDiagnostic[];
  readonly primitives: readonly GltfPrimitiveAccessorPlan[];
}): GltfAccessorValidationReport {
  return {
    valid: input.diagnostics.every(
      (diagnostic) => diagnostic.severity !== "error",
    ),
    primitives: input.primitives,
    diagnostics: input.diagnostics,
  };
}

function arrayField(
  root: Record<string, unknown>,
  field: "accessors" | "bufferViews" | "buffers",
): readonly unknown[] | null {
  const value = root[field];
  return Array.isArray(value) ? value : null;
}

function integerField(value: unknown): number | null {
  return Number.isInteger(value) && typeof value === "number" ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toDiagnosticValue(value: unknown): string | number | boolean | null {
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
