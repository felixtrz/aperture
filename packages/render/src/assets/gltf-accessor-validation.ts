import type {
  GltfMeshPrimitiveAttributeReference,
  GltfMeshPrimitiveIndexReference,
  GltfPlannedMeshPrimitiveAsset,
} from "./gltf-mesh-primitive.js";
import { validateBufferView } from "./gltf-accessor-validation-buffers.js";
import { pushAccessorValidationDiagnostic } from "./gltf-accessor-validation-diagnostics.js";
import { expectationForSemantic } from "./gltf-accessor-validation-expectations.js";
import type {
  GltfAccessorSemantic,
  GltfAccessorValidationContext as ValidationContext,
  GltfAccessorValidationDiagnostic,
  GltfAccessorValidationOptions,
  GltfAccessorValidationReport,
  GltfAccessorValidationReportJsonValue,
  GltfPrimitiveAccessorPlan,
  GltfValidatedAccessorReference,
} from "./gltf-accessor-validation-types.js";
import {
  ACCESSOR_COMPONENTS,
  COMPONENT_BYTE_SIZE,
  arrayField,
  integerField,
  isRecord,
  toDiagnosticValue,
} from "./gltf-accessor-validation-utils.js";

export type {
  GltfAccessorSemantic,
  GltfAccessorValidationDiagnostic,
  GltfAccessorValidationDiagnosticSeverity,
  GltfAccessorValidationOptions,
  GltfAccessorValidationReport,
  GltfAccessorValidationReportJsonValue,
  GltfPrimitiveAccessorPlan,
  GltfValidatedAccessorReference,
} from "./gltf-accessor-validation-types.js";

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
  if (primitive.compression !== null) {
    return null;
  }

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
    primitive.attributes.joints0,
    attributes,
  );
  appendOptionalAttribute(
    context,
    primitive,
    primitive.attributes.weights0,
    attributes,
  );
  appendOptionalAttribute(
    context,
    primitive,
    primitive.attributes.morphPosition0,
    attributes,
  );
  appendOptionalAttribute(
    context,
    primitive,
    primitive.attributes.morphNormal0,
    attributes,
  );
  appendOptionalAttribute(
    context,
    primitive,
    primitive.attributes.morphPosition1,
    attributes,
  );
  appendOptionalAttribute(
    context,
    primitive,
    primitive.attributes.morphNormal1,
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
    pushAccessorValidationDiagnostic(context, primitive, input, {
      code: "gltfAccessor.invalidAccessor",
      field: `accessors[${input.accessorIndex}]`,
      value: toDiagnosticValue(accessor),
      message: `Accessor ${input.accessorIndex} for ${input.semantic} is missing or malformed.`,
    });
    return null;
  }

  if (accessor.sparse !== undefined) {
    pushAccessorValidationDiagnostic(context, primitive, input, {
      code: "gltfAccessor.sparseAccessorDeferred",
      severity: "warning",
      field: `accessors[${input.accessorIndex}].sparse`,
      message: `Accessor ${input.accessorIndex} for ${input.semantic} uses sparse data, which is deferred by this validator.`,
    });
    return null;
  }

  const expectation = expectationForSemantic(input.semantic, accessor);
  if (expectation === null) {
    pushAccessorValidationDiagnostic(context, primitive, input, {
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
    pushAccessorValidationDiagnostic(context, primitive, input, {
      code: "gltfAccessor.invalidAccessor",
      field: `accessors[${input.accessorIndex}]`,
      message: `Accessor ${input.accessorIndex} has invalid count or byteOffset fields.`,
    });
    return null;
  }

  if (bufferViewIndex === null) {
    pushAccessorValidationDiagnostic(context, primitive, input, {
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
    pushAccessorValidationDiagnostic(context, primitive, input, {
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
    pushAccessorValidationDiagnostic(context, primitive, input, {
      code: "gltfAccessor.invalidByteStride",
      bufferViewIndex,
      byteLength: byteStride,
      requiredByteLength: elementByteSize,
      field: `bufferViews[${bufferViewIndex}].byteStride`,
      message: `bufferView ${bufferViewIndex} byteStride is smaller than the ${input.semantic} accessor element size.`,
    });
    return null;
  }

  const sourceByteLength =
    count === 0 ? 0 : (count - 1) * byteStride + elementByteSize;
  const requiredByteLength = byteOffset + sourceByteLength;
  if (requiredByteLength > bufferView.byteLength) {
    pushAccessorValidationDiagnostic(context, primitive, input, {
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
    bufferViewByteOffset: bufferView.byteOffset,
    bufferViewByteLength: bufferView.byteLength,
    byteOffset: bufferView.byteOffset + byteOffset,
    byteLength: sourceByteLength,
    componentType,
    accessorType,
    count,
    byteStride,
    normalized: accessor.normalized === true,
    expectedFormat: expectation.expectedFormat,
  };
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
