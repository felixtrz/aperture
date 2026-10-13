import { type AssetRegistry } from "@aperture-engine/simulation";
import { type PackedSnapshotTransforms, type PackedSnapshotViewUniforms, type QuadDepthMode, type RenderSnapshot, type SpriteDrawPacket } from "@aperture-engine/render";
import type { WebGpuCanvasLike } from "../gpu/initialize-webgpu.js";
import { type CreateSpriteRenderPipelineResourceResult, type SpriteRenderPipelineResource } from "../render/sprites/sprite-pipeline.js";
import type { RenderPassCommand } from "../render/passes/render-pass-commands.js";
import type { TonemapOperator } from "../output/output-stage-tonemap.js";
import type { OutputColorSpace } from "../output/output-stage-color-space.js";
import type { WebGpuAppResourceCache } from "./resource-cache.js";
import type { WebGpuAppResourceReuseReport } from "./app.js";
interface WebGpuAppSpriteContext {
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
export interface SpriteFrameResources {
    readonly valid: boolean;
    readonly commands: readonly RenderPassCommand[];
    readonly diagnostics: readonly unknown[];
}
interface PreparedSpriteFrameResources {
    readonly pipeline: CreateSpriteRenderPipelineResourceResult | null;
    readonly resources: SpriteFrameResources;
}
export declare function prepareSpriteFrameResourcesForSnapshot(options: {
    readonly app: WebGpuAppSpriteContext;
    readonly assets: AssetRegistry;
    readonly cache: WebGpuAppResourceCache;
    readonly snapshot: RenderSnapshot;
    readonly viewUniforms: PackedSnapshotViewUniforms;
    readonly worldTransforms: PackedSnapshotTransforms;
    readonly reuse: WebGpuAppResourceReuseReport;
}): Promise<PreparedSpriteFrameResources>;
export declare function createSpriteFrameResources(options: {
    readonly app: WebGpuAppSpriteContext;
    readonly assets: AssetRegistry;
    readonly cache: WebGpuAppResourceCache;
    readonly snapshot: RenderSnapshot;
    readonly spriteDraws: readonly SpriteDrawPacket[];
    readonly viewUniforms: PackedSnapshotViewUniforms;
    readonly worldTransforms: PackedSnapshotTransforms;
    readonly pipeline: SpriteRenderPipelineResource;
    readonly pipelinesByDepthMode?: ReadonlyMap<QuadDepthMode, SpriteRenderPipelineResource>;
    readonly reuse: WebGpuAppResourceReuseReport;
}): SpriteFrameResources;
export declare function getOrCreateWebGpuAppSpritePipeline(app: WebGpuAppSpriteContext, cache: WebGpuAppResourceCache, depthMode?: QuadDepthMode): Promise<CreateSpriteRenderPipelineResourceResult>;
export {};
//# sourceMappingURL=sprites.d.ts.map