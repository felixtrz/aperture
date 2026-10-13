import type { Entity } from "@aperture-engine/simulation";
import type { MeshDrawMorphInputs } from "./extraction-mesh-draw-inputs.js";
import type { BoundsPacket, MeshDrawPacket } from "./snapshot.js";
import { type RenderExtractionCache, type MeshDrawEntityCacheScope } from "./extraction-mesh-cache.js";
export interface WriteMeshDrawEntityCacheInput {
    readonly cache: RenderExtractionCache | undefined;
    readonly cacheScope?: MeshDrawEntityCacheScope;
    readonly cacheKey: string;
    readonly entity: Entity;
    readonly entityVersion: number;
    readonly transformVersion: number;
    readonly assetSignature: string | null;
    readonly cameraLayerMask: number;
    readonly viewCullSignature: number;
    readonly layerMask: number;
    readonly worldMatrix: readonly number[];
    readonly entityDraws: readonly MeshDrawPacket[];
    readonly diagnosticsStart: number;
    readonly diagnosticsCount: number;
    readonly bounds: readonly BoundsPacket[];
    readonly boundsIndex: number;
    readonly instanceTints: readonly number[];
    readonly instanceTintOffset: number | undefined;
    readonly morph: MeshDrawMorphInputs | undefined;
}
export declare function writeMeshDrawEntityCache(input: WriteMeshDrawEntityCacheInput): void;
//# sourceMappingURL=extraction-mesh-cache-writeback.d.ts.map