/** Cache immutable device objects across isolated tooling jobs. Resources with
 * mutable contents (buffers, textures, bind groups) are deliberately excluded. */
export function createNodeDeviceCache(device: GPUDevice): {
  readonly device: GPUDevice;
  inspect(): {
    readonly hits: number;
    readonly misses: number;
    readonly entries: number;
  };
  clear(): void;
} {
  const cache = new Map<string, unknown>();
  const identities = new WeakMap<object, number>();
  const methods = new Map<PropertyKey, unknown>();
  let identity = 0,
    hits = 0,
    misses = 0;
  const cachedMethods = new Set([
    "createShaderModule",
    "createSampler",
    "createBindGroupLayout",
    "createPipelineLayout",
    "createRenderPipeline",
    "createRenderPipelineAsync",
    "createComputePipeline",
    "createComputePipelineAsync",
  ]);
  function key(value: unknown): unknown {
    if (value === null || typeof value !== "object") return value;
    if (Array.isArray(value)) return value.map(key);
    if (Object.getPrototypeOf(value) === Object.prototype)
      return Object.fromEntries(
        Object.entries(value)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([name, item]) => [name, key(item)]),
      );
    let id = identities.get(value);
    if (id === undefined) {
      id = ++identity;
      identities.set(value, id);
    }
    return { gpuObject: id };
  }
  const proxy = new Proxy(device, {
    get(target, property) {
      const value: unknown = Reflect.get(target, property, target);
      if (typeof value !== "function") return value;
      if (!methods.has(property))
        methods.set(property, (...args: unknown[]): unknown => {
          if (!cachedMethods.has(String(property)))
            return Reflect.apply(value, target, args);
          const cacheKey = `${String(property)}:${JSON.stringify(key(args))}`;
          if (cache.has(cacheKey)) {
            hits++;
            const result = cache.get(cacheKey);
            cache.delete(cacheKey);
            cache.set(cacheKey, result);
            return result;
          }
          misses++;
          const result: unknown = Reflect.apply(value, target, args);
          cache.set(cacheKey, result);
          // A changing shader workload must not retain every past program.
          if (cache.size > 256) cache.delete(cache.keys().next().value!);
          if (result instanceof Promise)
            void result.catch(() => {
              if (cache.get(cacheKey) === result) cache.delete(cacheKey);
            });
          return result;
        });
      return methods.get(property);
    },
  });
  return {
    device: proxy,
    inspect: () => ({ hits, misses, entries: cache.size }),
    clear() {
      cache.clear();
      methods.clear();
    },
  };
}
