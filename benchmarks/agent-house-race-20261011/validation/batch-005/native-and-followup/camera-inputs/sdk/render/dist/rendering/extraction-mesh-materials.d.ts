import type { Entity, MaterialHandle } from "@aperture-engine/simulation";
import { type MaterialPipelineKeyInput, type SourceMaterialAsset } from "../materials/index.js";
import { FogMode } from "./index.js";
import type { FogPacket, RenderDiagnostic, RenderQueue } from "./snapshot.js";
export declare function createExtractedMaterialPipelineKeyInput(input: {
    readonly base: MaterialPipelineKeyInput;
    readonly material: SourceMaterialAsset;
    readonly instanceTint: boolean;
    readonly skinned: boolean;
    readonly morphed: boolean;
    readonly fogMode?: FogMode | null;
}): MaterialPipelineKeyInput;
export declare function selectFogModeForLayer(layerMask: number, fogs: readonly FogPacket[]): FogMode | null;
export declare function readMaterialSlots(entity: Entity, diagnostics: RenderDiagnostic[]): Map<number, MaterialHandle>;
export declare function materialQueue(material: SourceMaterialAsset): RenderQueue;
//# sourceMappingURL=extraction-mesh-materials.d.ts.map