import type {
  GltfPrimitiveAccessorPlan,
  GltfValidatedAccessorReference,
} from "./gltf-accessor-validation.js";
import { arrayTypeForExpectedFormat } from "./gltf-accessor-decoding-shape.js";
import type {
  GltfAccessorDecodingDiagnostic,
  GltfAccessorDecodingReport,
  GltfAccessorDecodingReportJsonValue,
  GltfDecodedAccessor,
  GltfDecodedAccessorJsonValue,
} from "./gltf-accessor-decoding-types.js";

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

export function accessorDecodingDiagnostic(
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
