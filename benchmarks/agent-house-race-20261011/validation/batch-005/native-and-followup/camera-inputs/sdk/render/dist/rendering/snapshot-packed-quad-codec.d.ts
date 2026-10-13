import type { QuadBatchPacket } from "./snapshot.js";
import type { SnapshotPacketEncodingRegistry } from "./snapshot-packed-registry.js";
export declare function writeQuadBatchPacket(words: Uint32Array, offset: number, packet: QuadBatchPacket, registry: SnapshotPacketEncodingRegistry): void;
export declare function readQuadBatchPacket(words: Uint32Array, offset: number, registry: SnapshotPacketEncodingRegistry): QuadBatchPacket;
//# sourceMappingURL=snapshot-packed-quad-codec.d.ts.map