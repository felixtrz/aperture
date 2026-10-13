import type { EnvironmentPacket, LightPacket, ShadowRequestPacket } from "./snapshot.js";
import type { SnapshotPacketEncodingRegistry } from "./snapshot-packed-registry.js";
export declare function writeLightPacket(words: Uint32Array, offset: number, packet: LightPacket, registry: SnapshotPacketEncodingRegistry): void;
export declare function readLightPacket(words: Uint32Array, offset: number, registry: SnapshotPacketEncodingRegistry): LightPacket;
export declare function writeEnvironmentPacket(words: Uint32Array, offset: number, packet: EnvironmentPacket, registry: SnapshotPacketEncodingRegistry): void;
export declare function readEnvironmentPacket(words: Uint32Array, offset: number, registry: SnapshotPacketEncodingRegistry): EnvironmentPacket;
export declare function writeShadowRequestPacket(words: Uint32Array, offset: number, packet: ShadowRequestPacket): void;
export declare function readShadowRequestPacket(words: Uint32Array, offset: number): ShadowRequestPacket;
//# sourceMappingURL=snapshot-packed-light-codec.d.ts.map