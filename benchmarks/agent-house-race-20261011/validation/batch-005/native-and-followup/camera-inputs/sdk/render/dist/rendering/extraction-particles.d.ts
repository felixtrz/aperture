import { type AssetRegistry, type EcsWorld } from "@aperture-engine/simulation";
import { type ViewCullContext } from "./extraction-culling.js";
import { type BoundsPacket, type ParticleEmitterPacket, type RenderDiagnostic } from "./snapshot.js";
export declare function extractParticleEmitters(world: EcsWorld, assets: AssetRegistry, frame: number, time: number, transforms: number[], bounds: BoundsPacket[], diagnostics: RenderDiagnostic[], cameraLayerMask: number, viewCullContexts: readonly ViewCullContext[]): ParticleEmitterPacket[];
//# sourceMappingURL=extraction-particles.d.ts.map