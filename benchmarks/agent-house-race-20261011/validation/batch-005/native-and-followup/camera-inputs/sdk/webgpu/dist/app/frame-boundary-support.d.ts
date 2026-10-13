import { type RenderSnapshotUpdateSchedule } from "@aperture-engine/render";
import { type GpuOcclusionQueryDiagnostic, type GpuOcclusionQueryResources } from "../gpu/occlusion-query.js";
import { createRenderBundleCommandKey } from "../render/draw/render-bundle.js";
import { prepareIndirectDrawCommands } from "../render/draw/indirect-draw-commands.js";
import type { FrameBoundaryAssemblyReport } from "../render/frame/frame-boundary.js";
import type { RenderPassCommand } from "../render/passes/render-pass-commands.js";
import type { WebGpuAppFrameBoundaryTarget } from "./frame-target.js";
import type { WebGpuAppResourceCache } from "./resource-cache.js";
import type { WebGpuAppRenderBundleReport } from "./app.js";
interface WebGpuAppFrameBoundarySupportContext {
    readonly initialization: {
        readonly device: unknown;
        readonly adapter: {
            readonly features?: {
                readonly has?: (feature: string) => boolean;
            };
        };
    };
}
export declare function shouldUseRenderBundlesForSnapshotSchedule(schedule: RenderSnapshotUpdateSchedule): boolean;
export declare function prepareWebGpuAppIndirectDrawCommands(options: {
    readonly app: WebGpuAppFrameBoundarySupportContext;
    readonly cache: WebGpuAppResourceCache;
    readonly commands: readonly RenderPassCommand[];
    readonly label: string;
}): ReturnType<typeof prepareIndirectDrawCommands>;
export declare function createWebGpuAppOcclusionQueryResources(options: {
    readonly app: WebGpuAppFrameBoundarySupportContext;
    readonly cache: WebGpuAppResourceCache;
    readonly label: string;
    readonly target: WebGpuAppFrameBoundaryTarget;
    readonly queryCount: number;
}): {
    readonly valid: boolean;
    readonly resources: GpuOcclusionQueryResources | null;
    readonly diagnostics: readonly GpuOcclusionQueryDiagnostic[];
};
export declare function createWebGpuAppRenderBundleCommandKey(options: {
    readonly target: WebGpuAppFrameBoundaryTarget;
    readonly descriptor: {
        readonly colorFormats: readonly string[];
        readonly depthStencilFormat: string;
        readonly sampleCount: number;
    };
    readonly commands: readonly RenderPassCommand[];
    readonly cache: Parameters<typeof createRenderBundleCommandKey>[1];
}): string;
export declare function createWebGpuAppRenderBundleReport(boundaries: readonly FrameBoundaryAssemblyReport[]): WebGpuAppRenderBundleReport | undefined;
export {};
//# sourceMappingURL=frame-boundary-support.d.ts.map