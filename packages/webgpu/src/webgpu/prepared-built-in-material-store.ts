import {
  createPreparedScalarUnlitMaterialCache,
  type PreparedScalarUnlitMaterialCache,
} from "./prepared-unlit-material-cache.js";
import {
  createPreparedMatcapMaterialCache,
  type PreparedMatcapMaterialCache,
} from "./prepared-matcap-material-cache.js";
import {
  createPreparedScalarStandardMaterialCache,
  type PreparedScalarStandardMaterialCache,
} from "./prepared-standard-material-cache.js";
import {
  writePreparedAppMaterialCacheSummary,
  type PreparedAppMaterialCacheSummary,
} from "./prepared-app-material-resource.js";

export interface PreparedBuiltInMaterialStore {
  readonly unlit: PreparedScalarUnlitMaterialCache;
  readonly matcap: PreparedMatcapMaterialCache;
  readonly standard: PreparedScalarStandardMaterialCache;
}

export function createPreparedBuiltInMaterialStore(): PreparedBuiltInMaterialStore {
  return {
    unlit: createPreparedScalarUnlitMaterialCache(),
    matcap: createPreparedMatcapMaterialCache(),
    standard: createPreparedScalarStandardMaterialCache(),
  };
}

export function writePreparedBuiltInMaterialStoreSummary(
  summary: PreparedAppMaterialCacheSummary,
  store: PreparedBuiltInMaterialStore,
): PreparedAppMaterialCacheSummary {
  return writePreparedAppMaterialCacheSummary(summary, store);
}
