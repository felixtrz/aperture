import { type AssetRegistry, type EcsWorld } from "@aperture-engine/simulation";
import type { AudioEmitterPacket, AudioListenerPacket, RenderDiagnostic } from "./snapshot.js";
/**
 * Extract intent-only audio emitters into per-frame packets. Unlike particle
 * emitters, audio is NOT frustum-culled (an off-screen / behind-the-camera
 * source must still be heard); audibility virtualization is a main-side concern
 * (AU-9). Each emitter's WORLD matrix rides the shared `transforms` array via
 * `worldTransformOffset`, exactly like a particle emitter.
 */
export declare function extractAudioEmitters(world: EcsWorld, assets: AssetRegistry, transforms: number[], diagnostics: RenderDiagnostic[]): AudioEmitterPacket[];
/**
 * Extract the single active {@link AudioListener}. The first active listener
 * wins (Bevy semantics); any additional active listener gets a diagnostic and
 * is ignored. Camera fallback when no listener exists lands in AU-5.
 */
export declare function extractAudioListener(world: EcsWorld, transforms: number[], diagnostics: RenderDiagnostic[], hasEmitters: boolean): AudioListenerPacket | undefined;
//# sourceMappingURL=extraction-audio.d.ts.map