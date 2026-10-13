import { type AssetRegistry } from "@aperture-engine/simulation";
import { type PackedSnapshotTransforms, type PackedSnapshotViewUniforms, type RenderSnapshot } from "@aperture-engine/render";
import type { WebGpuCanvasLike } from "../gpu/initialize-webgpu.js";
import type { TonemapOperator } from "../output/output-stage-tonemap.js";
import type { OutputColorSpace } from "../output/output-stage-color-space.js";
import { type CreateMsdfTextRenderPipelineResourceResult, type MsdfTextRenderPipelineResource } from "../render/text/msdf-text-pipeline.js";
import type { RenderPassCommand } from "../render/passes/render-pass-commands.js";
import type { WebGpuAppResourceCache } from "./resource-cache.js";
import type { WebGpuAppResourceReuseReport } from "./app.js";
interface WebGpuAppTextContext {
    readonly canvas?: WebGpuCanvasLike;
    readonly initialization: {
        readonly device: unknown;
        readonly format: string;
    };
    readonly msaa: {
        readonly sampleCount: number;
    };
    readonly tonemap?: TonemapOperator;
    readonly outputColorSpace?: OutputColorSpace;
    readonly sceneRenderFormat?: string;
}
export interface MsdfTextFrameResources {
    readonly valid: boolean;
    readonly commands: readonly RenderPassCommand[];
    readonly diagnostics: readonly unknown[];
}
interface PreparedMsdfTextFrameResources {
    readonly pipeline: CreateMsdfTextRenderPipelineResourceResult | null;
    readonly resources: MsdfTextFrameResources;
}
export declare function prepareMsdfTextFrameResourcesForSnapshot(options: {
    readonly app: WebGpuAppTextContext;
    readonly assets: AssetRegistry;
    readonly cache: WebGpuAppResourceCache;
    readonly snapshot: RenderSnapshot;
    readonly viewUniforms: PackedSnapshotViewUniforms;
    readonly worldTransforms: PackedSnapshotTransforms;
    readonly reuse: WebGpuAppResourceReuseReport;
}): Promise<PreparedMsdfTextFrameResources>;
export declare function createMsdfTextFrameResources(options: {
    readonly app: WebGpuAppTextContext;
    readonly assets: AssetRegistry;
    readonly cache: WebGpuAppResourceCache;
    readonly snapshot: RenderSnapshot;
    readonly viewUniforms: PackedSnapshotViewUniforms;
    readonly worldTransforms: PackedSnapshotTransforms;
    readonly pipeline: MsdfTextRenderPipelineResource;
    readonly reuse: WebGpuAppResourceReuseReport;
}): MsdfTextFrameResources;
export declare function getOrCreateWebGpuAppMsdfTextPipeline(app: WebGpuAppTextContext, cache: WebGpuAppResourceCache): Promise<CreateMsdfTextRenderPipelineResourceResult>;
export {};
//# sourceMappingURL=text.d.ts.map