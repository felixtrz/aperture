import type { RenderSnapshot, ShadowRequestPacket } from "@aperture-engine/render";
import { type Mat4Like } from "@aperture-engine/simulation";
import type { WebGpuBufferDeviceLike } from "../gpu/buffer.js";
import { type CommandEncoderDeviceLike } from "../gpu/command-encoder.js";
import type { GpuTimestampQueryResources } from "../gpu/gpu-timing.js";
import type { QueueSubmitLike } from "../render/queues/queue-submit.js";
import type { TextureGpuDeviceLike } from "../resources/textures/texture-resources.js";
import { createShadowSamplerResourceReport, type ShadowSamplerDeviceLike, type ShadowSamplerResource } from "../materials/standard/standard-material-shadow-bind-group.js";
import type { StandardFrameShadowReceiverResources } from "../materials/standard/standard-frame-resources.js";
import { type DirectionalShadowMatrixComputationReport } from "./directional-shadow-matrix-computation.js";
import { type DirectionalShadowViewProjectionPlanReport } from "./directional-shadow-view-projection-plan.js";
import { type PointShadowViewProjectionPlanReport } from "./point-shadow-view-projection-plan.js";
import { type PointShadowMatrixComputationReport } from "./point-shadow-matrix-computation.js";
import { type SpotShadowViewProjectionPlanReport } from "./spot-shadow-view-projection-plan.js";
import { type SpotShadowMatrixComputationReport } from "./spot-shadow-matrix-computation.js";
import { type ShadowCasterCommandPlanReadinessReport } from "./shadow-caster-command-plan-readiness.js";
import { type ShadowCasterCommandRecordPlanReport, type ShadowCasterExecutableMeshResourceView } from "./shadow-caster-command-record-plan.js";
import { type ShadowCasterDrawListPlanReport } from "./shadow-caster-draw-list-plan.js";
import { type ShadowCasterFrameResourceReadinessReport, type ShadowCasterPreparedMeshResourceView } from "./shadow-caster-frame-resource-readiness.js";
import { type ShadowCasterMatrixBindGroupResource, type ShadowCasterMatrixBindGroupResourceReport, type ShadowCasterMatrixBindGroupDeviceLike } from "./shadow-caster-matrix-bind-group-resource.js";
import { type ShadowCasterPipelineDescriptorReport } from "./shadow-caster-pipeline-descriptor.js";
import { type ShadowCasterPipelineDeviceLike, type ShadowCasterPipelineResource, type ShadowCasterPipelineResourceReport } from "./shadow-caster-pipeline-resource.js";
import { type ShadowDepthTextureResourceCache, type ShadowDepthTextureResourceReport } from "./shadow-depth-texture-resource.js";
import { type ShadowMapDescriptorReport } from "./shadow-map-descriptor.js";
import { type ShadowMatrixBufferDescriptorReport } from "./shadow-matrix-buffer-descriptor.js";
import { type ShadowMatrixBufferResource, type ShadowMatrixBufferResourceReport } from "./shadow-matrix-buffer-resource.js";
import { type ShadowPassAttachmentDescriptorReport } from "./shadow-pass-attachment-descriptor.js";
import { type ShadowPassCommandBufferSubmissionReport } from "./shadow-pass-command-buffer-submission-report.js";
import { type ShadowPassCommandEncodingReport } from "./shadow-pass-command-encoding-report.js";
import { type ShadowPassEncoderAssemblyReport } from "./shadow-pass-encoder-assembly-report.js";
import { type ShadowPassPlanReport } from "./shadow-pass-plan.js";
import { type ShadowTextureResourceReport } from "./shadow-texture-resource.js";
export interface RenderShadowFrameDeviceLike extends CommandEncoderDeviceLike {
    readonly createTexture?: NonNullable<TextureGpuDeviceLike["createTexture"]>;
    readonly createSampler?: NonNullable<TextureGpuDeviceLike["createSampler"] & ShadowSamplerDeviceLike["createSampler"]>;
    readonly createBuffer?: NonNullable<WebGpuBufferDeviceLike["createBuffer"]>;
    readonly createShaderModule?: NonNullable<ShadowCasterPipelineDeviceLike["createShaderModule"]>;
    readonly createRenderPipeline?: NonNullable<ShadowCasterPipelineDeviceLike["createRenderPipeline"]>;
    readonly createBindGroupLayout?: (descriptor: unknown) => unknown;
    readonly createPipelineLayout?: NonNullable<ShadowCasterPipelineDeviceLike["createPipelineLayout"]>;
    readonly createBindGroup?: NonNullable<ShadowCasterMatrixBindGroupDeviceLike["createBindGroup"]>;
    readonly queue?: TextureGpuDeviceLike["queue"] & WebGpuBufferDeviceLike["queue"] & QueueSubmitLike;
}
export type RenderShadowFrameShadowKind = NonNullable<StandardFrameShadowReceiverResources["shadowKind"]>;
/**
 * Which light kind a component frame bakes. Mixed results retain these
 * per-kind reports under lightKindReports. Drives the
 * per-kind view-projection/matrix serializers in the report.
 */
export type RenderShadowFrameKind = "directional" | "point" | "spot";
/**
 * The shadow view-projection / matrix-computation reports differ by light kind
 * (directional cascades vs point cube faces vs spot perspective) but flow
 * through the same generic caster pipeline. The frame result and report widen to
 * the union so a frame can be any kind without losing per-kind diagnostics.
 */
export type RenderShadowFrameViewProjectionReport = DirectionalShadowViewProjectionPlanReport | PointShadowViewProjectionPlanReport | SpotShadowViewProjectionPlanReport;
export type RenderShadowFrameMatrixComputationReport = DirectionalShadowMatrixComputationReport | PointShadowMatrixComputationReport | SpotShadowMatrixComputationReport;
export interface RenderShadowFrameCache {
    readonly shadowDepthTextures?: ShadowDepthTextureResourceCache;
    readonly shadowMatrixBuffers?: Map<string, ShadowMatrixBufferResource>;
    readonly shadowSamplers?: Map<string, ShadowSamplerResource>;
    readonly shadowCasterPipelines?: Map<string, ShadowCasterPipelineResource>;
    readonly shadowCasterMatrixBindGroups?: Map<string, ShadowCasterMatrixBindGroupResource>;
    readonly shadowCasterPassMatrixBuffers?: Map<string, ShadowCasterPassMatrixBufferResource>;
    readonly shadowCasterWorldTransformBuffers?: Map<string, ShadowCasterWorldTransformBufferResource>;
    readonly shadowCasterWorldTransformScratch?: ShadowCasterWorldTransformScratch;
    readonly shadowCasterCommandTopology?: Map<string, ShadowCasterCommandTopologyCacheEntry>;
}
export interface RenderShadowFrameShadowMapOptions {
    readonly mapSize?: number;
    readonly depthBias?: number;
    readonly normalBias?: number;
    readonly filterRadiusTexels?: number;
    readonly cascadeCount?: number;
    readonly resourceKey?: string;
}
export interface RenderShadowFrameMatrixOptions {
    /** Fallback center used when no primary render camera can drive auto-fit. */
    readonly center?: readonly [number, number, number];
    /** Fallback span used when no primary render camera can drive auto-fit. */
    readonly orthographicSize?: number;
    readonly near?: number;
    readonly far?: number;
    readonly lightDistance?: number;
}
export interface CreateRenderShadowFrameOptions {
    readonly device: RenderShadowFrameDeviceLike;
    readonly snapshot: RenderSnapshot;
    readonly preparedMeshes: readonly ShadowCasterPreparedMeshResourceView[];
    readonly executableMeshes: readonly ShadowCasterExecutableMeshResourceView[];
    readonly cache?: RenderShadowFrameCache;
    readonly shadowMap?: RenderShadowFrameShadowMapOptions;
    readonly matrix?: RenderShadowFrameMatrixOptions;
    readonly label?: string;
    readonly encode?: boolean;
    readonly submit?: boolean;
    readonly gpuTiming?: {
        readonly resources: GpuTimestampQueryResources;
    };
}
export interface RenderShadowFrameResult {
    /** Per-kind frames for composed receivers; legacy detail fields describe the primary frame. */
    readonly frames?: readonly RenderShadowFrameResult[];
    readonly receiverResources: StandardFrameShadowReceiverResources | null;
    readonly report: RenderShadowFrameReport;
    readonly descriptor: ShadowMapDescriptorReport;
    readonly textures: ShadowTextureResourceReport;
    readonly depthTextureResources: ShadowDepthTextureResourceReport;
    readonly samplerResource: ReturnType<typeof createShadowSamplerResourceReport>;
    readonly passPlan: ShadowPassPlanReport;
    readonly passAttachments: ShadowPassAttachmentDescriptorReport;
    readonly viewProjection: RenderShadowFrameViewProjectionReport;
    readonly matrixComputation: RenderShadowFrameMatrixComputationReport;
    readonly matrixBuffer: ShadowMatrixBufferDescriptorReport;
    readonly matrixBufferResource: ShadowMatrixBufferResourceReport;
    readonly casterDrawList: ShadowCasterDrawListPlanReport;
    readonly commandPlan: ShadowCasterCommandPlanReadinessReport;
    readonly commandEncoding: ShadowPassCommandEncodingReport;
    readonly pipelineDescriptor: ShadowCasterPipelineDescriptorReport;
    readonly pipelineResource: ShadowCasterPipelineResourceReport;
    readonly matrixBindGroupResource: ShadowCasterMatrixBindGroupResourceReport;
    readonly frameResources: ShadowCasterFrameResourceReadinessReport;
    readonly commandRecords: ShadowCasterCommandRecordPlanReport;
    readonly encoderAssembly: ShadowPassEncoderAssemblyReport;
    readonly commandBufferSubmission: ShadowPassCommandBufferSubmissionReport;
}
export interface RenderShadowFrameReport {
    /** Complete per-kind details; top-level counts summarize all frames. */
    readonly lightKindReports?: readonly RenderShadowFrameReport[];
    readonly ready: boolean;
    readonly status: "submitted" | "ready" | "missing" | "not-required";
    readonly shadowKind: RenderShadowFrameShadowKind | null;
    readonly requestCount: number;
    /** Selection coverage, independent of GPU readiness/submission and caster counts. */
    readonly requestCoverage?: {
        readonly requestedCount: number;
        readonly servedCount: number;
        readonly omittedCount: number;
        readonly requested: readonly {
            readonly shadowId: number;
            readonly lightId: number;
            readonly lightKind: NonNullable<ShadowRequestPacket["lightKind"]>;
        }[];
        /** Requests routed to this frame's supported path, not proof of GPU submission. */
        readonly served: readonly {
            readonly shadowId: number;
            readonly lightId: number;
            readonly lightKind: NonNullable<ShadowRequestPacket["lightKind"]>;
        }[];
        readonly omitted: readonly {
            readonly shadowId: number;
            readonly lightId: number;
            readonly lightKind: NonNullable<ShadowRequestPacket["lightKind"]>;
            readonly reason: "mixed-shadow-kind-not-supported" | "unsupported-shadow-light-kind";
        }[];
    };
    readonly passCount: number;
    readonly drawCalls: number;
    /** Counts are draw instances across shadow passes, not unique scene meshes. */
    readonly casterCounts?: {
        readonly requestedDraws: number;
        readonly includedDraws: number;
        readonly readyDraws: number;
        readonly encodedDrawCalls: number;
        readonly submittedDrawCalls: number;
    };
    readonly descriptor: ShadowMapDescriptorReport;
    readonly viewProjection: RenderShadowFrameViewProjectionReport;
    readonly matrixComputation: RenderShadowFrameMatrixComputationReport;
    readonly casterDrawList: ShadowCasterDrawListPlanReport;
    readonly depthTextureKeys: readonly string[];
    readonly matrixBufferResourceKey: string | null;
    readonly sections: {
        readonly shadowRequests: boolean;
        readonly depthTextureResources: boolean;
        readonly matrixBufferResource: boolean;
        readonly samplerResource: boolean;
        readonly pipelineResource: boolean;
        readonly matrixBindGroupResource: boolean;
        readonly commandBufferSubmission: boolean;
        readonly receiverResources: boolean;
    };
    readonly resourceReuse: {
        readonly depthTexturesCreated: number;
        readonly depthTexturesReused: number;
        readonly matrixBuffersCreated: number;
        readonly matrixBuffersReused: number;
        readonly samplersCreated: number;
        readonly samplersReused: number;
        readonly pipelinesCreated: number;
        readonly pipelinesReused: number;
        readonly matrixBindGroupsCreated: number;
        readonly matrixBindGroupsReused: number;
    };
    readonly commandBufferSubmission: {
        readonly status: ShadowPassCommandBufferSubmissionReport["status"];
        readonly assembledPasses: number;
        readonly commandBuffers: number;
        readonly submittedCommandBuffers: number;
        readonly commandBufferKeys: readonly string[];
        readonly sections: ShadowPassCommandBufferSubmissionReport["sections"];
    };
    readonly diagnostics: readonly RenderShadowFrameDiagnostic[];
}
export interface RenderShadowFrameDiagnostic {
    readonly stage: string;
    readonly code: string;
    readonly severity: "warning" | "error";
    readonly message: string;
    readonly renderId?: number;
    readonly meshKey?: string;
    readonly passKey?: string;
    readonly resourceKey?: string;
}
export interface ShadowCasterPassMatrixBufferResource {
    readonly resourceKey: string;
    readonly matrixResourceKey: string;
    readonly label: string;
    readonly passKey: string;
    readonly matrixKey: string;
    readonly buffer: unknown;
    readonly byteSize: number;
    readonly lastData: Float32Array;
}
export interface ShadowCasterWorldTransformBufferResource {
    readonly resourceKey: string;
    readonly label: string;
    readonly buffer: unknown;
    readonly byteSize: number;
    readonly matrixCount: number;
    readonly lastData: Float32Array;
}
export interface ShadowCasterWorldTransformScratch {
    data: Float32Array;
    readonly indexByPassDraw: Map<string, number>;
}
export interface ShadowCasterCommandTopologyCacheEntry {
    readonly key: string;
    readonly frameResources: ShadowCasterFrameResourceReadinessReport;
    readonly commandRecords: ShadowCasterCommandRecordPlanReport;
}
export declare function createShadowCasterWorldTransformScratch(): ShadowCasterWorldTransformScratch;
export declare function createRenderShadowFrame(options: CreateRenderShadowFrameOptions): RenderShadowFrameResult;
export interface PrimaryShadowCamera {
    readonly viewMatrix: Mat4Like;
    readonly projectionMatrix: Mat4Like;
    readonly near: number;
    readonly far: number;
}
export declare function resolvePrimaryShadowCamera(snapshot: RenderSnapshot): PrimaryShadowCamera | null;
//# sourceMappingURL=render-shadow-frame.d.ts.map