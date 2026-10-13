import { registerWebGpuGeometryDeviceObserver, } from "../gpu/geometry-observer.js";
const APP_DEVICES = new WeakMap();
/** Public app/device identities stay untouched; only internal allocation uses this view. */
export function registerWebGpuAppOwnedDevice(app, device) {
    APP_DEVICES.set(app, device);
}
/** Drop the internal device key so per-device WeakMap caches can be collected. */
export function releaseWebGpuAppOwnedDevice(app) {
    // Retain a tombstone: internal helpers must never fall back to the borrowed
    // public device and start allocating again after disposal.
    APP_DEVICES.set(app, {});
}
export function webGpuAppResourceDevice(app) {
    return (APP_DEVICES.get(app) ??
        app.initialization
            ?.device ??
        {});
}
/** Track only allocations performed by this app's internal device, never borrowed objects. */
export function createWebGpuAppOwnedResources(device, observer) {
    const resources = new Map();
    const tracked = new WeakSet();
    const methods = new Map();
    let disposed = false;
    let observedQueue = null;
    const track = (resource) => {
        if (typeof resource !== "object" ||
            resource === null ||
            tracked.has(resource))
            return resource;
        tracked.add(resource);
        const destroy = resource.destroy;
        if (typeof destroy !== "function")
            return resource;
        let destroyed = false;
        const release = () => {
            if (destroyed)
                return;
            destroyed = true;
            resources.delete(resource);
            observer?.bufferDestroyed(resource);
            destroy.call(resource);
        };
        // Native identities must be passed to native commands/bind groups unchanged.
        // Decorating only an owned object's destroy also observes normal replacement,
        // so disposed/replaced allocations are never retained until app shutdown.
        resources.set(resource, release);
        try {
            Object.defineProperty(resource, "destroy", {
                value: release,
                writable: true,
                configurable: true,
            });
        }
        catch (error) {
            // Never strand a newly allocated object if this host cannot decorate it.
            try {
                release();
            }
            catch (cleanupError) {
                throw new AggregateError([error, cleanupError], "Tracking an app-owned WebGPU resource failed.", { cause: cleanupError });
            }
            throw error;
        }
        return resource;
    };
    let internalDevice = new Proxy(device, {
        get(target, key) {
            const value = Reflect.get(target, key, target);
            if (key === "queue" &&
                observer !== undefined &&
                typeof value === "object" &&
                value !== null) {
                observedQueue ??= new Proxy(value, {
                    get(queue, methodKey) {
                        const method = Reflect.get(queue, methodKey, queue);
                        if (typeof method !== "function")
                            return method;
                        if (methodKey !== "writeBuffer")
                            return method.bind(queue);
                        return (...args) => {
                            let result;
                            try {
                                result = Reflect.apply(method, queue, args);
                            }
                            catch (error) {
                                observer.bufferInvalidated(args[0]);
                                throw error;
                            }
                            observer.bufferWritten(args[0], args[1], args[2], args[3], args[4]);
                            return result;
                        };
                    },
                });
                return observedQueue;
            }
            if (typeof value !== "function")
                return value;
            if (methods.has(key))
                return methods.get(key);
            const allocation = key === "createBuffer" ||
                key === "createTexture" ||
                key === "createQuerySet";
            const method = allocation
                ? (...args) => {
                    if (disposed)
                        throw new Error("Aperture WebGPU app was disposed.");
                    return track(Reflect.apply(value, target, args));
                }
                : key === "createBindGroup" && observer !== undefined
                    ? (...args) => {
                        const group = Reflect.apply(value, target, args);
                        observer.bindGroupCreated(group, args[0]);
                        return group;
                    }
                    : value.bind(target);
            methods.set(key, method);
            return method;
        },
    });
    const releaseObserver = observer === undefined
        ? undefined
        : registerWebGpuGeometryDeviceObserver(internalDevice, observer);
    return {
        get device() {
            if (internalDevice === null)
                throw new Error("Aperture WebGPU app was disposed.");
            return internalDevice;
        },
        dispose() {
            if (disposed)
                return;
            disposed = true;
            const errors = [];
            for (const release of [...resources.values()].reverse()) {
                try {
                    release();
                }
                catch (error) {
                    errors.push(error);
                }
            }
            resources.clear();
            methods.clear();
            releaseObserver?.();
            observedQueue = null;
            internalDevice = null;
            if (errors.length)
                throw new AggregateError(errors, "One or more app-owned WebGPU resources failed to destroy.");
        },
    };
}
//# sourceMappingURL=owned-resources.js.map