import {
  materialPipelineKeyInputToKey,
  type MaterialPipelineKeyInput,
} from "../materials/index.js";
import type { MeshTopology } from "../mesh/index.js";
import type { BatchCompatibilityKey } from "./snapshot-types.js";

export function createBatchCompatibilityKey(input: {
  readonly materialPipeline: MaterialPipelineKeyInput;
  readonly materialKey: string;
  readonly meshLayoutKey: string;
  readonly topology: MeshTopology;
  readonly instanced?: boolean;
  readonly skinned?: boolean;
  readonly morphed?: boolean;
}): BatchCompatibilityKey {
  return {
    pipelineKey: materialPipelineKeyInputToKey(input.materialPipeline),
    materialKey: input.materialKey,
    meshLayoutKey: input.meshLayoutKey,
    topology: input.topology,
    instanced: input.instanced ?? false,
    skinned: input.skinned ?? false,
    morphed: input.morphed ?? false,
  };
}
