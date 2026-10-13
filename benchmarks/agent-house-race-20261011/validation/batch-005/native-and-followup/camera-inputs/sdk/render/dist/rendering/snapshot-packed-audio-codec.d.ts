import type { AudioEmitterPacket, AudioListenerPacket } from "./snapshot.js";
import type { SnapshotPacketEncodingRegistry } from "./snapshot-packed-registry.js";
export declare function writeAudioEmitterPacket(words: Uint32Array, offset: number, packet: AudioEmitterPacket, registry: SnapshotPacketEncodingRegistry): void;
export declare function readAudioEmitterPacket(words: Uint32Array, offset: number, registry: SnapshotPacketEncodingRegistry): AudioEmitterPacket;
export declare function writeAudioListenerPacket(words: Uint32Array, offset: number, packet: AudioListenerPacket): void;
export declare function readAudioListenerPacket(words: Uint32Array, offset: number): AudioListenerPacket;
//# sourceMappingURL=snapshot-packed-audio-codec.d.ts.map