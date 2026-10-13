import type { Entity, Mat4 } from "@aperture-engine/simulation";
import type { MeshAsset } from "../mesh/index.js";
import type { InstanceAttributePacket, RenderDiagnostic } from "./snapshot.js";
import {
  pushBoneMatrices,
  pushMorphInstanceDescriptor,
  pushMorphTargetDeltas,
  pushMorphTargetWeights,
  readMorphTargetWeights,
  readSkinning,
  type MorphExtraction,
  type SkinExtraction,
} from "./extraction-mesh-deformation.js";
import {
  pushInstanceAttributePacket,
  pushInstanceTint,
} from "./extraction-mesh-instances.js";
import { pushMatrix } from "./extraction-matrices.js";

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

export function readMeshDrawExtractionInputs(input: {
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
}): MeshDrawExtractionInputs | null {
  const worldTransformOffset = pushMatrix(input.transforms, input.worldMatrix);
  const instanceTintOffset = pushInstanceTint(
    input.instanceTints,
    input.entity,
  );
  const instanceAttributePacketIndex = pushInstanceAttributePacket(
    input.instanceAttributes,
    input.instanceAttributePackets,
    input.diagnostics,
    input.entity,
  );
  const skinning = readSkinning(input.entity, input.mesh, input.diagnostics);

  if (skinning === null) {
    return null;
  }

  const morphExtraction = readMorphTargetWeights(
    input.entity,
    input.mesh,
    input.diagnostics,
  );

  if (morphExtraction === null) {
    return null;
  }

  const morph =
    morphExtraction === undefined
      ? undefined
      : packMorph(input, worldTransformOffset, morphExtraction);

  return {
    worldTransformOffset,
    instanceTintOffset,
    instanceAttributePacketIndex,
    skinning,
    morph,
    boneMatrixOffset:
      skinning === undefined
        ? undefined
        : pushBoneMatrices(input.bones, skinning),
  };
}

function packMorph(
  input: {
    readonly morphTargetWeights: number[];
    readonly morphTargetDeltas: number[];
    readonly morphInstanceDescriptors: number[];
  },
  worldTransformOffset: number,
  morph: MorphExtraction,
): MeshDrawMorphInputs {
  const weightOffset = pushMorphTargetWeights(input.morphTargetWeights, morph);
  const deltaOffset = pushMorphTargetDeltas(input.morphTargetDeltas, morph);
  pushMorphInstanceDescriptor(
    input.morphInstanceDescriptors,
    worldTransformOffset,
    {
      weightOffset,
      targetCount: morph.targetCount,
      deltaOffset,
      vertexCount: morph.vertexCount,
    },
  );

  return {
    targetCount: morph.targetCount,
    vertexCount: morph.vertexCount,
    weightOffset,
    deltaOffset,
  };
}
