import type { PackedSnapshotTransforms, PackedTransformOffset, RenderWorldDrawPackage, RenderWorldDrawPackagePlan } from "@aperture-engine/render";
import { type WebGpuBufferDeviceLike } from "../../gpu/buffer.js";
import type { GetOrCreateRenderPipelineResult } from "../../gpu/pipeline-cache-integration.js";
import type { UnlitBindGroupResource } from "../../materials/unlit/unlit-bind-group.js";
import { type RenderPhaseBatchRunScratch } from "../phase/render-phase-batching.js";
export interface DrawOrderTransformPackingScratch {
    data: Float32Array;
    readonly selected: DrawOrderTransformSelectedPackage[];
    readonly worldTransformResourceKeyByRenderId: Map<number, string>;
    readonly bindGroups: UnlitBindGroupResource[];
    readonly offsets: PackedTransformOffset[];
    readonly batchRuns: RenderPhaseBatchRunScratch<RenderWorldDrawPackage>;
}
export interface DrawOrderTransformBufferCache {
    resource: DrawOrderTransformBufferResource | null;
    byteLength: number;
    lastData: Float32Array;
    readonly bindGroupsByPipelineKey: Map<string, UnlitBindGroupResource>;
}
export interface DrawOrderTransformBufferResource {
    readonly resourceKey: string;
    readonly buffer: unknown;
    readonly offsets: readonly PackedTransformOffset[];
}
interface DrawOrderTransformSelectedPackage {
    readonly drawPackage: RenderWorldDrawPackage;
    readonly resolvedPipelineKey: string;
    readonly sourceOffset: number;
    readonly packedOffset: number;
}
export interface PrepareDrawOrderTransformPackingOptions {
    readonly device: WebGpuBufferDeviceLike & {
        readonly createBindGroup?: (descriptor: unknown) => unknown;
    };
    readonly packages: RenderWorldDrawPackagePlan;
    readonly transforms: PackedSnapshotTransforms;
    readonly pipelines: readonly GetOrCreateRenderPipelineResult[];
    readonly pipelineKeysByRenderId?: ReadonlyMap<number, string>;
    readonly bindGroups: readonly UnlitBindGroupResource[];
    readonly cache: DrawOrderTransformBufferCache;
    readonly scratch: DrawOrderTransformPackingScratch;
}
export interface PrepareDrawOrderTransformPackingResult {
    readonly bindGroups: readonly UnlitBindGroupResource[];
    readonly worldTransformResourceKeyByRenderId: ReadonlyMap<number, string>;
}
export declare function createDrawOrderTransformPackingScratch(): DrawOrderTransformPackingScratch;
export declare function createDrawOrderTransformBufferCache(): DrawOrderTransformBufferCache;
export declare function prepareDrawOrderTransformPacking(options: PrepareDrawOrderTransformPackingOptions): PrepareDrawOrderTransformPackingResult | null;
export {};
//# sourceMappingURL=draw-order-transform-packing.d.ts.map