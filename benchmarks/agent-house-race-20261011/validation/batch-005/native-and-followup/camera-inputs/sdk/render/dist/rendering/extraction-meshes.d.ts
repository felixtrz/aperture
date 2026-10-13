import { type AssetRegistry, type EcsWorld } from "@aperture-engine/simulation";
import { type BoundsPacket, type FogPacket, type InstanceAttributePacket, type MeshDrawPacket, type RenderDiagnostic } from "./snapshot.js";
import { type ViewCullContext } from "./extraction-culling.js";
import { type RenderExtractionCache } from "./extraction-mesh-cache.js";
export { createRenderExtractionCache, type RenderExtractionCache, } from "./extraction-mesh-cache.js";
export interface MeshDrawExtractionOptions {
    readonly frustumCull?: boolean;
    readonly requireShadowCaster?: boolean;
    readonly diagnoseLayerMismatch?: boolean;
}
export declare function extractMeshDraws(world: EcsWorld, assets: AssetRegistry, transforms: number[], bones: number[], morphTargetWeights: number[], morphTargetDeltas: number[], morphInstanceDescriptors: number[], instanceTints: number[], instanceAttributes: number[], instanceAttributePackets: InstanceAttributePacket[], bounds: BoundsPacket[], diagnostics: RenderDiagnostic[], cameraLayerMask: number, fogs: readonly FogPacket[], viewCullContexts: readonly ViewCullContext[], _viewCullSignature: number, cache: RenderExtractionCache | undefined, options?: MeshDrawExtractionOptions): MeshDrawPacket[];
//# sourceMappingURL=extraction-meshes.d.ts.map