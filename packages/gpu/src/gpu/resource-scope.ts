import { registerGpuDeviceAlias } from "../device-lock.js";
/** Device-owned resources allocated by a renderer borrowing a shared device. */
interface Destroyable {
  destroy(): void;
}

export interface WebGpuResourceScope<T extends object> {
  readonly device: T;
  dispose(): void;
}

/**
 * Intercept allocation only; return real GPU objects unchanged. Weak references
 * let cache eviction collect resources during long-lived browser sessions.
 * Native methods/getters always receive their original device as the receiver.
 */
export function createWebGpuResourceScope<T extends object>(
  device: T,
): WebGpuResourceScope<T> {
  const resources = new Set<WeakRef<Destroyable>>();
  const collected = new FinalizationRegistry<WeakRef<Destroyable>>((ref) =>
    resources.delete(ref),
  );
  const methods = new Map<PropertyKey, unknown>();
  let disposed = false;
  const scoped = new Proxy(device, {
    get(target, key) {
      const value: unknown = Reflect.get(target, key, target);
      if (typeof value !== "function") return value;
      if (!methods.has(key)) {
        methods.set(key, (...args: unknown[]): unknown => {
          if (disposed)
            throw new Error("Renderer GPU resource scope is disposed.");
          if (key === "destroy")
            throw new Error("A renderer cannot destroy its borrowed device.");
          const result: unknown = Reflect.apply(value, target, args);
          if (
            (key === "createBuffer" ||
              key === "createTexture" ||
              key === "createQuerySet") &&
            result !== null &&
            typeof result === "object" &&
            "destroy" in result &&
            typeof result.destroy === "function"
          ) {
            const ref = new WeakRef(result as Destroyable);
            resources.add(ref);
            collected.register(result, ref, ref);
          }
          return result;
        });
      }
      return methods.get(key);
    },
  });
  registerGpuDeviceAlias(scoped, device);
  return {
    device: scoped,
    dispose() {
      if (disposed) return;
      disposed = true;
      const errors: unknown[] = [];
      for (const ref of resources) {
        collected.unregister(ref);
        try {
          ref.deref()?.destroy();
        } catch (error) {
          errors.push(error);
        }
      }
      resources.clear();
      methods.clear();
      if (errors.length > 0)
        throw new AggregateError(errors, "Renderer resource cleanup failed.");
    },
  };
}
