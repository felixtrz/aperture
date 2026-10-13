import { createPreparedScalarUnlitMaterialCache, } from "../unlit/prepared-unlit-material-cache.js";
import { createPreparedMatcapMaterialCache, } from "../matcap/prepared-matcap-material-cache.js";
import { createPreparedDebugNormalMaterialCache, } from "../debug-normal/prepared-debug-normal-material-cache.js";
import { createPreparedScalarStandardMaterialCache, } from "../standard/prepared-standard-material-cache.js";
import { writePreparedAppMaterialCacheSummary, } from "./prepared-app-material-resource.js";
export function createPreparedBuiltInMaterialStore() {
    return {
        unlit: createPreparedScalarUnlitMaterialCache(),
        matcap: createPreparedMatcapMaterialCache(),
        standard: createPreparedScalarStandardMaterialCache(),
        debugNormal: createPreparedDebugNormalMaterialCache(),
    };
}
export function writePreparedBuiltInMaterialStoreSummary(summary, store) {
    return writePreparedAppMaterialCacheSummary(summary, store);
}
export function evictPreparedBuiltInMaterialStoreEntries(store, options) {
    const families = {
        unlit: evictPreparedMaterialCacheEntries(store.unlit.resources, options),
        matcap: evictPreparedMaterialCacheEntries(store.matcap.resources, options),
        standard: evictPreparedMaterialCacheEntries(store.standard.resources, options),
        "debug-normal": evictPreparedMaterialCacheEntries(store.debugNormal.resources, options),
    };
    return {
        checked: families.unlit.checked +
            families.matcap.checked +
            families.standard.checked +
            families["debug-normal"].checked,
        retained: families.unlit.retained +
            families.matcap.retained +
            families.standard.retained +
            families["debug-normal"].retained,
        evicted: families.unlit.evicted +
            families.matcap.evicted +
            families.standard.evicted +
            families["debug-normal"].evicted,
        skippedInUse: families.unlit.skippedInUse +
            families.matcap.skippedInUse +
            families.standard.skippedInUse +
            families["debug-normal"].skippedInUse,
        families,
    };
}
function evictPreparedMaterialCacheEntries(entries, options) {
    let checked = 0;
    let retained = 0;
    let evicted = 0;
    let skippedInUse = 0;
    for (const [key, entry] of entries) {
        checked += 1;
        if (entry.lastUsedFrame >= options.currentFrame) {
            skippedInUse += 1;
            continue;
        }
        if (options.currentFrame - entry.lastUsedFrame <= options.maxUnusedFrames) {
            retained += 1;
            continue;
        }
        entries.delete(key);
        evicted += 1;
    }
    return { checked, retained, evicted, skippedInUse };
}
//# sourceMappingURL=prepared-built-in-material-store.js.map