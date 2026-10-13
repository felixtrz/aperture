import { type GltfReportDrivenImportOptions, type GltfReportDrivenImportReport } from "./gltf-report-driven-import.js";
import { type GlbSourceLoaderOutputSummaryJsonValue } from "./glb-source-loader-output-summary.js";
import { type GlbSourceLoaderStatusJsonValue } from "./glb-source-loader-status.js";
import type { GltfSourceRegistrationOrchestrationReport } from "./gltf-source-registration-orchestration.js";
import type { GltfEcsAuthoringCommandPlan } from "./gltf-ecs-authoring-command-plan.js";
import type { GltfDecodedImageData } from "../materials/gltf-texture.js";
export interface CreateNoFetchGltfSourceLoaderReportOptions extends Omit<GltfReportDrivenImportOptions, "resolveBufferBytes"> {
    readonly sourceByteLength?: number | null;
    readonly externalBufferBytes?: ReadonlyMap<number, ArrayBuffer | ArrayBufferView>;
    readonly externalImageBytes?: ReadonlyMap<number, ArrayBuffer | ArrayBufferView>;
    readonly decodedImageData?: ReadonlyMap<number, GltfDecodedImageData>;
    readonly sourceRegistration?: GltfSourceRegistrationOrchestrationReport | null;
    readonly ecsCommandPlan?: GltfEcsAuthoringCommandPlan | null;
}
export interface NoFetchGltfSourceLoaderReport {
    readonly status: GlbSourceLoaderStatusJsonValue;
    readonly outputSummary: GlbSourceLoaderOutputSummaryJsonValue;
    readonly root: unknown;
    readonly gltfImportReport: GltfReportDrivenImportReport;
}
export declare function createNoFetchGltfSourceLoaderReport(options: CreateNoFetchGltfSourceLoaderReportOptions): NoFetchGltfSourceLoaderReport;
//# sourceMappingURL=gltf-source-loader-facade.d.ts.map