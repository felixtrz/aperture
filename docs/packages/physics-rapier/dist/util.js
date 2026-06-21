export function requireWorld(world, initialized) {
    if (!initialized || world === null) {
        throw new Error("Rapier physics backend must be initialized before use.");
    }
    return world;
}
export function requireEventQueue(eventQueue, initialized) {
    if (!initialized || eventQueue === null) {
        throw new Error("Rapier physics backend must be initialized before use.");
    }
    return eventQueue;
}
export function freeRapierObject(value) {
    const free = value.free;
    if (typeof free === "function") {
        free.call(value);
    }
}
export function performanceNow() {
    return typeof performance === "undefined" ? 0 : performance.now();
}
export function finitePositive(value, fallback) {
    return value !== undefined && Number.isFinite(value) && value > 0
        ? value
        : fallback;
}
export function finiteNonNegative(value) {
    return value !== undefined && Number.isFinite(value) && value >= 0
        ? value
        : 0;
}
//# sourceMappingURL=util.js.map