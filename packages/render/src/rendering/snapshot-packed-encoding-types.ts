import type { SnapshotPacketEncodingRegistry } from "./snapshot-packed-registry.js";
import type {
  BoundsPacket,
  EnvironmentPacket,
  LightPacket,
  MeshDrawPacket,
  QuadBatchPacket,
  RenderSnapshot,
  ShadowRequestPacket,
  ViewPacket,
} from "./snapshot.js";

export interface SnapshotPacketBundle {
  readonly views: readonly ViewPacket[];
  readonly meshDraws: readonly MeshDrawPacket[];
  readonly shadowCasterDraws?: readonly MeshDrawPacket[];
  readonly lights: readonly LightPacket[];
  readonly environments: readonly EnvironmentPacket[];
  readonly shadowRequests: readonly ShadowRequestPacket[];
  readonly bounds: readonly BoundsPacket[];
  readonly quadBatches?: readonly QuadBatchPacket[];
}

export interface EncodeSnapshotPacketsOptions {
  readonly registry?: SnapshotPacketEncodingRegistry;
  readonly buffer?: Uint32Array;
}

export interface EncodedSnapshotPackets {
  readonly words: Uint32Array;
  readonly registry: SnapshotPacketEncodingRegistry;
  readonly counts: {
    readonly views: number;
    readonly meshDraws: number;
    readonly shadowCasterDraws: number;
    readonly lights: number;
    readonly environments: number;
    readonly shadowRequests: number;
    readonly bounds: number;
    readonly quadBatches: number;
  };
  readonly wordLength: number;
  readonly byteLength: number;
}

export type SnapshotPacketEncodingInput =
  | SnapshotPacketBundle
  | Pick<
      RenderSnapshot,
      | "views"
      | "meshDraws"
      | "shadowCasterDraws"
      | "lights"
      | "environments"
      | "shadowRequests"
      | "bounds"
      | "quadBatches"
    >;
