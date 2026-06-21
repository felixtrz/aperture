import { createAudioEmitter } from "./authoring-create-audio.js";
export function validateAudioEmitterInput(input) {
    const emitter = createAudioEmitter(input);
    const diagnostics = [];
    if ((emitter.clipId ?? "").trim().length === 0) {
        diagnostics.push(diagnostic("audio.invalidClip", "clip"));
    }
    if ((emitter.busId ?? "").trim().length === 0) {
        diagnostics.push(diagnostic("audio.invalidBusId", "busId"));
    }
    if (!nonNegativeFinite(emitter.gain)) {
        diagnostics.push(diagnostic("audio.invalidGain", "gain"));
    }
    if (!positiveFinite(emitter.timeScale)) {
        diagnostics.push(diagnostic("audio.invalidTimeScale", "timeScale"));
    }
    if (!positiveFinite(emitter.refDistance) ||
        !positiveFinite(emitter.maxDistance) ||
        (emitter.maxDistance ?? 0) < (emitter.refDistance ?? 0)) {
        diagnostics.push(diagnostic("audio.invalidDistance", "distance"));
    }
    if (!nonNegativeFinite(emitter.rolloffFactor)) {
        diagnostics.push(diagnostic("audio.invalidRolloff", "rolloffFactor"));
    }
    if (!coneValid(emitter.coneInnerAngle, emitter.coneOuterAngle, emitter.coneOuterGain)) {
        diagnostics.push(diagnostic("audio.invalidCone", "cone"));
    }
    // 0 means "disabled — use maxDistance for virtualization"; only a negative or
    // non-finite radius is invalid.
    if (!nonNegativeFinite(emitter.audibilityRadius)) {
        diagnostics.push(diagnostic("audio.invalidAudibilityRadius", "audibilityRadius"));
    }
    if (!positiveFinite(emitter.lowpassFrequency) ||
        !positiveFinite(emitter.lowpassQ)) {
        diagnostics.push(diagnostic("audio.invalidLowpass", "lowpass"));
    }
    return { valid: diagnostics.length === 0, diagnostics };
}
function diagnostic(code, field) {
    return {
        code,
        field,
        message: `${field} is not valid for an audio emitter.`,
    };
}
function coneValid(inner, outer, outerGain) {
    const innerAngle = inner ?? 360;
    const outerAngle = outer ?? 360;
    const gain = outerGain ?? 0;
    return (Number.isFinite(innerAngle) &&
        Number.isFinite(outerAngle) &&
        innerAngle >= 0 &&
        outerAngle >= innerAngle &&
        outerAngle <= 360 &&
        gain >= 0 &&
        gain <= 1);
}
function positiveFinite(value) {
    return value !== undefined && Number.isFinite(value) && value > 0;
}
function nonNegativeFinite(value) {
    return value !== undefined && Number.isFinite(value) && value >= 0;
}
//# sourceMappingURL=authoring-validation-audio.js.map