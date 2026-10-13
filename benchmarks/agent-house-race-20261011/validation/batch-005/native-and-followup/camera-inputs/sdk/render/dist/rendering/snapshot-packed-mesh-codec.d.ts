import type { MeshDrawPacket } from "./snapshot.js";
import type { SnapshotPacketEncodingRegistry } from "./snapshot-packed-registry.js";
export declare function writeMeshDrawPacket(words: Uint32Array, offset: number, packet: MeshDrawPacket, registry: SnapshotPacketEncodingRegistry): void;
export declare function readMeshDrawPacket(words: Uint32Array, offset: number, registry: SnapshotPacketEncodingRegistry): MeshDrawPacket;
//# sourceMappingURL=snapshot-packed-mesh-codec.d.ts.map