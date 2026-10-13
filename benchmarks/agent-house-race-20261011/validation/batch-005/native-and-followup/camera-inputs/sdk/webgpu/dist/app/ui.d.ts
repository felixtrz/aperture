import { type AssetRegistry } from "@aperture-engine/simulation";
import { type PackedSnapshotViewUniforms, type RenderSnapshot } from "@aperture-engine/render";
import type { WebGpuCanvasLike } from "../gpu/initialize-webgpu.js";
import { type CreateUiQuadRenderPipelineResourceResult } from "../render/ui/ui-quad-pipeline.js";
import type { RenderPassCommand } from "../render/passes/render-pass-commands.js";
import type { WebGpuAppResourceCache } from "./resource-cache.js";
import type { WebGpuAppResourceReuseReport } from "./app.js";
import type { TonemapOperator } from "../output/output-stage-tonemap.js";
import type { OutputColorSpace } from "../output/output-stage-color-space.js";
interface WebGpuAppUiContext {
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
export interface UiFrameResources {
    readonly valid: boolean;
    readonly commands: readonly RenderPassCommand[];
    readonly diagnostics: readonly unknown[];
}
export declare function prepareUiFrameResourcesForSnapshot(options: {
    readonly app: WebGpuAppUiContext;
    readonly assets: AssetRegistry;
    readonly cache: WebGpuAppResourceCache;
    readonly snapshot: RenderSnapshot;
    readonly viewUniforms: PackedSnapshotViewUniforms;
    readonly reuse: WebGpuAppResourceReuseReport;
}): Promise<UiFrameResources>;
export declare function getOrCreateWebGpuAppUiPanelPipeline(app: WebGpuAppUiContext, cache: WebGpuAppResourceCache): Promise<CreateUiQuadRenderPipelineResourceResult>;
export declare function getOrCreateWebGpuAppUiImagePipeline(app: WebGpuAppUiContext, cache: WebGpuAppResourceCache): Promise<CreateUiQuadRenderPipelineResourceResult>;
/** Allocation-free predicate for gating UI frame preparation. */
export declare function snapshotHasUiFrameWork(snapshot: RenderSnapshot): boolean;
export {};
//# sourceMappingURL=ui.d.ts.map