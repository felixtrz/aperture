import type { ViewPacket } from "./snapshot.js";
import type { SnapshotPacketEncodingRegistry } from "./snapshot-packed-registry.js";
export declare function writeViewPacket(words: Uint32Array, offset: number, packet: ViewPacket, registry: SnapshotPacketEncodingRegistry): void;
export declare function readViewPacket(words: Uint32Array, offset: number, registry: SnapshotPacketEncodingRegistry): ViewPacket;
//# sourceMappingURL=snapshot-packed-view-codec.d.ts.map