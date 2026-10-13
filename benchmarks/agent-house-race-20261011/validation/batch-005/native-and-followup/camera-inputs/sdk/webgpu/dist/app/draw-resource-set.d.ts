import type { RenderSnapshot } from "@aperture-engine/render";
export interface WebGpuAppDrawResourceSet {
    readonly index: number;
    readonly meshKey: string;
    readonly materialKey: string;
    readonly drawIndices: readonly number[];
    readonly renderIds: readonly number[];
}
export interface WebGpuAppDrawResourceSetPlan {
    readonly sets: readonly WebGpuAppDrawResourceSet[];
    readonly drawCount: number;
}
export declare function createWebGpuAppDrawResourceSetPlan(snapshot: RenderSnapshot): WebGpuAppDrawResourceSetPlan;
//# sourceMappingURL=draw-resource-set.d.ts.map