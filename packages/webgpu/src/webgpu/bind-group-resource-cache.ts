export interface BindGroupResourceCache<TResource> {
  readonly resources: Map<string, TResource>;
  created: number;
  reused: number;
}

export interface BindGroupResourceCacheReport {
  readonly created: number;
  readonly reused: number;
  readonly cached: number;
}

export function createBindGroupResourceCache<
  TResource,
>(): BindGroupResourceCache<TResource> {
  return {
    resources: new Map(),
    created: 0,
    reused: 0,
  };
}

export function resetBindGroupResourceCache<TResource>(
  cache: BindGroupResourceCache<TResource>,
): BindGroupResourceCache<TResource> {
  cache.resources.clear();
  cache.created = 0;
  cache.reused = 0;

  return cache;
}

export function bindGroupResourceCacheReport<TResource>(
  cache: BindGroupResourceCache<TResource>,
): BindGroupResourceCacheReport {
  return {
    created: cache.created,
    reused: cache.reused,
    cached: cache.resources.size,
  };
}

export function readCachedBindGroupResource<TResource>(
  cache: BindGroupResourceCache<TResource> | undefined,
  key: string,
): TResource | null {
  if (cache === undefined) {
    return null;
  }

  const resource = cache.resources.get(key);

  if (resource === undefined) {
    return null;
  }

  cache.reused += 1;

  return resource;
}

export function writeCachedBindGroupResource<TResource>(
  cache: BindGroupResourceCache<TResource> | undefined,
  key: string,
  resource: TResource,
): void {
  if (cache === undefined) {
    return;
  }

  cache.resources.set(key, resource);
  cache.created += 1;
}
