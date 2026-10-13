import type { BoundsPacket, EnvironmentPacket, LightPacket, MeshDrawPacket, ProceduralSkyPacket, RenderSnapshot, RuntimeUniformPacket, ShadowRequestPacket, ViewPacket } from "./snapshot.js";
import type { PacketSnapshot } from "./snapshot-change-set-compare.js";
export declare function viewPackets(snapshot: RenderSnapshot | null | undefined): PacketSnapshot<ViewPacket>;
export declare function meshDrawPackets(snapshot: RenderSnapshot | null | undefined): PacketSnapshot<MeshDrawPacket>;
export declare function shadowCasterDrawPackets(snapshot: RenderSnapshot | null | undefined): PacketSnapshot<MeshDrawPacket>;
export declare function lightPackets(snapshot: RenderSnapshot | null | undefined): PacketSnapshot<LightPacket>;
export declare function environmentPackets(snapshot: RenderSnapshot | null | undefined): PacketSnapshot<EnvironmentPacket>;
export declare function proceduralSkyPackets(snapshot: RenderSnapshot | null | undefined): PacketSnapshot<ProceduralSkyPacket>;
export declare function runtimeUniformPackets(snapshot: RenderSnapshot | null | undefined): PacketSnapshot<RuntimeUniformPacket>;
export declare function shadowRequestPackets(snapshot: RenderSnapshot | null | undefined): PacketSnapshot<ShadowRequestPacket>;
export declare function boundsPackets(snapshot: RenderSnapshot | null | undefined): PacketSnapshot<BoundsPacket>;
//# sourceMappingURL=snapshot-change-set-packets.d.ts.map