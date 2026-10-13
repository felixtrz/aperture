import type { GltfAccessorValidationOptions, GltfAccessorValidationReport, GltfAccessorValidationReportJsonValue } from "./gltf-accessor-validation-types.js";
export type { GltfAccessorSemantic, GltfAccessorValidationDiagnostic, GltfAccessorValidationDiagnosticSeverity, GltfAccessorValidationOptions, GltfAccessorValidationReport, GltfAccessorValidationReportJsonValue, GltfPrimitiveAccessorPlan, GltfValidatedAccessorReference, } from "./gltf-accessor-validation-types.js";
export declare function validateGltfPrimitiveAccessorReferences(options: GltfAccessorValidationOptions): GltfAccessorValidationReport;
export declare function gltfAccessorValidationReportToJsonValue(report: GltfAccessorValidationReport): GltfAccessorValidationReportJsonValue;
export declare function gltfAccessorValidationReportToJson(report: GltfAccessorValidationReport): string;
//# sourceMappingURL=gltf-accessor-validation.d.ts.map