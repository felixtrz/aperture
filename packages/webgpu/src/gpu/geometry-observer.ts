/** Internal opt-in observation; native GPU object identities remain unchanged. */
export interface WebGpuGeometryDeviceObserver {
  worldBufferCreated(
    buffer: unknown,
    resourceKey: string,
    capacity: number,
    initial: Float32Array,
  ): void;
  indirectBufferCreated(
    buffer: unknown,
    resourceKey: string,
    capacity: number,
  ): void;
  bufferWritten(
    buffer: unknown,
    offset: number,
    data: ArrayBufferLike | ArrayBufferView,
    dataOffset?: number,
    size?: number,
  ): void;
  bufferInvalidated(buffer: unknown): void;
  bufferDestroyed(buffer: unknown): void;
  bindGroupCreated(group: unknown, descriptor: unknown): void;
}
const OBSERVERS = new WeakMap<object, WebGpuGeometryDeviceObserver>();

export function registerWebGpuGeometryDeviceObserver(
  device: object,
  observer: WebGpuGeometryDeviceObserver,
): () => void {
  OBSERVERS.set(device, observer);
  return () => OBSERVERS.delete(device);
}

export function webGpuGeometryDeviceObserver(
  device: unknown,
): WebGpuGeometryDeviceObserver | undefined {
  return typeof device === "object" && device !== null
    ? OBSERVERS.get(device)
    : undefined;
}
