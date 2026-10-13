export function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
export function isTuple3(value) {
    return (Array.isArray(value) &&
        value.length === 3 &&
        value.every((entry) => typeof entry === "number" && Number.isFinite(entry)));
}
export function isTuple4(value) {
    return (Array.isArray(value) &&
        value.length === 4 &&
        value.every((entry) => typeof entry === "number" && Number.isFinite(entry)));
}
//# sourceMappingURL=gltf-ecs-command-replay-value-guards.js.map