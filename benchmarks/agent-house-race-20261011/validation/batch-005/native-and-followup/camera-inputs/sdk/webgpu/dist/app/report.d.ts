import { type RenderEntityRef, type RenderSnapshot, type RenderSnapshotChangeSet, type RenderSnapshotUpdateSchedule } from "@aperture-engine/render";
import { type WebGpuAppDiagnosticsSummary } from "./app-diagnostics-summary.js";
import { type AppTextureSamplerResourceCache, type AppTextureSamplerResourceCacheSummary } from "./app-texture-sampler-resources.js";
import { type PreparedAppMaterialCacheSummary } from "../materials/core/prepared-app-material-resource.js";
import { type PreparedBuiltInMaterialStore } from "../materials/core/prepared-built-in-material-store.js";
import { type PreparedMeshGpuResourceCache, type PreparedMeshGpuResourceCacheSummary } from "../resources/meshes/prepared-mesh-cache.js";
import type { LocalLightClusterCookieResources } from "../lighting/local-light-cookie-resources.js";
import type { FrameBoundaryAssemblyReport, FrameBoundaryReadbackResult } from "../render/frame/frame-boundary.js";
import type { IndirectDrawCommandReport } from "../render/draw/indirect-draw-commands.js";
import type { GpuPassTimingReport } from "../gpu/gpu-timing.js";
import type { WebGpuAppRenderPhaseTimingReport } from "./app-phase-timing.js";
import type { CachedWebGpuDepthTextureResource } from "../resources/textures/depth-texture-resource.js";
import type { RenderPassCommandPressureReport } from "../render/passes/render-pass-commands.js";
import type { WebGpuIdBufferPickReadbackResult } from "../picking/id-buffer-pick.js";
import type { WebGpuAppDepthAttachmentReport, WebGpuAppFrameResourcesResult, WebGpuAppJsonValue, WebGpuAppMotionVectorReport, WebGpuAppMsaaReport, WebGpuAppOcclusionQueryReport, WebGpuAppPickReport, WebGpuAppPickReportJsonValue, WebGpuAppPipelineResourceResult, WebGpuAppPostEffectSubmissionReport, WebGpuAppRenderBundleReport, WebGpuAppRenderReport, WebGpuAppRenderReportJsonValue, WebGpuAppRenderTargetSubmissionReport, WebGpuAppResourceReuseReport, WebGpuAppTransmissionGrabPassReport } from "./app.js";
interface WebGpuAppResourceSummaryCache extends AppTextureSamplerResourceCache {
    readonly preparedMaterials: PreparedBuiltInMaterialStore;
    readonly preparedMeshes: PreparedMeshGpuResourceCache;
}
export declare function createWebGpuAppPickReport(input: {
    readonly x: number;
    readonly y: number;
    readonly dimensions: {
        readonly width: number;
        readonly height: number;
    };
    readonly id: number | null;
    readonly entity: RenderEntityRef | null;
    readonly diagnostics: readonly unknown[];
    readonly readback?: WebGpuIdBufferPickReadbackResult;
}): WebGpuAppPickReport;
export declare function webGpuAppRenderReportToJsonValue(report: WebGpuAppRenderReport, options?: {
    readonly detail?: "full" | "status";
}): WebGpuAppRenderReportJsonValue;
export declare function webGpuAppPickReportToJsonValue(report: WebGpuAppPickReport): WebGpuAppPickReportJsonValue;
export declare function webGpuAppRenderReportToJson(report: WebGpuAppRenderReport): string;
export declare function toWebGpuAppJsonValue(value: unknown, seen?: WeakSet<object>): WebGpuAppJsonValue;
export declare function renderReport(input: {
    readonly ok: boolean;
    readonly snapshot: RenderSnapshot;
    readonly snapshotChangeSet?: RenderSnapshotChangeSet;
    readonly snapshotUpdateSchedule?: RenderSnapshotUpdateSchedule;
    readonly diagnostics: readonly unknown[];
    readonly diagnosticsSummary?: WebGpuAppDiagnosticsSummary;
    readonly resourceReuse?: WebGpuAppResourceReuseReport;
    readonly pipeline?: WebGpuAppPipelineResourceResult | null;
    readonly resources?: WebGpuAppFrameResourcesResult | null;
    readonly boundary?: FrameBoundaryAssemblyReport | null;
    readonly boundaries?: readonly FrameBoundaryAssemblyReport[];
    readonly renderTargets?: readonly WebGpuAppRenderTargetSubmissionReport[];
    readonly postEffects?: readonly WebGpuAppPostEffectSubmissionReport[];
    readonly transmissionGrabPass?: WebGpuAppTransmissionGrabPassReport;
    readonly msaa?: WebGpuAppMsaaReport;
    readonly depthAttachment?: WebGpuAppDepthAttachmentReport;
    readonly readback?: FrameBoundaryReadbackResult;
    readonly gpuTimings?: GpuPassTimingReport;
    readonly phaseTimings?: WebGpuAppRenderPhaseTimingReport;
    readonly commandPressure?: RenderPassCommandPressureReport;
    readonly renderBundles?: WebGpuAppRenderBundleReport;
    readonly indirectDraws?: IndirectDrawCommandReport;
    readonly motionVectors?: WebGpuAppMotionVectorReport;
    readonly shadow?: WebGpuAppRenderReport["shadow"];
    readonly localLightCookieResources?: LocalLightClusterCookieResources | null | undefined;
    readonly occlusionQueries?: WebGpuAppOcclusionQueryReport;
    readonly particles?: WebGpuAppRenderReport["particles"];
    readonly features?: WebGpuAppRenderReport["features"];
    readonly drawPackages?: number;
    readonly drawCommands?: number;
    readonly drawCalls?: number;
}): WebGpuAppRenderReport;
export declare function createWebGpuAppDepthAttachmentReport(snapshot: RenderSnapshot, resource: CachedWebGpuDepthTextureResource): WebGpuAppDepthAttachmentReport;
export declare function createWebGpuAppResourceReuseReport(): WebGpuAppResourceReuseReport;
export declare function writeWebGpuAppPreparedMaterialCacheSummary(summary: PreparedAppMaterialCacheSummary, cache: WebGpuAppResourceSummaryCache): PreparedAppMaterialCacheSummary;
export declare function writeWebGpuAppPreparedMeshCacheSummary(summary: PreparedMeshGpuResourceCacheSummary, cache: WebGpuAppResourceSummaryCache): PreparedMeshGpuResourceCacheSummary;
export declare function writeWebGpuAppTextureSamplerCacheSummary(summary: AppTextureSamplerResourceCacheSummary, cache: WebGpuAppResourceSummaryCache): AppTextureSamplerResourceCacheSummary;
export declare function waitForSubmittedWork(device: unknown): Promise<void>;
/**
 * Whether the assembled frame produced GPU→CPU readbacks that require a full
 * queue drain before they can be consumed this frame. Frames without pending
 * readbacks must skip `waitForSubmittedWork` — draining unconditionally
 * serializes the CPU against the GPU and defeats frame pipelining (AI-11).
 */
export declare function frameBoundariesNeedGpuDrain(boundaries: {
    readonly readbackBoundary: object | null;
    readonly gpuTimingReadbacks?: readonly unknown[];
    readonly occlusionQueryReadbacks?: readonly unknown[];
    readonly occlusionQueryCount?: number;
}): boolean;
export {};
//# sourceMappingURL=report.d.ts.map