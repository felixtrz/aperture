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
export declare function createBindGroupResourceCache<TResource>(): BindGroupResourceCache<TResource>;
export declare function resetBindGroupResourceCache<TResource>(cache: BindGroupResourceCache<TResource>): BindGroupResourceCache<TResource>;
export declare function bindGroupResourceCacheReport<TResource>(cache: BindGroupResourceCache<TResource>): BindGroupResourceCacheReport;
export declare function readCachedBindGroupResource<TResource>(cache: BindGroupResourceCache<TResource> | undefined, key: string): TResource | null;
export declare function writeCachedBindGroupResource<TResource>(cache: BindGroupResourceCache<TResource> | undefined, key: string, resource: TResource): void;
//# sourceMappingURL=bind-group-resource-cache.d.ts.map