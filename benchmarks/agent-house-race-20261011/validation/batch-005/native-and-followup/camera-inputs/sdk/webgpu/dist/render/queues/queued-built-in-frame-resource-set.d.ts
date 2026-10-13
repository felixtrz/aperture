import type { PackedSnapshotInstanceTints, PackedSnapshotTransforms, PackedSnapshotViewUniforms } from "@aperture-engine/render";
import { type BindGroupResourceCache, type BindGroupResourceCacheReport } from "../../gpu/bind-group-resource-cache.js";
import { type QueuedBuiltInFrameResource } from "../../materials/core/built-in-material-app-resource-adapter.js";
import type { QueuedBuiltInAppResourceItem, QueuedBuiltInAppResourceSet } from "./queued-built-in-app-resource-set.js";
import type { PreparedMaterialTextureSamplerDependencies } from "../../materials/core/prepared-material-texture-sampler-dependencies.js";
import type { DebugNormalFrameGpuResources } from "../../materials/debug-normal/debug-normal-frame-resources.js";
import type { LightBindGroupResource } from "../../lighting/light-bind-group.js";
import type { MatcapFrameGpuResources } from "../../materials/matcap/matcap-frame-resources.js";
import type { StandardFrameGpuResources } from "../../materials/standard/standard-frame-resources.js";
import type { StandardLightShadowBindGroupResource } from "../../materials/standard/standard-light-shadow-bind-group.js";
import type { UnlitFrameGpuResources } from "../../materials/unlit/unlit-frame-resources.js";
import type { UnlitBindGroupResource } from "../../materials/unlit/unlit-bind-group.js";
import { type QueuedMaterialFrameResourceScratch, type QueuedMaterialPipelineResourceView } from "./queued-material-frame-resource-set.js";
import { type QueuedMaterialFrameResourceBucketSummary, type QueuedMaterialFrameResourceBuckets } from "./queued-material-frame-resource-buckets.js";
import { type QueuedMaterialFrameResourceResultLike, type QueuedMaterialFrameResourceRouteShell } from "./queued-material-frame-resource-route.js";
import { type QueuedMaterialFrameResourceRouteAppDiagnostic } from "./queued-material-frame-resource-route-diagnostics.js";
export interface QueuedBuiltInFrameResources {
    readonly mesh: UnlitFrameGpuResources["mesh"];
    readonly viewUniform: UnlitFrameGpuResources["viewUniform"];
    readonly worldTransforms: UnlitFrameGpuResources["worldTransforms"];
    readonly meshResources: readonly UnlitFrameGpuResources["mesh"][];
    readonly unlit: readonly UnlitFrameGpuResources[];
    readonly matcap: readonly MatcapFrameGpuResources[];
    readonly standard: readonly StandardFrameGpuResources[];
    readonly debugNormal: readonly DebugNormalFrameGpuResources[];
    readonly byFamily: QueuedMaterialFrameResourceBuckets<QueuedBuiltInFrameResource>;
    readonly byFamilySummary: readonly QueuedMaterialFrameResourceBucketSummary[];
    readonly bindGroups: readonly UnlitFrameGpuResources["bindGroups"][number][];
    readonly bindGroupReuse: QueuedBuiltInBindGroupReuseReport;
}
export interface QueuedBuiltInBindGroupReuseReport {
    readonly created: number;
    readonly reused: number;
    readonly cached: number;
    readonly shared: BindGroupResourceCacheReport;
    readonly lights: BindGroupResourceCacheReport;
    readonly standardLightShadows: BindGroupResourceCacheReport;
}
export interface CreateQueuedBuiltInFrameResourcesResult {
    readonly valid: boolean;
    readonly resources: QueuedBuiltInFrameResources | null;
    readonly bindGroupReuse: QueuedBuiltInBindGroupReuseReport;
    readonly diagnostics: readonly unknown[];
}
export type QueuedBuiltInFrameResourceRouteDiagnostic = QueuedMaterialFrameResourceRouteAppDiagnostic;
export type QueuedBuiltInPipelineResourceView = QueuedMaterialPipelineResourceView;
export interface QueuedBuiltInFrameResourceScratch<TPipelinePlanResult> extends QueuedMaterialFrameResourceScratch<TPipelinePlanResult, UnlitFrameGpuResources["mesh"], UnlitFrameGpuResources["bindGroups"][number]> {
    readonly unlit: UnlitFrameGpuResources[];
    readonly matcap: MatcapFrameGpuResources[];
    readonly standard: StandardFrameGpuResources[];
    readonly debugNormal: DebugNormalFrameGpuResources[];
    readonly byFamily: QueuedMaterialFrameResourceBuckets<QueuedBuiltInFrameResource>;
    readonly sharedBindGroupCache: BindGroupResourceCache<UnlitBindGroupResource>;
    readonly lightBindGroupCache: BindGroupResourceCache<LightBindGroupResource>;
    readonly standardLightShadowBindGroupCache: BindGroupResourceCache<StandardLightShadowBindGroupResource>;
}
export interface PrepareQueuedBuiltInFrameResourceSetCallbacks<TPipelineResult, TPipelinePlanResult, TPipelineLayouts, TFrameOptions> {
    getPipeline(item: QueuedBuiltInAppResourceItem): Promise<TPipelineResult> | TPipelineResult;
    onPipelineLookupReuse?(input: {
        readonly item: QueuedBuiltInAppResourceItem;
        readonly pipeline: TPipelineResult;
        readonly pipelineKey: string;
        readonly pipelineLookupKey: string;
    }): void;
    getPipelineView(pipeline: TPipelineResult): QueuedBuiltInPipelineResourceView;
    getPipelineResourceKey?(input: {
        readonly item: QueuedBuiltInAppResourceItem;
        readonly pipeline: TPipelineResult;
    }): string;
    createPipelinePlanResult(input: {
        readonly item: QueuedBuiltInAppResourceItem;
        readonly pipeline: TPipelineResult;
    }): TPipelinePlanResult;
    getPipelineLayouts(input: {
        readonly item: QueuedBuiltInAppResourceItem;
        readonly pipeline: TPipelineResult;
        readonly getBindGroupLayout: (group: number) => unknown;
    }): TPipelineLayouts;
    prepareTextureSamplerDependencies(input: {
        readonly item: QueuedBuiltInAppResourceItem;
    }): PreparedMaterialTextureSamplerDependencies;
    getTextureSamplerDependenciesLookupKey?(item: QueuedBuiltInAppResourceItem): string | null;
    onTextureSamplerDependenciesReuse?(input: {
        readonly item: QueuedBuiltInAppResourceItem;
        readonly dependencies: PreparedMaterialTextureSamplerDependencies;
        readonly lookupKey: string;
    }): void;
    createFrameResourceOptions(input: {
        readonly item: QueuedBuiltInAppResourceItem;
        readonly textureSamplerDependencies: PreparedMaterialTextureSamplerDependencies;
        readonly viewUniforms: PackedSnapshotViewUniforms;
        readonly worldTransforms: PackedSnapshotTransforms;
        readonly instanceTints?: PackedSnapshotInstanceTints | null;
        readonly layouts: TPipelineLayouts;
        readonly sharedBindGroupCache: BindGroupResourceCache<UnlitBindGroupResource>;
        readonly lightBindGroupCache: BindGroupResourceCache<LightBindGroupResource>;
        readonly standardLightShadowBindGroupCache: BindGroupResourceCache<StandardLightShadowBindGroupResource>;
    }): TFrameOptions;
}
export interface PrepareQueuedBuiltInFrameResourceSetOptions<TPipelineResult, TPipelinePlanResult, TPipelineLayouts, TFrameOptions> {
    readonly resourceSet: QueuedBuiltInAppResourceSet;
    readonly scratch: QueuedBuiltInFrameResourceScratch<TPipelinePlanResult>;
    readonly viewUniforms: PackedSnapshotViewUniforms;
    readonly worldTransforms: PackedSnapshotTransforms;
    readonly instanceTints?: PackedSnapshotInstanceTints | null;
    readonly callbacks: PrepareQueuedBuiltInFrameResourceSetCallbacks<TPipelineResult, TPipelinePlanResult, TPipelineLayouts, TFrameOptions>;
}
export interface PrepareQueuedBuiltInFrameResourceSetResult<TPipelineResult, TPipelinePlanResult> {
    readonly valid: boolean;
    readonly resources: QueuedBuiltInFrameResources | null;
    readonly resourcesResult: CreateQueuedBuiltInFrameResourcesResult;
    readonly diagnostics: readonly unknown[];
    readonly pipelineResults: readonly TPipelinePlanResult[];
    readonly firstPipeline: TPipelineResult | null;
    readonly pipelineKeysByRenderId: ReadonlyMap<number, string>;
    readonly meshResourceKeys: ReadonlyMap<string, string>;
    readonly materialResourceKeys: ReadonlyMap<string, string>;
}
export declare function createQueuedBuiltInFrameResourceScratch<TPipelinePlanResult>(): QueuedBuiltInFrameResourceScratch<TPipelinePlanResult>;
export declare function prepareQueuedBuiltInFrameResourceSet<TPipelineResult, TPipelinePlanResult, TPipelineLayouts, TFrameOptions>(options: PrepareQueuedBuiltInFrameResourceSetOptions<TPipelineResult, TPipelinePlanResult, TPipelineLayouts, TFrameOptions>): Promise<PrepareQueuedBuiltInFrameResourceSetResult<TPipelineResult, TPipelinePlanResult>>;
export declare function createQueuedBuiltInFrameResourceRouteShell(input: {
    readonly item: QueuedBuiltInAppResourceItem;
    readonly resources: QueuedMaterialFrameResourceResultLike<unknown>;
}): QueuedMaterialFrameResourceRouteShell;
export declare function createQueuedBuiltInFrameResourceRouteDiagnostic(route: QueuedMaterialFrameResourceRouteShell): QueuedBuiltInFrameResourceRouteDiagnostic;
//# sourceMappingURL=queued-built-in-frame-resource-set.d.ts.map