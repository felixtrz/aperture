import { validateGltfPrimitiveAccessorPlan } from "./gltf-accessor-validation-primitives.js";
import { isRecord, toDiagnosticValue, } from "./gltf-accessor-validation-utils.js";
export function validateGltfPrimitiveAccessorReferences(options) {
    const diagnostics = [];
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
    const context = {
        root: options.root,
        options,
        diagnostics,
    };
    validateRootArrays(context);
    const primitives = [];
    for (const primitive of options.primitiveReport.meshes) {
        const planned = validateGltfPrimitiveAccessorPlan(context, primitive);
        if (planned !== null) {
            primitives.push(planned);
        }
    }
    return result({ diagnostics, primitives });
}
export function gltfAccessorValidationReportToJsonValue(report) {
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
export function gltfAccessorValidationReportToJson(report) {
    return JSON.stringify(gltfAccessorValidationReportToJsonValue(report));
}
function validateRootArrays(context) {
    for (const field of ["buffers", "bufferViews", "accessors"]) {
        if (!Array.isArray(context.root[field])) {
            context.diagnostics.push({
                code: field === "buffers"
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
function result(input) {
    return {
        valid: input.diagnostics.every((diagnostic) => diagnostic.severity !== "error"),
        primitives: input.primitives,
        diagnostics: input.diagnostics,
    };
}
//# sourceMappingURL=gltf-accessor-validation.js.map