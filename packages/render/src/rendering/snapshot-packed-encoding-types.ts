import type { SnapshotPacketEncodingRegistry } from "./snapshot-packed-registry.js";
import type {
  AudioEmitterPacket,
  AudioListenerPacket,
  BoundsPacket,
  EnvironmentPacket,
  FogPacket,
  LightPacket,
  MeshDrawPacket,
  ParticleEmitterPacket,
  ProceduralSkyPacket,
  QuadBatchPacket,
  RenderSnapshot,
  RuntimeUniformPacket,
  ShadowRequestPacket,
  ViewPacket,
} from "./snapshot.js";

export interface SnapshotPacketBundle {
  readonly views: readonly ViewPacket[];
  readonly meshDraws: readonly MeshDrawPacket[];
  readonly shadowCasterDraws?: readonly MeshDrawPacket[];
  readonly lights: readonly LightPacket[];
  readonly environments: readonly EnvironmentPacket[];
  readonly fogs?: readonly FogPacket[];
  readonly particleEmitters?: readonly ParticleEmitterPacket[];
  readonly audioEmitters?: readonly AudioEmitterPacket[];
  readonly audioListener?: AudioListenerPacket;
  readonly shadowRequests: readonly ShadowRequestPacket[];
  readonly bounds: readonly BoundsPacket[];
  readonly quadBatches?: readonly QuadBatchPacket[];
  readonly proceduralSkies?: readonly ProceduralSkyPacket[];
  readonly runtimeUniforms?: readonly RuntimeUniformPacket[];
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
    readonly fogs: number;
    readonly particleEmitters: number;
    readonly audioEmitters: number;
    readonly audioListeners: number;
    readonly shadowRequests: number;
    readonly bounds: number;
    readonly quadBatches: number;
    readonly proceduralSkies: number;
    readonly runtimeUniforms: number;
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
      | "fogs"
      | "particleEmitters"
      | "audioEmitters"
      | "audioListener"
      | "shadowRequests"
      | "bounds"
      | "quadBatches"
      | "proceduralSkies"
      | "runtimeUniforms"
    >;
