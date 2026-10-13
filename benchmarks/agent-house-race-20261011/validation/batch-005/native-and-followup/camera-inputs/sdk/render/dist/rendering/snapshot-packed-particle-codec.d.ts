import type { ParticleEmitterPacket } from "./snapshot.js";
import type { SnapshotPacketEncodingRegistry } from "./snapshot-packed-registry.js";
export declare function writeParticleEmitterPacket(words: Uint32Array, offset: number, packet: ParticleEmitterPacket, registry: SnapshotPacketEncodingRegistry): void;
export declare function readParticleEmitterPacket(words: Uint32Array, offset: number, registry: SnapshotPacketEncodingRegistry): ParticleEmitterPacket;
//# sourceMappingURL=snapshot-packed-particle-codec.d.ts.map