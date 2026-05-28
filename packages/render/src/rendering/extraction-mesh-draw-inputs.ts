import type { Entity, Mat4 } from "@aperture-engine/simulation";
import type { MeshAsset } from "../mesh/index.js";
import type { InstanceAttributePacket, RenderDiagnostic } from "./snapshot.js";
import {
  pushBoneMatrices,
  pushMorphTargetWeights,
  readMorphTargetWeights,
  readSkinning,
  type SkinExtraction,
} from "./extraction-mesh-deformation.js";
import {
  pushInstanceAttributePacket,
  pushInstanceTint,
} from "./extraction-mesh-instances.js";
import { pushMatrix } from "./extraction-matrices.js";

export interface MeshDrawExtractionInputs {
  readonly worldTransformOffset: number;
  readonly instanceTintOffset: number | undefined;
  readonly instanceAttributePacketIndex: number | undefined;
  readonly skinning: SkinExtraction | undefined;
  readonly morphWeights: readonly [number, number, number, number] | undefined;
  readonly boneMatrixOffset: number | undefined;
}

export function readMeshDrawExtractionInputs(input: {
  readonly entity: Entity;
  readonly mesh: MeshAsset;
  readonly worldMatrix: Mat4;
  readonly transforms: number[];
  readonly bones: number[];
  readonly morphTargetWeights: number[];
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

  const morphWeights = readMorphTargetWeights(
    input.entity,
    input.mesh,
    input.diagnostics,
  );

  if (morphWeights === null) {
    return null;
  }

  if (morphWeights !== undefined) {
    pushMorphTargetWeights(
      input.morphTargetWeights,
      worldTransformOffset,
      morphWeights,
    );
  }

  return {
    worldTransformOffset,
    instanceTintOffset,
    instanceAttributePacketIndex,
    skinning,
    morphWeights,
    boneMatrixOffset:
      skinning === undefined
        ? undefined
        : pushBoneMatrices(input.bones, skinning),
  };
}
