import { type AssetRegistry, type Entity, type MaterialHandle, type MeshHandle } from "@aperture-engine/simulation";
import type { MeshAsset } from "../mesh/index.js";
import { type FogPacket, type MeshDrawPacket, type RenderDiagnostic } from "./snapshot.js";
import type { SkinExtraction } from "./extraction-mesh-deformation.js";
import type { MeshDrawMorphInputs } from "./extraction-mesh-draw-inputs.js";
export interface MeshSubmeshDrawExtractionInput {
    readonly assets: AssetRegistry;
    readonly entity: Entity;
    readonly mesh: MeshAsset;
    readonly meshHandle: MeshHandle;
    readonly primaryMaterialHandle: MaterialHandle | null;
    readonly materialSlots: ReadonlyMap<number, MaterialHandle>;
    readonly diagnostics: RenderDiagnostic[];
    readonly worldTransformOffset: number;
    readonly instanceTintOffset?: number;
    readonly instanceAttributePacketIndex?: number;
    readonly boneMatrixOffset?: number;
    readonly skinning?: SkinExtraction;
    readonly morph?: MeshDrawMorphInputs;
    readonly boundsIndex: number;
    readonly layerMask: number;
    readonly castsShadow: boolean;
    readonly receivesShadow: boolean;
    readonly occlusionQuery: boolean;
    readonly sortViewId: number;
    readonly sortDepth: number;
    readonly fogs: readonly FogPacket[];
}
export declare function createMeshSubmeshDraws(input: MeshSubmeshDrawExtractionInput): MeshDrawPacket[];
//# sourceMappingURL=extraction-mesh-submeshes.d.ts.map