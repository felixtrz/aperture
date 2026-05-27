import { describe, expect, it } from "vitest";

import {
  createReusableRouteCollector,
  resetReusableRouteCollector,
} from "../../packages/webgpu/src/render/queues/reusable-route-collector.js";

describe("reusable route collector", () => {
  it("reuses item, diagnostic, and resource-set identity across writes", () => {
    const collector = createReusableRouteCollector<
      { readonly id: number },
      { readonly code: string }
    >();
    const items = collector.items;
    const diagnostics = collector.diagnostics;
    const resourceSet = collector.resourceSet;

    collector.items.push({ id: 1 });
    collector.diagnostics.push({ code: "first" });

    resetReusableRouteCollector(collector);

    expect(collector.items).toBe(items);
    expect(collector.diagnostics).toBe(diagnostics);
    expect(collector.resourceSet).toBe(resourceSet);
    expect(collector.resourceSet.items).toBe(items);
    expect(collector.items).toEqual([]);
    expect(collector.diagnostics).toEqual([]);

    collector.items.push({ id: 2 });
    collector.diagnostics.push({ code: "second" });

    expect(collector.items).toBe(items);
    expect(collector.diagnostics).toBe(diagnostics);
    expect(collector.resourceSet.items).toEqual([{ id: 2 }]);
  });
});
