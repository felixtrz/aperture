import type { AssetRegistry } from "@aperture-engine/simulation";
import type { PackedSnapshotInstanceTints, PackedSnapshotTransforms, PackedSnapshotViewUniforms, RenderSnapshot } from "@aperture-engine/render";
import type { BindGroupResourceCache } from "../gpu/bind-group-resource-cache.js";
import type { LightBindGroupResource } from "../lighting/light-bind-group.js";
import type { PreparedBuiltInMaterialStore } from "../materials/core/prepared-built-in-material-store.js";
import { type PreparedMaterialTextureSamplerDependencies } from "../materials/core/prepared-material-texture-sampler-dependencies.js";
import type { StandardAreaLightLtcResources } from "../materials/standard/standard-area-light-ltc-resource.js";
import type { StandardLightShadowBindGroupResource } from "../materials/standard/standard-light-shadow-bind-group.js";
import type { StandardFrameIblResources, StandardFrameShadowReceiverResources, StandardFrameTransmissionSceneColorResources } from "../materials/standard/standard-frame-resources.js";
import type { UnlitBindGroupResource } from "../materials/unlit/unlit-bind-group.js";
import type { LocalLightClusterCookieResources } from "../lighting/local-light-cookie-resources.js";
import type { WorldTransformGpuBufferResource } from "../resources/transforms/world-transform-buffer.js";
import type { ViewUniformGpuBufferResource } from "../resources/views/view-uniform-buffer-resource.js";
import type { QueuedBuiltInAppResourceItem, QueuedBuiltInAppResourceSet } from "../render/queues/queued-built-in-app-resource-set.js";
import { type CreateQueuedBuiltInFrameResourcesResult, type QueuedBuiltInFrameResources } from "../render/queues/queued-built-in-frame-resource-set.js";
import type { WebGpuAppResourceCache, WebGpuAppPipelinePlanResult } from "./resource-cache.js";
import type { WebGpuAppPipelineLayouts } from "./pipeline-layouts.js";
import type { WebGpuApp, WebGpuAppPipelineResourceResult, WebGpuAppResourceReuseReport } from "./app.js";
export type QueuedBuiltInAppResourcePreparationCache = Omit<WebGpuAppResourceCache, "preparedMaterials">;
export interface QueuedBuiltInFrameResourcePreparationOptions {
    readonly app: WebGpuApp;
    readonly assets: AssetRegistry;
    readonly cache: QueuedBuiltInAppResourcePreparationCache;
    readonly preparedMaterials: PreparedBuiltInMaterialStore;
    readonly snapshot: RenderSnapshot;
    readonly resourceLifetimeFrame: number;
    readonly item: QueuedBuiltInAppResourceItem;
    readonly textureSamplerDependencies: PreparedMaterialTextureSamplerDependencies;
    readonly viewUniforms: PackedSnapshotViewUniforms;
    readonly worldTransforms: PackedSnapshotTransforms;
    readonly preparedViewUniform: ViewUniformGpuBufferResource;
    readonly preparedWorldTransforms: WorldTransformGpuBufferResource;
    readonly previousWorldTransforms?: WorldTransformGpuBufferResource | null;
    readonly instanceTints?: PackedSnapshotInstanceTints | null;
    readonly layouts: WebGpuAppPipelineLayouts;
    readonly sharedBindGroupCache: BindGroupResourceCache<UnlitBindGroupResource>;
    readonly lightBindGroupCache: BindGroupResourceCache<LightBindGroupResource>;
    readonly standardLightShadowBindGroupCache: BindGroupResourceCache<StandardLightShadowBindGroupResource>;
    readonly standardMaterialShadowReceiverResources?: StandardFrameShadowReceiverResources | undefined;
    readonly standardMaterialIblResources?: StandardFrameIblResources | undefined;
    readonly standardAreaLightLtcResources?: StandardAreaLightLtcResources | null | undefined;
    readonly localLightCookieResources?: LocalLightClusterCookieResources | null | undefined;
    readonly transmissionSceneColorResources?: StandardFrameTransmissionSceneColorResources | null | undefined;
    readonly reuse: WebGpuAppResourceReuseReport;
}
export interface PrepareQueuedBuiltInFrameResourcesOptions {
    readonly app: WebGpuApp;
    readonly assets: AssetRegistry;
    readonly cache: WebGpuAppResourceCache;
    readonly snapshot: RenderSnapshot;
    readonly resourceLifetimeFrame?: number;
    readonly resourceSet: QueuedBuiltInAppResourceSet;
    readonly reuse: WebGpuAppResourceReuseReport;
    readonly viewUniforms: PackedSnapshotViewUniforms;
    readonly worldTransforms: PackedSnapshotTransforms;
    readonly previousWorldTransforms?: WorldTransformGpuBufferResource | null;
    readonly instanceTints?: PackedSnapshotInstanceTints | null;
    readonly standardMaterialShadowReceiverResources?: StandardFrameShadowReceiverResources | undefined;
    readonly standardMaterialIblResources?: StandardFrameIblResources | undefined;
    readonly standardAreaLightLtcResources?: StandardAreaLightLtcResources | null | undefined;
    readonly localLightCookieResources?: LocalLightClusterCookieResources | null | undefined;
    readonly transmissionSceneColorResources?: StandardFrameTransmissionSceneColorResources | null | undefined;
    getPipeline(item: QueuedBuiltInAppResourceItem): Promise<WebGpuAppPipelineResourceResult> | WebGpuAppPipelineResourceResult;
    getPipelineLayouts(input: {
        readonly item: QueuedBuiltInAppResourceItem;
        readonly pipeline: WebGpuAppPipelineResourceResult;
        readonly getBindGroupLayout: (group: number) => unknown;
    }): WebGpuAppPipelineLayouts;
}
export interface PrepareQueuedBuiltInFrameResourcesResult {
    readonly valid: boolean;
    readonly resources: QueuedBuiltInFrameResources | null;
    readonly resourcesResult: CreateQueuedBuiltInFrameResourcesResult;
    readonly diagnostics: readonly unknown[];
    readonly pipelineResults: readonly WebGpuAppPipelinePlanResult[];
    readonly firstPipeline: WebGpuAppPipelineResourceResult | null;
    readonly pipelineKeysByRenderId: ReadonlyMap<number, string>;
    readonly meshResourceKeys: ReadonlyMap<string, string>;
    readonly materialResourceKeys: ReadonlyMap<string, string>;
}
export declare function prepareQueuedBuiltInFrameResources(options: PrepareQueuedBuiltInFrameResourcesOptions): Promise<PrepareQueuedBuiltInFrameResourcesResult>;
//# sourceMappingURL=queued-frame-resources.d.ts.map