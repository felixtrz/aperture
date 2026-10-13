import { type AssetRegistry } from "@aperture-engine/simulation";
import type { MeshAsset, PackedSnapshotTransforms, PackedSnapshotViewUniforms, RenderSnapshot, UnlitMaterialAsset } from "@aperture-engine/render";
import { type CreateMultiMaterialUnlitFrameGpuResourcesResult } from "../materials/unlit/unlit-frame-resources.js";
import type { WebGpuAppPipelineLayouts } from "./pipeline-layouts.js";
import type { WebGpuAppDrawResourceSetPlan } from "./draw-resource-set.js";
import type { WebGpuAppResourceReuseReport } from "./app.js";
interface WebGpuAppMultiUnlitContext {
    readonly initialization: {
        readonly device: unknown;
    };
}
export interface MultiUnlitAppResourceSet {
    readonly mesh: MeshAsset;
    readonly meshKey: string;
    readonly materials: readonly UnlitMaterialAsset[];
    readonly materialKeys: readonly string[];
}
export declare function createMultiUnlitAppFrameResources(options: {
    readonly app: WebGpuAppMultiUnlitContext;
    readonly mesh: MeshAsset | null;
    readonly materials: readonly UnlitMaterialAsset[];
    readonly viewUniforms: PackedSnapshotViewUniforms;
    readonly worldTransforms: PackedSnapshotTransforms;
    readonly layouts: WebGpuAppPipelineLayouts;
    readonly reuse: WebGpuAppResourceReuseReport;
}): CreateMultiMaterialUnlitFrameGpuResourcesResult;
export declare function collectMultiUnlitAppResourceSet(options: {
    readonly assets: AssetRegistry;
    readonly snapshot: RenderSnapshot;
    readonly plan: WebGpuAppDrawResourceSetPlan;
    readonly firstDraw: RenderSnapshot["meshDraws"][number];
}): MultiUnlitAppResourceSet | null;
export {};
//# sourceMappingURL=multi-unlit.d.ts.map