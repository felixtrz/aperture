import { type GltfReportDrivenGlbImportOptions, type GltfReportDrivenGlbImportReport } from "./gltf-report-driven-import.js";
import { type GlbSourceLoaderOutputSummaryJsonValue } from "./glb-source-loader-output-summary.js";
import type { GltfSourceRegistrationOrchestrationReport } from "./gltf-source-registration-orchestration.js";
import type { GltfEcsAuthoringCommandPlan } from "./gltf-ecs-authoring-command-plan.js";
import { type GlbSourceLoaderStatusJsonValue } from "./glb-source-loader-status.js";
import type { GlbContainerSource } from "./glb-container.js";
import type { GltfDecodedImageData } from "../materials/gltf-texture.js";
export interface CreateNoFetchGlbSourceLoaderReportOptions extends Omit<GltfReportDrivenGlbImportOptions, "source" | "resolveBufferBytes"> {
    readonly source: GlbContainerSource;
    readonly externalBufferBytes?: ReadonlyMap<number, ArrayBuffer | ArrayBufferView>;
    readonly decodedImageData?: ReadonlyMap<number, GltfDecodedImageData>;
    readonly sourceRegistration?: GltfSourceRegistrationOrchestrationReport | null;
    readonly ecsCommandPlan?: GltfEcsAuthoringCommandPlan | null;
}
export interface NoFetchGlbSourceLoaderReport {
    readonly status: GlbSourceLoaderStatusJsonValue;
    readonly outputSummary: GlbSourceLoaderOutputSummaryJsonValue;
    readonly glbImportReport: GltfReportDrivenGlbImportReport;
}
export declare function createNoFetchGlbSourceLoaderReport(options: CreateNoFetchGlbSourceLoaderReportOptions): NoFetchGlbSourceLoaderReport;
//# sourceMappingURL=glb-source-loader-facade.d.ts.map