import type { AssetRegistry } from "@aperture-engine/simulation";
import { type PackedPreviousSnapshotTransformHistoryReport, type PackedSnapshotPreviousTransforms, type PackedSnapshotTransformHistoryUpdateReport, type PackedSnapshotTransforms, type RenderSnapshot } from "@aperture-engine/render";
import type { WebGpuAppPostPassCache } from "./resource-cache.js";
import { type WorldTransformGpuBufferResource } from "../resources/transforms/world-transform-buffer.js";
import type { WebGpuApp, WebGpuAppMotionVectorFallbackReason, WebGpuAppMotionVectorReport } from "./app.js";
interface WebGpuAppSceneMotionVectorPlan {
    readonly required: boolean;
    readonly colorFormat: string | null;
    readonly fallbackReason?: WebGpuAppMotionVectorFallbackReason;
}
export declare function createWebGpuAppSceneMotionVectorPlan(options: {
    readonly app: WebGpuApp;
    readonly assets: AssetRegistry;
    readonly snapshot: RenderSnapshot;
}): WebGpuAppSceneMotionVectorPlan;
interface WebGpuAppPreviousObjectTransformResourceResult {
    readonly resource: WorldTransformGpuBufferResource | null;
    readonly packed: PackedSnapshotPreviousTransforms | null;
    readonly history: PackedPreviousSnapshotTransformHistoryReport;
    readonly diagnostics: readonly unknown[];
}
export declare function prepareWebGpuAppPreviousObjectTransformResource(options: {
    readonly device: unknown;
    readonly cache: WebGpuAppPostPassCache;
    readonly currentTransforms: PackedSnapshotTransforms;
    readonly required: boolean;
}): WebGpuAppPreviousObjectTransformResourceResult;
export declare function createWebGpuAppMotionVectorReport(options: {
    readonly plan: WebGpuAppSceneMotionVectorPlan;
    readonly objectHistory: PackedPreviousSnapshotTransformHistoryReport;
    readonly resource: WorldTransformGpuBufferResource | null;
    readonly update: PackedSnapshotTransformHistoryUpdateReport;
}): WebGpuAppMotionVectorReport;
export declare function encodePostPassMotionVectorClearColor(options: {
    readonly snapshot: RenderSnapshot;
    readonly view: RenderSnapshot["views"][number];
    readonly cache: Pick<WebGpuAppPostPassCache, "previousViewProjectionByViewId">;
}): readonly [number, number, number, number];
export declare function rememberCurrentViewProjectionMatrices(snapshot: RenderSnapshot, previousViewProjectionByViewId: Map<number, Float32Array>): void;
export {};
//# sourceMappingURL=motion-vectors.d.ts.map