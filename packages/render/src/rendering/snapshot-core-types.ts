import type {
  AudioEmitterPacket,
  AudioListenerPacket,
  BoundsPacket,
  DebugLinesSnapshot,
  DecalPacket,
  EnvironmentPacket,
  FogPacket,
  InstanceAttributePacket,
  LightPacket,
  LinePacket,
  MeshDrawPacket,
  ParticleEmitterPacket,
  PointsPacket,
  ProceduralSkyPacket,
  QuadBatchPacket,
  RenderQueue,
  RuntimeBufferPacket,
  RuntimeUniformPacket,
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
  /**
   * Simulation/extraction time in seconds. Older hand-built test snapshots may
   * omit this; render paths should fall back conservatively when absent.
   */
  readonly time?: number;
  readonly views: readonly ViewPacket[];
  readonly meshDraws: readonly MeshDrawPacket[];
  /**
   * Shadow-caster mesh packets extracted independently of main camera frustum
   * culling. Main rendering uses `meshDraws`; shadow passes use this family
   * when present so off-camera casters can still contribute to shadow maps.
   */
  readonly shadowCasterDraws?: readonly MeshDrawPacket[];
  readonly spriteDraws?: readonly SpriteDrawPacket[];
  /**
   * Projected decal packets (D4). Absent when a frame carries no decals so a
   * scene without decals is byte-identical to a pre-D4 snapshot. Already capped
   * + eviction-resolved (oldest-first) at extraction; the count and eviction
   * tally ride `report.decals`.
   */
  readonly decals?: readonly DecalPacket[];
  /**
   * Fat-line (Line2-style) packets (E1). Absent when a frame carries no lines
   * so a line-free snapshot is byte-identical to a pre-E1 snapshot. Vertex data
   * rides the transferable `lineVertices` family.
   */
  readonly lines?: readonly LinePacket[];
  /** Flat local-space polyline vertices (xyz per vertex) referenced by `lines`. */
  readonly lineVertices?: Float32Array;
  /**
   * Point-cloud (PointsMaterial-style) packets (E1). Absent when a frame
   * carries no points. Vertex/color data rides the transferable
   * `pointVertices`/`pointColors` families.
   */
  readonly points?: readonly PointsPacket[];
  /** Flat local-space point positions (xyz per point) referenced by `points`. */
  readonly pointVertices?: Float32Array;
  /** Flat per-point RGBA colors (four per point) referenced by `points`. */
  readonly pointColors?: Float32Array;
  /**
   * Immediate-mode debug-draw line soup (E3). Transient per-frame overlay
   * geometry accumulated by the `debugDraw` API and rendered through the shared
   * E1 fat-line pipeline. Absent when a frame draws no debug primitives so a
   * debug-free snapshot is byte-identical to a pre-E3 snapshot. Rides the
   * transferable transport (see `hasUnsupportedSharedSnapshotPayload`).
   */
  readonly debugLines?: DebugLinesSnapshot;
  readonly particleEmitters?: readonly ParticleEmitterPacket[];
  readonly audioEmitters?: readonly AudioEmitterPacket[];
  readonly audioListener?: AudioListenerPacket;
  readonly quads?: QuadSnapshotBuffers;
  readonly quadBatches?: readonly QuadBatchPacket[];
  readonly uiNodes?: readonly UiNodePacket[];
  readonly uiHitRegions?: readonly UiHitRegionPacket[];
  readonly skyboxes?: readonly SkyboxPacket[];
  readonly proceduralSkies?: readonly ProceduralSkyPacket[];
  readonly runtimeUniforms?: readonly RuntimeUniformPacket[];
  readonly runtimeBuffers?: readonly RuntimeBufferPacket[];
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
