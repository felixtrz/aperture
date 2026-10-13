import { type AssetRegistry, type EcsWorld } from "@aperture-engine/simulation";
import { type BoundsPacket, type QuadBatchPacket, type RenderDiagnostic, type SpriteDrawPacket } from "./snapshot.js";
import { type ViewCullContext } from "./extraction-culling.js";
export declare function extractSpriteDraws(world: EcsWorld, assets: AssetRegistry, transforms: number[], bounds: BoundsPacket[], diagnostics: RenderDiagnostic[], cameraLayerMask: number, viewCullContexts: readonly ViewCullContext[], quadInstanceFloats: number[], quadInstanceWords: number[], quadBatches: QuadBatchPacket[]): SpriteDrawPacket[];
//# sourceMappingURL=extraction-sprites.d.ts.map