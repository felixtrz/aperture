import type { GpuOcclusionFeedbackCullingPlan, GpuOcclusionFeedbackFallbackReason } from "../gpu/occlusion-query.js";
import type { RenderPassCommand } from "../render/passes/render-pass-commands.js";
export interface WebGpuAppOcclusionCullingReport {
    queryCandidateDraws: number;
    queriedDraws: number;
    skippedFromQuery: number;
    readonly skippedRenderIds: number[];
    forcedProbeDraws: number;
    readonly forcedProbeRenderIds: number[];
    fallbackReason: GpuOcclusionFeedbackFallbackReason | null;
}
export declare function createWebGpuAppOcclusionCullingReport(): WebGpuAppOcclusionCullingReport;
export declare function appendWebGpuAppOcclusionCullingPlan(report: WebGpuAppOcclusionCullingReport, plan: GpuOcclusionFeedbackCullingPlan): void;
export declare function recordWebGpuAppOcclusionCullingFallback(report: WebGpuAppOcclusionCullingReport, fallbackReason: GpuOcclusionFeedbackFallbackReason): void;
export declare function collectOcclusionQueryRenderIds(commands: readonly RenderPassCommand[]): readonly number[];
export declare function commandsWithoutSkippedOcclusionDraws(commands: readonly RenderPassCommand[], skippedRenderIds: readonly number[], target: RenderPassCommand[]): readonly RenderPassCommand[];
export declare function commandsWithoutOcclusionQueryCommands(commands: readonly RenderPassCommand[], target?: RenderPassCommand[]): readonly RenderPassCommand[];
export declare function normalizeOcclusionQueryCommands(commands: readonly RenderPassCommand[]): readonly number[];
//# sourceMappingURL=occlusion-culling.d.ts.map