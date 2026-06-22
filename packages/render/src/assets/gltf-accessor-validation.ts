import { validateGltfPrimitiveAccessorPlan } from "./gltf-accessor-validation-primitives.js";
import type {
  GltfAccessorValidationContext as ValidationContext,
  GltfAccessorValidationDiagnostic,
  GltfAccessorValidationOptions,
  GltfAccessorValidationReport,
  GltfAccessorValidationReportJsonValue,
  GltfPrimitiveAccessorPlan,
} from "./gltf-accessor-validation-types.js";
import {
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
    const planned = validateGltfPrimitiveAccessorPlan(context, primitive);
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
