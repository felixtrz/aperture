import type { Entity, Mat4 } from "@aperture-engine/simulation";
import type { MeshAsset } from "../mesh/index.js";
import type { InstanceAttributePacket, RenderDiagnostic } from "./snapshot.js";
import { type SkinExtraction } from "./extraction-mesh-deformation.js";
export interface MeshDrawMorphInputs {
    readonly targetCount: number;
    readonly vertexCount: number;
    readonly weightOffset: number;
    readonly deltaOffset: number;
}
export interface MeshDrawExtractionInputs {
    readonly worldTransformOffset: number;
    readonly instanceTintOffset: number | undefined;
    readonly instanceAttributePacketIndex: number | undefined;
    readonly skinning: SkinExtraction | undefined;
    readonly morph: MeshDrawMorphInputs | undefined;
    readonly boneMatrixOffset: number | undefined;
}
export declare function readMeshDrawExtractionInputs(input: {
    readonly entity: Entity;
    readonly mesh: MeshAsset;
    readonly worldMatrix: Mat4;
    readonly transforms: number[];
    readonly bones: number[];
    readonly morphTargetWeights: number[];
    readonly morphTargetDeltas: number[];
    readonly morphInstanceDescriptors: number[];
    readonly instanceTints: number[];
    readonly instanceAttributes: number[];
    readonly instanceAttributePackets: InstanceAttributePacket[];
    readonly diagnostics: RenderDiagnostic[];
}): MeshDrawExtractionInputs | null;
//# sourceMappingURL=extraction-mesh-draw-inputs.d.ts.map