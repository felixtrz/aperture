import type { AssetRegistry, EcsWorld } from "@aperture-engine/simulation";
import { type RenderSnapshot } from "./snapshot.js";
import { type RenderExtractionCache } from "./extraction-meshes.js";
export { createRenderExtractionCache, type RenderExtractionCache, } from "./extraction-meshes.js";
export interface RenderExtractionOptions {
    readonly frame?: number;
    readonly time?: number;
    readonly cache?: RenderExtractionCache;
    readonly features?: RenderExtractionFeatureOptions;
}
export interface RenderExtractionFeatureOptions {
    readonly particles?: boolean;
    readonly ui?: boolean;
}
export declare function extractRenderSnapshot(world: EcsWorld, assets: AssetRegistry, options?: RenderExtractionOptions): RenderSnapshot;
//# sourceMappingURL=extraction.d.ts.map