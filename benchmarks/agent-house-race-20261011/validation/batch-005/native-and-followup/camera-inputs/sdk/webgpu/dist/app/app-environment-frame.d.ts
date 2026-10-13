import { type AssetRegistry, type EnvironmentMapHandle } from "@aperture-engine/simulation";
import type { RenderSnapshot } from "@aperture-engine/render";
import type { StandardFrameIblResources } from "../materials/standard/standard-frame-resources.js";
import { type WebGpuAppEnvironmentAssetInput } from "./app-environment-resources.js";
export interface WebGpuAppEnvironmentFramePreparer {
    /**
     * Resolve prepared IBL resources for the snapshot's active environment, or
     * undefined when the snapshot references no environment or no matching
     * ready environment-map asset exists in the registry.
     */
    resolve(snapshot: RenderSnapshot): StandardFrameIblResources | undefined;
    dispose(): void;
}
export declare function firstSnapshotEnvironmentHandle(snapshot: RenderSnapshot): EnvironmentMapHandle | null;
export declare function environmentAssetInputsFromRegistry(registry: AssetRegistry): WebGpuAppEnvironmentAssetInput[];
export declare function createWebGpuAppEnvironmentFramePreparer(options: {
    readonly app: object;
    readonly registry: AssetRegistry;
}): WebGpuAppEnvironmentFramePreparer;
//# sourceMappingURL=app-environment-frame.d.ts.map