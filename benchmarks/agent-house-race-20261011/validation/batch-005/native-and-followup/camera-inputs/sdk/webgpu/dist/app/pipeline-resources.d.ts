import type { RenderSnapshot } from "@aperture-engine/render";
import { type CreateDebugNormalRenderPipelineResourceResult } from "../materials/debug-normal/debug-normal-pipeline.js";
import { type CreateMatcapRenderPipelineResourceResult } from "../materials/matcap/matcap-pipeline.js";
import { type CreateStandardRenderPipelineResourceResult } from "../materials/standard/standard-pipeline.js";
import { type CreateUnlitRenderPipelineResourceResult } from "../materials/unlit/unlit-pipeline.js";
import type { CreateCustomWgslMaterialRenderPipelineResourceResult } from "../materials/custom-wgsl/custom-wgsl-material.js";
import type { CreateSpriteRenderPipelineResourceResult } from "../render/sprites/sprite-pipeline.js";
import type { WebGpuAppMaterialKind } from "./pipeline-layouts.js";
import type { WebGpuAppResourceCache } from "./resource-cache.js";
import type { WebGpuApp, WebGpuAppResourceReuseReport } from "./app.js";
export type WebGpuAppPipelineResourceResult = CreateUnlitRenderPipelineResourceResult | CreateMatcapRenderPipelineResourceResult | CreateStandardRenderPipelineResourceResult | CreateDebugNormalRenderPipelineResourceResult | CreateSpriteRenderPipelineResourceResult | CreateCustomWgslMaterialRenderPipelineResourceResult;
export declare function getOrCreateWebGpuAppPipeline(options: {
    readonly app: WebGpuApp;
    readonly cache: WebGpuAppResourceCache;
    readonly reuse: WebGpuAppResourceReuseReport;
    readonly kind: WebGpuAppMaterialKind;
    readonly pipelineKey: string;
    readonly batchKey: RenderSnapshot["meshDraws"][number]["batchKey"];
    readonly motionVectorColorFormat?: string | null;
    readonly indirectColorFormat?: string | null;
}): WebGpuAppPipelineResourceResult | Promise<WebGpuAppPipelineResourceResult>;
//# sourceMappingURL=pipeline-resources.d.ts.map