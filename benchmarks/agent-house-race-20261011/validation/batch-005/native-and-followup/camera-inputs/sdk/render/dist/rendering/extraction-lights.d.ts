import { type AssetRegistry, type EcsWorld } from "@aperture-engine/simulation";
import { type EnvironmentPacket, type LightPacket, type RenderDiagnostic, type ShadowRequestPacket } from "./snapshot.js";
export declare function extractLights(world: EcsWorld, assets: AssetRegistry, transforms: number[], diagnostics: RenderDiagnostic[], environments: EnvironmentPacket[], shadowRequests: ShadowRequestPacket[]): LightPacket[];
//# sourceMappingURL=extraction-lights.d.ts.map