/** Exact prepared entries retained by a successfully created GPU resource cache. */
interface PreparedResourceEntry {
  readonly cacheKey: string;
  lastUsedFrame: number;
}

interface PreparedResourceCache {
  readonly resources: ReadonlyMap<string, PreparedResourceEntry>;
}

export interface PreparedResourceDependency {
  readonly cache: PreparedResourceCache;
  readonly entry: PreparedResourceEntry;
}

export function capturePreparedResourceDependencies(
  ...candidates: readonly (readonly [
    PreparedResourceCache,
    PreparedResourceEntry | null | undefined,
  ])[]
): readonly PreparedResourceDependency[] {
  return candidates.flatMap(([cache, entry]) =>
    entry === null || entry === undefined ? [] : [{ cache, entry }],
  );
}

/**
 * A GPU cache hit is also a use of its prepared dependencies. An idle-retired
 * or superseded alias cannot be revived by a stale GPU resource reference:
 * the caller must take its ordinary preparation path instead.
 */
export function touchPreparedResourceDependencies(
  dependencies: readonly PreparedResourceDependency[] | undefined,
  frame: number,
): boolean {
  if (!preparedResourceDependenciesAreLive(dependencies)) return false;
  for (const { entry } of dependencies)
    entry.lastUsedFrame = Math.max(entry.lastUsedFrame, frame);
  return true;
}

export function preparedResourceDependenciesAreLive(
  dependencies: readonly PreparedResourceDependency[] | undefined,
): dependencies is readonly PreparedResourceDependency[] {
  return !(
    dependencies === undefined ||
    dependencies.some(
      ({ cache, entry }) => cache.resources.get(entry.cacheKey) !== entry,
    )
  );
}
