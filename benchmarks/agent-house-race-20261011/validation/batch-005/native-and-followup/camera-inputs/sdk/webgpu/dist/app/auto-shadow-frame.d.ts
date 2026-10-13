import type { PreparedResourceDependency } from "../resources/core/prepared-resource-dependencies.js";
import { type AssetRegistry } from "@aperture-engine/simulation";
import type { RenderSnapshot } from "@aperture-engine/render";
import type { GpuTimestampQueryResources } from "../gpu/gpu-timing.js";
import { type RenderShadowFrameResult } from "../shadows/render-shadow-frame.js";
import type { WebGpuApp, WebGpuAppResourceReuseReport } from "./app.js";
import type { WebGpuAppResourceCache } from "./resource-cache.js";
export type WebGpuAppAutoShadowPipelineKind = "directional" | "directional-cascaded" | "point-array" | "directional-point-array" | "spot";
export declare function standardAutoShadowPipelineKindFromSnapshot(snapshot: RenderSnapshot): WebGpuAppAutoShadowPipelineKind | null;
export declare function createWebGpuAppAutoShadowFrame(options: {
    readonly app: WebGpuApp;
    readonly assets: AssetRegistry;
    readonly cache: WebGpuAppResourceCache;
    readonly reuse: WebGpuAppResourceReuseReport;
    readonly snapshot: RenderSnapshot;
    readonly resourceLifetimeFrame?: number;
    readonly label?: string;
    readonly submit?: boolean;
    readonly gpuTiming?: {
        readonly resources: GpuTimestampQueryResources;
    };
}): (RenderShadowFrameResult & {
    readonly preparedDependencies: readonly PreparedResourceDependency[];
}) | null;
export declare function createWebGpuAppAutoShadowFrameInputKey(snapshot: RenderSnapshot): string;
/** Source publications can change caster bytes without changing draw packets. */
export declare function createWebGpuAppAutoShadowCasterMeshKey(snapshot: RenderSnapshot, assets: AssetRegistry): string;
export declare function autoShadowInputKeyUsesCamera(snapshot: RenderSnapshot): boolean;
export declare function autoShadowInputKeyUsesBounds(snapshot: RenderSnapshot): boolean;
//# sourceMappingURL=auto-shadow-frame.d.ts.map