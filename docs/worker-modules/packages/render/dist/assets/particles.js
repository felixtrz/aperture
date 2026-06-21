import { SpriteBlendMode } from "../rendering/authoring-types.js";
const DEFAULT_CURVE_SAMPLE_COUNT = 16;
export function createParticleEffectAsset(input = {}) {
    const sizeOverLifetime = sortedCurve(input.sizeOverLifetime ?? [
        { t: 0, value: 1 },
        { t: 1, value: 1 },
    ]);
    const colorOverLifetime = sortedGradient(input.colorOverLifetime ?? [
        { t: 0, color: input.startColor ?? [1, 1, 1, 1] },
        { t: 1, color: input.endColor ?? input.startColor ?? [1, 1, 1, 1] },
    ]);
    const asset = {
        kind: "particle-effect",
        label: input.label ?? "ParticleEffect",
        capacity: Math.trunc(input.capacity ?? 1024),
        duration: input.duration ?? 5,
        looping: input.looping ?? true,
        prewarm: input.prewarm ?? false,
        emissionRate: input.emissionRate ?? 64,
        bursts: [...(input.bursts ?? [])].map((burst) => ({
            time: burst.time,
            count: Math.trunc(burst.count),
        })),
        lifetime: range(input.lifetime, 1, 1),
        startSpeed: range(input.startSpeed, 0, 0),
        startSize: range(input.startSize, 1, 1),
        startColor: tuple4(input.startColor ?? [1, 1, 1, 1]),
        endColor: tuple4(input.endColor ?? input.startColor ?? [1, 1, 1, 1]),
        gravity: tuple3(input.gravity ?? [0, 0, 0]),
        linearDamping: input.linearDamping ?? 0,
        blendMode: input.blendMode ?? SpriteBlendMode.Additive,
        ...(input.texture === undefined ? {} : { texture: input.texture }),
        ...(input.sampler === undefined ? {} : { sampler: input.sampler }),
        atlasFrameCount: Math.trunc(input.atlasFrameCount ?? 1),
        sizeOverLifetime,
        colorOverLifetime,
    };
    return Object.freeze({
        ...asset,
        curves: packParticleEffectCurves({
            sizeOverLifetime,
            colorOverLifetime,
            sampleCount: input.curveSampleCount ?? DEFAULT_CURVE_SAMPLE_COUNT,
        }),
        runtimeFeatures: analyzeParticleEffectRuntimeFeatures(input),
    });
}
export function analyzeParticleEffectRuntimeFeatures(input = {}) {
    const supportedFields = new Set();
    const partiallySupportedFields = new Set();
    const unsupportedFields = new Set();
    const diagnostics = [];
    for (const field of Object.keys(input)) {
        switch (field) {
            case "label":
                supportedFields.add(field);
                break;
            case "capacity":
            case "startSize":
            case "startColor":
            case "endColor":
            case "blendMode":
            case "texture":
            case "sampler":
            case "sizeOverLifetime":
            case "colorOverLifetime":
            case "curveSampleCount":
                supportedFields.add(field);
                break;
            case "lifetime": {
                const lifetime = input.lifetime;
                const min = lifetime?.min;
                const max = lifetime?.max;
                if (typeof min === "number" &&
                    typeof max === "number" &&
                    Number.isFinite(min) &&
                    Number.isFinite(max) &&
                    min !== max) {
                    partiallySupportedFields.add(field);
                    diagnostics.push(runtimeFeatureDiagnostic({
                        code: "particleEffect.partiallySupportedFeature",
                        field,
                        severity: "info",
                        supportedModes: ["burst"],
                        unsupportedModes: ["continuous"],
                        message: "Particle lifetime ranges are honored by worker-emitted bursts; continuous GPU emitters currently use lifetime.max only.",
                    }));
                }
                else {
                    supportedFields.add(field);
                }
                break;
            }
            case "startSpeed":
                partiallySupportedFields.add(field);
                diagnostics.push(runtimeFeatureDiagnostic({
                    code: "particleEffect.partiallySupportedFeature",
                    field,
                    severity: "info",
                    supportedModes: ["continuous"],
                    unsupportedModes: ["burst"],
                    message: "Continuous GPU emitters currently use startSpeed.max as spawn spread radius; worker-emitted bursts use this.particles.emit(...).velocity instead.",
                }));
                break;
            case "gravity":
                partiallySupportedFields.add(field);
                diagnostics.push(runtimeFeatureDiagnostic({
                    code: "particleEffect.partiallySupportedFeature",
                    field,
                    severity: "info",
                    supportedModes: ["burst"],
                    unsupportedModes: ["continuous"],
                    message: "Particle gravity is applied by worker-emitted bursts; continuous GPU emitters currently ignore gravity.",
                }));
                break;
            case "linearDamping":
                partiallySupportedFields.add(field);
                diagnostics.push(runtimeFeatureDiagnostic({
                    code: "particleEffect.partiallySupportedFeature",
                    field,
                    severity: "info",
                    supportedModes: ["burst"],
                    unsupportedModes: ["continuous"],
                    message: "Particle linearDamping is applied by worker-emitted bursts; continuous GPU emitters currently ignore damping.",
                }));
                break;
            case "atlasFrameCount": {
                const frameCount = input.atlasFrameCount;
                if (typeof frameCount === "number" &&
                    Number.isFinite(frameCount) &&
                    Math.trunc(frameCount) <= 1) {
                    supportedFields.add(field);
                }
                else {
                    unsupportedFields.add(field);
                    diagnostics.push(runtimeFeatureDiagnostic({
                        code: "particleEffect.unsupportedFeature",
                        field,
                        severity: "warning",
                        supportedModes: [],
                        unsupportedModes: ["burst", "continuous"],
                        message: "Particle texture atlas animation is not implemented yet; atlasFrameCount values above 1 are accepted for authoring but ignored by the renderer.",
                    }));
                }
                break;
            }
            case "duration":
                unsupportedFields.add(field);
                diagnostics.push(runtimeFeatureDiagnostic({
                    code: "particleEffect.unsupportedFeature",
                    field,
                    severity: "warning",
                    supportedModes: [],
                    unsupportedModes: ["burst", "continuous"],
                    message: "Particle effect duration is not implemented yet; burst lifetime is controlled by lifetime and continuous emitters do not stop by duration.",
                }));
                break;
            case "looping":
                unsupportedFields.add(field);
                diagnostics.push(runtimeFeatureDiagnostic({
                    code: "particleEffect.unsupportedFeature",
                    field,
                    severity: "warning",
                    supportedModes: [],
                    unsupportedModes: ["burst", "continuous"],
                    message: "Particle looping lifecycle is not implemented yet; continuous emitters currently loop implicitly and bursts are explicitly queued by systems.",
                }));
                break;
            case "prewarm":
                unsupportedFields.add(field);
                diagnostics.push(runtimeFeatureDiagnostic({
                    code: "particleEffect.unsupportedFeature",
                    field,
                    severity: "warning",
                    supportedModes: [],
                    unsupportedModes: ["burst", "continuous"],
                    message: "Particle prewarm is not implemented yet; emitters start cold.",
                }));
                break;
            case "emissionRate":
                unsupportedFields.add(field);
                diagnostics.push(runtimeFeatureDiagnostic({
                    code: "particleEffect.unsupportedFeature",
                    field,
                    severity: "warning",
                    supportedModes: [],
                    unsupportedModes: ["burst", "continuous"],
                    message: "Particle emissionRate scheduling is not implemented yet; continuous emitters draw their active capacity and bursts are emitted explicitly from systems.",
                }));
                break;
            case "bursts":
                unsupportedFields.add(field);
                diagnostics.push(runtimeFeatureDiagnostic({
                    code: "particleEffect.unsupportedFeature",
                    field,
                    severity: "warning",
                    supportedModes: [],
                    unsupportedModes: ["burst", "continuous"],
                    message: "Asset-authored particle burst schedules are not implemented yet; use this.particles.emit(...) for worker-authored bursts.",
                }));
                break;
            default:
                break;
        }
    }
    return {
        version: 1,
        supportedFields: [...supportedFields].sort(),
        partiallySupportedFields: [...partiallySupportedFields].sort(),
        unsupportedFields: [...unsupportedFields].sort(),
        diagnostics,
    };
}
export function validateParticleEffectAsset(asset) {
    const diagnostics = [];
    if (!positiveInteger(asset.capacity)) {
        diagnostics.push(diagnostic("particleEffect.invalidCapacity", "capacity"));
    }
    if (!positiveFinite(asset.duration)) {
        diagnostics.push(diagnostic("particleEffect.invalidDuration", "duration"));
    }
    if (!nonNegativeFinite(asset.emissionRate)) {
        diagnostics.push(diagnostic("particleEffect.invalidEmissionRate", "emissionRate"));
    }
    validateRange(asset.lifetime, "lifetime", diagnostics);
    validateRange(asset.startSpeed, "startSpeed", diagnostics);
    validateRange(asset.startSize, "startSize", diagnostics);
    if (!nonNegativeFinite(asset.linearDamping)) {
        diagnostics.push(diagnostic("particleEffect.invalidLinearDamping", "linearDamping"));
    }
    if (!positiveInteger(asset.atlasFrameCount)) {
        diagnostics.push(diagnostic("particleEffect.invalidAtlasFrameCount", "atlasFrameCount"));
    }
    for (let index = 0; index < asset.bursts.length; index += 1) {
        const burst = asset.bursts[index];
        if (!nonNegativeFinite(burst.time) || !positiveInteger(burst.count)) {
            diagnostics.push(diagnostic("particleEffect.invalidBurst", `bursts.${index}`));
        }
    }
    validateCurve(asset.sizeOverLifetime, "sizeOverLifetime", diagnostics);
    validateGradient(asset.colorOverLifetime, "colorOverLifetime", diagnostics);
    return { valid: diagnostics.length === 0, diagnostics };
}
export function packParticleEffectCurves(input) {
    const sampleCount = Math.max(2, Math.trunc(input.sampleCount ?? DEFAULT_CURVE_SAMPLE_COUNT));
    const size = new Float32Array(sampleCount);
    const color = new Float32Array(sampleCount * 4);
    for (let index = 0; index < sampleCount; index += 1) {
        const t = sampleCount === 1 ? 0 : index / (sampleCount - 1);
        const sampledColor = sampleGradient(input.colorOverLifetime, t);
        size[index] = sampleCurve(input.sizeOverLifetime, t);
        color[index * 4] = sampledColor[0];
        color[index * 4 + 1] = sampledColor[1];
        color[index * 4 + 2] = sampledColor[2];
        color[index * 4 + 3] = sampledColor[3];
    }
    return {
        sampleCount,
        sizeOverLifetime: size,
        colorOverLifetime: color,
    };
}
export function particleEffectDependencies(asset) {
    const dependencies = [];
    if (asset.texture !== undefined && asset.texture !== null) {
        dependencies.push(asset.texture);
    }
    if (asset.sampler !== undefined && asset.sampler !== null) {
        dependencies.push(asset.sampler);
    }
    return dependencies;
}
function range(input, fallbackMin, fallbackMax) {
    const min = input?.min ?? fallbackMin;
    const max = input?.max ?? input?.min ?? fallbackMax;
    return { min, max };
}
function sortedCurve(curve) {
    return [...curve].sort((a, b) => a.t - b.t);
}
function sortedGradient(gradient) {
    return [...gradient].sort((a, b) => a.t - b.t);
}
function sampleCurve(curve, t) {
    if (curve.length === 0) {
        return 1;
    }
    const first = curve[0];
    const last = curve[curve.length - 1];
    if (t <= first.t) {
        return first.value;
    }
    if (t >= last.t) {
        return last.value;
    }
    for (let index = 1; index < curve.length; index += 1) {
        const next = curve[index];
        const previous = curve[index - 1];
        if (t <= next.t) {
            const span = Math.max(0.000001, next.t - previous.t);
            const f = (t - previous.t) / span;
            return previous.value + (next.value - previous.value) * f;
        }
    }
    return last.value;
}
function sampleGradient(gradient, t) {
    if (gradient.length === 0) {
        return [1, 1, 1, 1];
    }
    const first = gradient[0];
    const last = gradient[gradient.length - 1];
    if (t <= first.t) {
        return tuple4(first.color);
    }
    if (t >= last.t) {
        return tuple4(last.color);
    }
    for (let index = 1; index < gradient.length; index += 1) {
        const next = gradient[index];
        const previous = gradient[index - 1];
        if (t <= next.t) {
            const span = Math.max(0.000001, next.t - previous.t);
            const f = (t - previous.t) / span;
            const a = tuple4(previous.color);
            const b = tuple4(next.color);
            return [
                lerp(a[0], b[0], f),
                lerp(a[1], b[1], f),
                lerp(a[2], b[2], f),
                lerp(a[3], b[3], f),
            ];
        }
    }
    return tuple4(last.color);
}
function validateRange(rangeValue, field, diagnostics) {
    if (!Number.isFinite(rangeValue.min) ||
        !Number.isFinite(rangeValue.max) ||
        rangeValue.min < 0 ||
        rangeValue.max < rangeValue.min) {
        diagnostics.push(diagnostic("particleEffect.invalidRange", field));
    }
}
function validateCurve(curve, field, diagnostics) {
    if (curve.length === 0 ||
        curve.some((key, index) => !Number.isFinite(key.t) ||
            key.t < 0 ||
            key.t > 1 ||
            !Number.isFinite(key.value) ||
            (index > 0 && key.t < (curve[index - 1]?.t ?? 0)))) {
        diagnostics.push(diagnostic("particleEffect.invalidCurve", field));
    }
}
function validateGradient(gradient, field, diagnostics) {
    if (gradient.length === 0 ||
        gradient.some((key, index) => !Number.isFinite(key.t) ||
            key.t < 0 ||
            key.t > 1 ||
            !tuple4(key.color).every(Number.isFinite) ||
            (index > 0 && key.t < (gradient[index - 1]?.t ?? 0)))) {
        diagnostics.push(diagnostic("particleEffect.invalidGradient", field));
    }
}
function diagnostic(code, field) {
    return {
        code,
        field,
        message: `${field} is not valid for a GPU particle effect.`,
    };
}
function runtimeFeatureDiagnostic(diagnostic) {
    return diagnostic;
}
function positiveInteger(value) {
    return Number.isInteger(value) && value > 0;
}
function positiveFinite(value) {
    return Number.isFinite(value) && value > 0;
}
function nonNegativeFinite(value) {
    return Number.isFinite(value) && value >= 0;
}
function tuple3(value) {
    return [value[0] ?? 0, value[1] ?? 0, value[2] ?? 0];
}
function tuple4(value) {
    return [value[0] ?? 0, value[1] ?? 0, value[2] ?? 0, value[3] ?? 0];
}
function lerp(a, b, t) {
    return a + (b - a) * t;
}
//# sourceMappingURL=particles.js.map