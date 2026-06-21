import { assetHandleKey, } from "@aperture-engine/simulation";
import { AudioDistanceModel, AudioPanningModel, AudioSimulationSpace, } from "./authoring-types.js";
import { AudioEmitter } from "./authoring-components.js";
export function createAudioEmitter(input) {
    return {
        clipId: assetHandleKey(input.clip),
        busId: input.busId ?? "sfx",
        gain: input.gain ?? 1,
        timeScale: input.timeScale ?? 1,
        loop: input.loop ?? false,
        autoplay: input.autoplay ?? false,
        playEpoch: input.playEpoch ?? 0,
        stopEpoch: input.stopEpoch ?? 0,
        seed: input.seed ?? 1,
        priority: input.priority ?? 0,
        muted: input.muted ?? false,
        offsetSec: input.offsetSec ?? 0,
        loopStart: input.loopStart ?? 0,
        loopEnd: input.loopEnd ?? 0,
        simulationSpace: input.simulationSpace ?? AudioSimulationSpace.World,
        panningModel: input.panningModel ?? AudioPanningModel.EqualPower,
        distanceModel: input.distanceModel ?? AudioDistanceModel.Inverse,
        refDistance: input.refDistance ?? 1,
        maxDistance: input.maxDistance ?? 10000,
        rolloffFactor: input.rolloffFactor ?? 1,
        coneInnerAngle: input.coneInnerAngle ?? 360,
        coneOuterAngle: input.coneOuterAngle ?? 360,
        coneOuterGain: input.coneOuterGain ?? 0,
        boundsCenter: [
            input.boundsCenter?.[0] ?? 0,
            input.boundsCenter?.[1] ?? 0,
            input.boundsCenter?.[2] ?? 0,
        ],
        audibilityRadius: input.audibilityRadius ?? 0,
        occlusion: input.occlusion ?? 0,
        lowpassFrequency: input.lowpassFrequency ?? 22000,
        lowpassQ: input.lowpassQ ?? 0.7,
        active: input.active ?? true,
    };
}
export function createAudioListener(input = {}) {
    return {
        active: input.active ?? true,
        masterGain: input.masterGain ?? 1,
    };
}
/**
 * Fire a one-shot on an existing {@link AudioEmitter} by bumping its monotonic
 * `playEpoch` counter — the discrete-intent trigger the main-thread engine
 * realizes as `(playEpoch − lastRealized)` voices. Returns the new epoch. Wraps
 * as Int32 to compose with the engine's wrapping signed-delta.
 */
export function bumpAudioPlayEpoch(entity) {
    const next = (toEpoch(entity.getValue(AudioEmitter, "playEpoch")) + 1) | 0;
    entity.setValue(AudioEmitter, "playEpoch", next);
    return next;
}
/**
 * Request a click-free fade-stop of an emitter's sustained voice by bumping its
 * monotonic `stopEpoch` counter. Returns the new epoch.
 */
export function stopAudioEmitter(entity) {
    const next = (toEpoch(entity.getValue(AudioEmitter, "stopEpoch")) + 1) | 0;
    entity.setValue(AudioEmitter, "stopEpoch", next);
    return next;
}
function toEpoch(value) {
    return Number.isInteger(value) ? value | 0 : 0;
}
//# sourceMappingURL=authoring-create-audio.js.map