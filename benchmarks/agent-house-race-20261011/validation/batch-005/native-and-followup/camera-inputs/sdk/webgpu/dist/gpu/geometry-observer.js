const OBSERVERS = new WeakMap();
export function registerWebGpuGeometryDeviceObserver(device, observer) {
    OBSERVERS.set(device, observer);
    return () => OBSERVERS.delete(device);
}
export function webGpuGeometryDeviceObserver(device) {
    return typeof device === "object" && device !== null
        ? OBSERVERS.get(device)
        : undefined;
}
//# sourceMappingURL=geometry-observer.js.map