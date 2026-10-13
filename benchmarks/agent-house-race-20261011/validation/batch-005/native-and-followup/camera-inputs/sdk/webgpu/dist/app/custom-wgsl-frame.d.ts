import type { RenderedGeometryFrameCapture } from "./rendered-geometry-inspector.js";
import { type AssetRegistry } from "@aperture-engine/simulation";
import { type RenderSnapshot, type RenderSnapshotChangeSet, type RenderSnapshotUpdateSchedule } from "@aperture-engine/render";
import type { WebGpuAppRenderPhaseTimer } from "./app-phase-timing.js";
import type { WebGpuAppResourceCache } from "./resource-cache.js";
import type { WebGpuApp, WebGpuAppRenderReport, WebGpuAppResourceReuseReport } from "./app.js";
import type { FrameBoundaryReadbackSampleRequest } from "../render/frame/frame-boundary.js";
export declare function renderCustomWgslWebGpuAppFrame(options: {
    readonly geometryFrame?: RenderedGeometryFrameCapture | undefined;
    readonly app: WebGpuApp;
    readonly assets: AssetRegistry;
    readonly cache: WebGpuAppResourceCache;
    readonly snapshot: RenderSnapshot;
    readonly snapshotChangeSet: RenderSnapshotChangeSet;
    readonly snapshotUpdateSchedule: RenderSnapshotUpdateSchedule;
    readonly reuse: WebGpuAppResourceReuseReport;
    readonly clearColor?: readonly number[];
    readonly label?: string;
    readonly readbackSamples?: readonly FrameBoundaryReadbackSampleRequest[];
    readonly gpuTimings?: boolean;
    readonly phaseTimer: WebGpuAppRenderPhaseTimer;
}): Promise<WebGpuAppRenderReport>;
//# sourceMappingURL=custom-wgsl-frame.d.ts.map