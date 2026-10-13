import { type ComponentInitialData, type Entity } from "@aperture-engine/simulation";
import { type AudioEmitterInput, type AudioListenerInput } from "./authoring-types.js";
import { AudioEmitter } from "./authoring-components.js";
import type { AudioListener } from "./authoring-components.js";
export declare function createAudioEmitter(input: AudioEmitterInput): ComponentInitialData<typeof AudioEmitter>;
export declare function createAudioListener(input?: AudioListenerInput): ComponentInitialData<typeof AudioListener>;
/**
 * Fire a one-shot on an existing {@link AudioEmitter} by bumping its monotonic
 * `playEpoch` counter — the discrete-intent trigger the main-thread engine
 * realizes as `(playEpoch − lastRealized)` voices. Returns the new epoch. Wraps
 * as Int32 to compose with the engine's wrapping signed-delta.
 */
export declare function bumpAudioPlayEpoch(entity: Entity): number;
/**
 * Request a click-free fade-stop of an emitter's sustained voice by bumping its
 * monotonic `stopEpoch` counter. Returns the new epoch.
 */
export declare function stopAudioEmitter(entity: Entity): number;
//# sourceMappingURL=authoring-create-audio.d.ts.map