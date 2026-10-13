import type { WebGpuDeviceLike } from "../gpu/initialize-webgpu.js";
import { type WebGpuGeometryDeviceObserver } from "../gpu/geometry-observer.js";
export interface WebGpuAppOwnedResources<Device extends object = WebGpuDeviceLike> {
    readonly device: Device;
    dispose(): void;
}
/** Public app/device identities stay untouched; only internal allocation uses this view. */
export declare function registerWebGpuAppOwnedDevice(app: object, device: WebGpuDeviceLike): void;
/** Drop the internal device key so per-device WeakMap caches can be collected. */
export declare function releaseWebGpuAppOwnedDevice(app: object): void;
export declare function webGpuAppResourceDevice(app: object): WebGpuDeviceLike;
/** Track only allocations performed by this app's internal device, never borrowed objects. */
export declare function createWebGpuAppOwnedResources<Device extends object>(device: Device, observer?: WebGpuGeometryDeviceObserver): WebGpuAppOwnedResources<Device>;
//# sourceMappingURL=owned-resources.d.ts.map