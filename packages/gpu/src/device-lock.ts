// WebGPU error scopes are a device-wide stack. Keep asynchronous preparation
// and submission scopes from different contexts from consuming each other's errors.
const tails = new WeakMap<object, Promise<unknown>>();
const aliases = new WeakMap<object, object>();
export function registerGpuDeviceAlias(alias: object, device: object): void {
  aliases.set(alias, aliases.get(device) ?? device);
}
export function withGpuDeviceLock<T>(
  device: object,
  work: () => Promise<T>,
): Promise<T> {
  device = aliases.get(device) ?? device;
  const result = (tails.get(device) ?? Promise.resolve()).then(work, work);
  const tail = result.then(
    () => undefined,
    () => undefined,
  );
  tails.set(device, tail);
  void tail.then(() => {
    if (tails.get(device) === tail) tails.delete(device);
  });
  return result;
}
