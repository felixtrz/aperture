import { describe, expect, it } from "vitest";

import * as webgpu from "@aperture-engine/webgpu";
import { createPreparedAppMaterialCacheSummary } from "../../packages/webgpu/src/webgpu/prepared-app-material-resource.js";
import {
  createPreparedBuiltInMaterialStore,
  evictPreparedBuiltInMaterialStoreEntries,
  writePreparedBuiltInMaterialStoreSummary,
} from "../../packages/webgpu/src/webgpu/prepared-built-in-material-store.js";

describe("prepared built-in material store", () => {
  it("owns unlit, Matcap, and Standard prepared material cache buckets", () => {
    const store = createPreparedBuiltInMaterialStore();

    expect(store.unlit.resources).toBeInstanceOf(Map);
    expect(store.matcap.resources).toBeInstanceOf(Map);
    expect(store.standard.resources).toBeInstanceOf(Map);
    expect(store.unlit.resources.size).toBe(0);
    expect(store.matcap.resources.size).toBe(0);
    expect(store.standard.resources.size).toBe(0);
  });

  it("writes JSON-safe prepared material cache summary counts", () => {
    const store = createPreparedBuiltInMaterialStore();
    const summary = createPreparedAppMaterialCacheSummary();

    store.unlit.resources.set("unlit:1", {} as never);
    store.matcap.resources.set("matcap:1", {} as never);
    store.standard.resources.set("standard:1", {} as never);
    store.standard.resources.set("standard:2", {} as never);

    expect(writePreparedBuiltInMaterialStoreSummary(summary, store)).toEqual({
      totalEntries: 4,
      families: {
        unlit: { entries: 1 },
        matcap: { entries: 1 },
        standard: { entries: 2 },
      },
    });
    expect(JSON.stringify(summary)).not.toContain("Map");
  });

  it("updates JSON-safe summary counts after removing and clearing entries", () => {
    const store = createPreparedBuiltInMaterialStore();
    const summary = createPreparedAppMaterialCacheSummary();

    store.unlit.resources.set("unlit:1", {} as never);
    store.matcap.resources.set("matcap:1", {} as never);
    store.standard.resources.set("standard:1", {} as never);
    store.standard.resources.set("standard:2", {} as never);
    store.standard.resources.delete("standard:1");
    store.matcap.resources.clear();

    expect(writePreparedBuiltInMaterialStoreSummary(summary, store)).toEqual({
      totalEntries: 2,
      families: {
        unlit: { entries: 1 },
        matcap: { entries: 0 },
        standard: { entries: 1 },
      },
    });
    expect(JSON.stringify(summary)).not.toContain("Map");
  });

  it("reports and removes stale backend cache entries without touching retained entries", () => {
    const store = createPreparedBuiltInMaterialStore();

    store.unlit.resources.set("unlit:current", { lastUsedFrame: 20 } as never);
    store.unlit.resources.set("unlit:stale", { lastUsedFrame: 14 } as never);
    store.matcap.resources.set("matcap:retained", {
      lastUsedFrame: 18,
    } as never);
    store.standard.resources.set("standard:stale", {
      lastUsedFrame: 16,
    } as never);

    const report = evictPreparedBuiltInMaterialStoreEntries(store, {
      currentFrame: 20,
      maxUnusedFrames: 3,
    });

    expect(report).toEqual({
      checked: 4,
      retained: 1,
      evicted: 2,
      skippedInUse: 1,
      families: {
        unlit: { checked: 2, retained: 0, evicted: 1, skippedInUse: 1 },
        matcap: { checked: 1, retained: 1, evicted: 0, skippedInUse: 0 },
        standard: { checked: 1, retained: 0, evicted: 1, skippedInUse: 0 },
      },
    });
    expect([...store.unlit.resources.keys()]).toEqual(["unlit:current"]);
    expect([...store.matcap.resources.keys()]).toEqual(["matcap:retained"]);
    expect([...store.standard.resources.keys()]).toEqual([]);
    expect(JSON.stringify(report)).not.toContain("Map");
  });

  it("keeps the store container off the public WebGPU package surface", () => {
    expect("createPreparedBuiltInMaterialStore" in webgpu).toBe(false);
    expect("writePreparedBuiltInMaterialStoreSummary" in webgpu).toBe(false);
    expect("evictPreparedBuiltInMaterialStoreEntries" in webgpu).toBe(false);
  });
});
