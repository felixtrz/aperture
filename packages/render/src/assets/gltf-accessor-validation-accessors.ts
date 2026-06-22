import type { GltfPlannedMeshPrimitiveAsset } from "./gltf-mesh-primitive.js";
import { validateBufferView } from "./gltf-accessor-validation-buffers.js";
import { pushAccessorValidationDiagnostic } from "./gltf-accessor-validation-diagnostics.js";
import {
  expectationForSemantic,
  hasUnsupportedQuantizedComponentType,
} from "./gltf-accessor-validation-expectations.js";
import type {
  GltfAccessorValidationContext,
  GltfAccessorValidationInput,
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

export function validateGltfAccessorReference(
  context: GltfAccessorValidationContext,
  primitive: GltfPlannedMeshPrimitiveAsset,
  input: GltfAccessorValidationInput,
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
    const unsupportedQuantizedComponentType =
      hasUnsupportedQuantizedComponentType(input.semantic, accessor);
    pushAccessorValidationDiagnostic(context, primitive, input, {
      code: unsupportedQuantizedComponentType
        ? "gltfAccessor.unsupportedQuantizedComponentType"
        : "gltfAccessor.unsupportedSemanticFormat",
      field: `accessors[${input.accessorIndex}]`,
      value: toDiagnosticValue(
        unsupportedQuantizedComponentType
          ? accessor.componentType
          : accessor.type,
      ),
      message: unsupportedQuantizedComponentType
        ? `Accessor ${input.accessorIndex} uses an unsupported normalized quantized component type for ${input.semantic}.`
        : `Accessor ${input.accessorIndex} has an unsupported format for ${input.semantic}.`,
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
