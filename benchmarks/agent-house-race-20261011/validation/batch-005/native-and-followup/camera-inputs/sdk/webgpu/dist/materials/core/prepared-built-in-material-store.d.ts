import { type PreparedScalarUnlitMaterialCache } from "../unlit/prepared-unlit-material-cache.js";
import { type PreparedMatcapMaterialCache } from "../matcap/prepared-matcap-material-cache.js";
import { type PreparedDebugNormalMaterialCache } from "../debug-normal/prepared-debug-normal-material-cache.js";
import { type PreparedScalarStandardMaterialCache } from "../standard/prepared-standard-material-cache.js";
import { type PreparedAppMaterialCacheSummary } from "./prepared-app-material-resource.js";
export interface PreparedBuiltInMaterialStore {
    readonly unlit: PreparedScalarUnlitMaterialCache;
    readonly matcap: PreparedMatcapMaterialCache;
    readonly standard: PreparedScalarStandardMaterialCache;
    readonly debugNormal: PreparedDebugNormalMaterialCache;
}
export interface PreparedBuiltInMaterialCacheEvictionOptions {
    readonly currentFrame: number;
    readonly maxUnusedFrames: number;
}
interface PreparedBuiltInMaterialCacheEvictionFamilyReport {
    readonly checked: number;
    readonly retained: number;
    readonly evicted: number;
    readonly skippedInUse: number;
}
export interface PreparedBuiltInMaterialCacheEvictionReport {
    readonly checked: number;
    readonly retained: number;
    readonly evicted: number;
    readonly skippedInUse: number;
    readonly families: Record<"unlit" | "matcap" | "standard" | "debug-normal", PreparedBuiltInMaterialCacheEvictionFamilyReport>;
}
export declare function createPreparedBuiltInMaterialStore(): PreparedBuiltInMaterialStore;
export declare function writePreparedBuiltInMaterialStoreSummary(summary: PreparedAppMaterialCacheSummary, store: PreparedBuiltInMaterialStore): PreparedAppMaterialCacheSummary;
export declare function evictPreparedBuiltInMaterialStoreEntries(store: PreparedBuiltInMaterialStore, options: PreparedBuiltInMaterialCacheEvictionOptions): PreparedBuiltInMaterialCacheEvictionReport;
export {};
//# sourceMappingURL=prepared-built-in-material-store.d.ts.map