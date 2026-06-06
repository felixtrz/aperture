import type {
  BoundsPacket,
  EnvironmentPacket,
  FogPacket,
  InstanceAttributePacket,
  LightPacket,
  MeshDrawPacket,
  ParticleEmitterPacket,
  QuadBatchPacket,
  RenderQueue,
  ShadowRequestPacket,
  SkyboxPacket,
  SpriteDrawPacket,
  UiHitRegionPacket,
  UiNodePacket,
  ViewPacket,
} from "./snapshot-packet-types.js";
import type { QuadSnapshotBuffers } from "./quad-snapshot.js";
import type {
  RenderDiagnostic,
  RenderSnapshotReport,
} from "./snapshot-diagnostic-types.js";

// RenderSnapshot is intentionally made of structured-clone-friendly packet arrays
// and packed numeric buffers so the same shape can cross a future Worker boundary.
export interface RenderSnapshot {
  readonly frame: number;
  readonly views: readonly ViewPacket[];
  readonly meshDraws: readonly MeshDrawPacket[];
  readonly spriteDraws?: readonly SpriteDrawPacket[];
  readonly particleEmitters?: readonly ParticleEmitterPacket[];
  readonly quads?: QuadSnapshotBuffers;
  readonly quadBatches?: readonly QuadBatchPacket[];
  readonly uiNodes?: readonly UiNodePacket[];
  readonly uiHitRegions?: readonly UiHitRegionPacket[];
  readonly skyboxes?: readonly SkyboxPacket[];
  readonly fogs?: readonly FogPacket[];
  readonly lights: readonly LightPacket[];
  readonly environments: readonly EnvironmentPacket[];
  readonly shadowRequests: readonly ShadowRequestPacket[];
  readonly bounds: readonly BoundsPacket[];
  readonly transforms: Float32Array;
  readonly bones?: Float32Array;
  readonly morphTargetWeights?: Float32Array;
  /**
   * Flat, target-major morph deltas for the N-target storage-buffer render path.
   * Each morphed draw's slice begins at its `morphDeltaOffset` and holds
   * `targetCount * vertexCount * 3` position floats followed by the same count of
   * normal floats.
   */
  readonly morphTargetDeltas?: Float32Array;
  /**
   * Per-instance morph descriptors, four `u32` per world-transform slot
   * (`weightOffset, targetCount, deltaOffset, vertexCount`) indexed by the
   * shader's `instance_index`. Zeroed for non-morphed instances.
   */
  readonly morphInstanceDescriptors?: Uint32Array;
  readonly instanceTints?: Float32Array;
  readonly instanceAttributes?: Float32Array;
  readonly instanceAttributePackets?: readonly InstanceAttributePacket[];
  readonly viewMatrices: Float32Array;
  readonly diagnostics: readonly RenderDiagnostic[];
  readonly report: RenderSnapshotReport;
}

export interface RenderSortKeyInput {
  readonly queue?: RenderQueue;
  readonly viewId?: number;
  readonly layer?: number;
  readonly order?: number;
  readonly pipelineKey?: string;
  readonly materialKey?: string;
  readonly meshKey?: string;
  readonly depth?: number;
  readonly stableId: number;
}
