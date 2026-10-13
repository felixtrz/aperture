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
export declare function capturePreparedResourceDependencies(...candidates: readonly (readonly [
    PreparedResourceCache,
    PreparedResourceEntry | null | undefined
])[]): readonly PreparedResourceDependency[];
/**
 * A GPU cache hit is also a use of its prepared dependencies. An idle-retired
 * or superseded alias cannot be revived by a stale GPU resource reference:
 * the caller must take its ordinary preparation path instead.
 */
export declare function touchPreparedResourceDependencies(dependencies: readonly PreparedResourceDependency[] | undefined, frame: number): boolean;
export declare function preparedResourceDependenciesAreLive(dependencies: readonly PreparedResourceDependency[] | undefined): dependencies is readonly PreparedResourceDependency[];
export {};
//# sourceMappingURL=prepared-resource-dependencies.d.ts.map