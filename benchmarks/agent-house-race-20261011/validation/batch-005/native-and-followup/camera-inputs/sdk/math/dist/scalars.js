export function read(values, index, label) {
    const value = values[index];
    if (value === undefined) {
        throw new RangeError(`${label} is missing numeric value at index ${index}.`);
    }
    return value;
}
export function v3(values, index) {
    return read(values, index, "Vec3Like");
}
export function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}
export function clamp01(value) {
    return clamp(value, 0, 1);
}
export function lerp(from, to, t) {
    return from + (to - from) * t;
}
export function inverseLerp(value, inMin, inMax) {
    const span = inMax - inMin;
    return span === 0 ? 0 : (value - inMin) / span;
}
export function remap(value, inMin, inMax, outMin, outMax) {
    return lerp(outMin, outMax, inverseLerp(value, inMin, inMax));
}
export function remapClamped(value, inMin, inMax, outMin, outMax) {
    return lerp(outMin, outMax, clamp01(inverseLerp(value, inMin, inMax)));
}
export function expSmoothingAlpha(delta, smoothing) {
    return 1 - Math.exp(-Math.max(0, delta) * Math.max(0, smoothing));
}
export function lerpAngle(from, to, t) {
    let diff = to - from;
    while (diff > Math.PI)
        diff -= Math.PI * 2;
    while (diff < -Math.PI)
        diff += Math.PI * 2;
    return from + diff * t;
}
export function hexColor(hex, alpha = 1) {
    return [
        ((hex >> 16) & 0xff) / 255,
        ((hex >> 8) & 0xff) / 255,
        (hex & 0xff) / 255,
        alpha,
    ];
}
export function assertFinitePositive(value, label) {
    assertFiniteNumber(value, label);
    if (value <= 0) {
        throw new RangeError(`Expected ${label} to be greater than zero.`);
    }
}
export function assertFiniteNumber(value, label) {
    if (!Number.isFinite(value)) {
        throw new RangeError(`Expected ${label} to be finite.`);
    }
}
//# sourceMappingURL=scalars.js.map