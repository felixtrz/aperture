import { type RenderedGeometrySubmissionRecipe } from "./rendered-geometry-frame.js";
import type { RenderedGeometryFrameCapture } from "./rendered-geometry-inspector.js";
import type { RenderSnapshot } from "@aperture-engine/render";
import { assembleFrameBoundary, type FrameBoundaryAssemblyReport, type FrameBoundaryReadbackSampleRequest } from "../render/frame/frame-boundary.js";
import type { RenderPassCommand } from "../render/passes/render-pass-commands.js";
import type { RenderPassAttachmentLoadOp, RenderPassAttachmentStoreOp } from "../render/passes/render-pass-attachments.js";
import type { CachedWebGpuDepthTextureResource } from "../resources/textures/depth-texture-resource.js";
import { type WebGpuPostEffect } from "../post/post-pass.js";
import { type ShadowCasterGraphPass } from "./shadow-caster-graph-pass.js";
import type { WebGpuAppFrameBoundaryTarget } from "./frame-target.js";
import type { WebGpuAppResourceCache } from "./resource-cache.js";
import type { WebGpuApp, WebGpuAppPostEffectSubmissionReport, WebGpuAppPostGraphReport, WebGpuAppRenderTargetSubmissionReport } from "./app.js";
interface WebGpuAppPostProcessedSwapchainTargetResult {
    readonly valid: boolean;
    readonly boundaries: readonly FrameBoundaryAssemblyReport[];
    readonly renderTarget: WebGpuAppRenderTargetSubmissionReport;
    readonly postEffects: readonly WebGpuAppPostEffectSubmissionReport[];
    readonly readbackBoundary: FrameBoundaryAssemblyReport | null;
    readonly plannedCommands: number;
    readonly drawCalls: number;
    readonly diagnostics: readonly unknown[];
    readonly graph?: WebGpuAppPostGraphReport;
}
export declare function assembleWebGpuAppPostProcessedSwapchainTarget(options: {
    readonly geometryFrame?: RenderedGeometryFrameCapture | undefined;
    readonly geometryRecipe?: RenderedGeometrySubmissionRecipe | undefined;
    readonly geometryUnsupportedRoute?: "custom-wgsl" | "user-pass" | "unsupported-route" | undefined;
    readonly app: WebGpuApp;
    readonly cache: WebGpuAppResourceCache;
    readonly snapshot: RenderSnapshot;
    readonly target: Extract<WebGpuAppFrameBoundaryTarget, {
        source: "swapchain";
    }>;
    readonly commands: readonly RenderPassCommand[];
    readonly overlayCommands?: readonly RenderPassCommand[];
    readonly depthAttachment: CachedWebGpuDepthTextureResource;
    readonly effects: readonly WebGpuPostEffect[];
    readonly label: string;
    readonly clearColor?: readonly number[];
    readonly sceneColorLoadOp?: RenderPassAttachmentLoadOp;
    readonly sceneDepthLoadOp?: RenderPassAttachmentLoadOp;
    readonly sceneMsaaColorStoreOp?: RenderPassAttachmentStoreOp;
    readonly present?: boolean;
    readonly motionVectorColorFormat?: string | null;
    readonly indirectColorFormat?: string | null;
    readonly msaaColorTarget?: Parameters<typeof assembleFrameBoundary>[0]["msaaColorTarget"];
    readonly readbackSamples?: readonly FrameBoundaryReadbackSampleRequest[];
    readonly gpuTiming?: Parameters<typeof assembleFrameBoundary>[0]["gpuTiming"];
    readonly occlusionQueries?: Parameters<typeof assembleFrameBoundary>[0]["occlusionQueries"];
    readonly enableRenderBundles?: boolean;
    readonly renderBundleCommandCount?: number;
    readonly useFrameGraph?: boolean;
    readonly shadowCasterGraphPasses?: readonly ShadowCasterGraphPass[];
}): WebGpuAppPostProcessedSwapchainTargetResult;
type PostProcessedSwapchainTargetOptions = Parameters<typeof assembleWebGpuAppPostProcessedSwapchainTarget>[0];
/**
 * M3-T3: the single-encoder FrameGraph variant of
 * assembleWebGpuAppPostProcessedSwapchainTarget. Builds the SAME per-pass
 * boundaries the legacy path builds (via buildFrameBoundaryTargetPlan) but
 * registers them as graph nodes + resolveRenderBoundary payloads and runs them
 * through executeFrameGraph ONCE, so the whole post stack submits a single
 * command buffer. Returns null to fall back to the legacy path for anything this
 * v1 does not cover (motion-vector fallbacks / indirect channel / occlusion, or
 * any resource allocation failure), keeping the flag a safe no-op.
 */
export declare function assembleWebGpuAppPostProcessedSwapchainTargetViaGraph(options: PostProcessedSwapchainTargetOptions): WebGpuAppPostProcessedSwapchainTargetResult | null;
export {};
//# sourceMappingURL=post-processing.d.ts.map