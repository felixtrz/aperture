import type { GltfPrimitiveAccessorPlan, GltfValidatedAccessorReference } from "./gltf-accessor-validation.js";
import type { GltfAccessorDecodingDiagnostic, GltfAccessorDecodingReport, GltfAccessorDecodingReportJsonValue } from "./gltf-accessor-decoding-types.js";
export declare function gltfAccessorDecodingReportToJsonValue(report: GltfAccessorDecodingReport): GltfAccessorDecodingReportJsonValue;
export declare function gltfAccessorDecodingReportToJson(report: GltfAccessorDecodingReport): string;
export declare function accessorDecodingDiagnostic(primitive: GltfPrimitiveAccessorPlan, accessor: GltfValidatedAccessorReference, input: Pick<GltfAccessorDecodingDiagnostic, "code" | "message">): GltfAccessorDecodingDiagnostic;
//# sourceMappingURL=gltf-accessor-decoding-report.d.ts.map