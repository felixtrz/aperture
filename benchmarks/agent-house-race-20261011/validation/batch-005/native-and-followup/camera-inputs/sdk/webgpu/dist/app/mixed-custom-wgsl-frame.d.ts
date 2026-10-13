import type { RenderedGeometryFrameCapture } from "./rendered-geometry-inspector.js";
import { type AssetRegistry } from "@aperture-engine/simulation";
import { type RenderSnapshot, type RenderSnapshotChangeSet, type RenderSnapshotUpdateSchedule } from "@aperture-engine/render";
import { createCustomWgslAppFrameResources } from "../materials/custom-wgsl/custom-wgsl-app-frame-resources.js";
import type { UnlitBindGroupResource } from "../materials/unlit/unlit-bind-group.js";
import type { MeshGpuBufferResource } from "../resources/meshes/mesh-buffer-resources.js";
import type { StandardFrameIblResources, StandardFrameShadowReceiverResources } from "../materials/standard/standard-frame-resources.js";
import type { LocalLightClusterCookieResources } from "../lighting/local-light-cookie-resources.js";
import type { CreateQueuedBuiltInFrameResourcesResult } from "../render/queues/queued-built-in-frame-resource-set.js";
import type { QueuedBuiltInAppResourceSet } from "../render/queues/queued-built-in-app-resource-set.js";
import type { FrameBoundaryReadbackSampleRequest } from "../render/frame/frame-boundary.js";
import type { WebGpuAppRenderPhaseTimer } from "./app-phase-timing.js";
import type { WebGpuApp, WebGpuAppRenderReport, WebGpuAppResourceReuseReport } from "./app.js";
import type { WebGpuAppResourceCache } from "./resource-cache.js";
interface MixedCustomWgslAppFrameResources {
    readonly mesh: NonNullable<CreateQueuedBuiltInFrameResourcesResult["resources"]>["mesh"];
    readonly viewUniform: NonNullable<CreateQueuedBuiltInFrameResourcesResult["resources"]>["viewUniform"];
    readonly worldTransforms: NonNullable<CreateQueuedBuiltInFrameResourcesResult["resources"]>["worldTransforms"];
    readonly meshResources: readonly MeshGpuBufferResource[];
    readonly bindGroups: readonly UnlitBindGroupResource[];
    readonly unlit: NonNullable<CreateQueuedBuiltInFrameResourcesResult["resources"]>["unlit"];
    readonly matcap: NonNullable<CreateQueuedBuiltInFrameResourcesResult["resources"]>["matcap"];
    readonly standard: NonNullable<CreateQueuedBuiltInFrameResourcesResult["resources"]>["standard"];
    readonly debugNormal: NonNullable<CreateQueuedBuiltInFrameResourcesResult["resources"]>["debugNormal"];
    readonly custom: readonly NonNullable<Awaited<ReturnType<typeof createCustomWgslAppFrameResources>>["resources"]>[];
}
export interface MixedCustomWgslAppFrameResourcesResult {
    readonly valid: boolean;
    readonly resources: MixedCustomWgslAppFrameResources | null;
    readonly builtIn: CreateQueuedBuiltInFrameResourcesResult | null;
    readonly custom: readonly Awaited<ReturnType<typeof createCustomWgslAppFrameResources>>[];
    readonly diagnostics: readonly unknown[];
}
export declare function renderMixedCustomWgslWebGpuAppFrame(options: {
    readonly geometryFrame?: RenderedGeometryFrameCapture | undefined;
    readonly app: WebGpuApp;
    readonly assets: AssetRegistry;
    readonly cache: WebGpuAppResourceCache;
    readonly snapshot: RenderSnapshot;
    readonly snapshotChangeSet: RenderSnapshotChangeSet;
    readonly snapshotUpdateSchedule: RenderSnapshotUpdateSchedule;
    readonly builtInSnapshot: RenderSnapshot;
    readonly builtInResourceSet: QueuedBuiltInAppResourceSet;
    readonly routeDiagnostics?: readonly unknown[];
    readonly reuse: WebGpuAppResourceReuseReport;
    readonly resourceLifetimeFrame?: number;
    readonly clearColor?: readonly number[];
    readonly label?: string;
    readonly readbackSamples?: readonly FrameBoundaryReadbackSampleRequest[];
    readonly gpuTimings?: boolean;
    readonly standardMaterialShadowReceiverResources?: StandardFrameShadowReceiverResources | undefined;
    readonly autoStandardMaterialShadowReceiverResources?: boolean;
    readonly standardMaterialIblResources?: StandardFrameIblResources | undefined;
    readonly localLightCookieResources?: LocalLightClusterCookieResources | null | undefined;
    readonly phaseTimer: WebGpuAppRenderPhaseTimer;
}): Promise<WebGpuAppRenderReport>;
export {};
//# sourceMappingURL=mixed-custom-wgsl-frame.d.ts.map