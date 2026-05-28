import { describe, expect, it } from "vitest";

import {
  WebGpuBindGroupLayoutCache,
  createWebGpuBindGroupLayoutCacheKey,
  type WebGpuBindGroupLayoutDescriptor,
  type WebGpuBindGroupLayoutDeviceLike,
} from "@aperture-engine/webgpu/test-support";

describe("WebGPU bind group layout cache", () => {
  it("creates stable keys from sorted layout descriptor entries", () => {
    const first = createWebGpuBindGroupLayoutCacheKey({
      label: "first",
      entries: [
        {
          binding: 1,
          label: "world transforms",
          resource: "read-only-storage-buffer",
        },
        { binding: 0, label: "view", resource: "uniform-buffer" },
      ],
    });
    const second = createWebGpuBindGroupLayoutCacheKey({
      label: "second",
      entries: [
        { binding: 0, label: "renamed view", resource: "uniform-buffer" },
        {
          binding: 1,
          label: "renamed transforms",
          resource: "read-only-storage-buffer",
        },
      ],
    });

    expect(first).toBe(second);
    expect(JSON.parse(first) as unknown).toEqual({
      entries: [
        { binding: 0, resource: "uniform-buffer" },
        { binding: 1, resource: "read-only-storage-buffer" },
      ],
    });
  });

  it("creates layouts on misses and reuses them on hits", () => {
    const cache = new WebGpuBindGroupLayoutCache();
    const created: WebGpuBindGroupLayoutDescriptor[] = [];
    const layout = { label: "layout" };
    const device: WebGpuBindGroupLayoutDeviceLike = {
      createBindGroupLayout: (descriptor) => {
        created.push(descriptor);
        return layout;
      },
    };
    const descriptor = layoutDescriptor();

    const miss = cache.getOrCreate({ device, descriptor });
    const hit = cache.getOrCreate({ device, descriptor });

    expect(miss).toMatchObject({ ok: true, status: "miss", layout });
    expect(hit).toMatchObject({ ok: true, status: "hit", layout });
    expect(created).toEqual([descriptor]);
    expect(cache.size).toBe(1);
  });

  it("separates descriptor differences by binding and resource", () => {
    const base = layoutDescriptor();
    const differentBinding = layoutDescriptor({ binding: 1 });
    const differentResource = layoutDescriptor({ resource: "sampler" });

    expect(createWebGpuBindGroupLayoutCacheKey(base)).not.toBe(
      createWebGpuBindGroupLayoutCacheKey(differentBinding),
    );
    expect(createWebGpuBindGroupLayoutCacheKey(base)).not.toBe(
      createWebGpuBindGroupLayoutCacheKey(differentResource),
    );
  });

  it("reports missing createBindGroupLayout support on cache misses", () => {
    const cache = new WebGpuBindGroupLayoutCache();
    const result = cache.getOrCreate({
      device: {},
      descriptor: layoutDescriptor(),
    });

    expect(result).toMatchObject({
      ok: false,
      reason: "create-bind-group-layout-unavailable",
    });
    expect(cache.size).toBe(0);
  });
});

function layoutDescriptor(
  entry: Partial<WebGpuBindGroupLayoutDescriptor["entries"][number]> = {},
): WebGpuBindGroupLayoutDescriptor {
  return {
    label: "unlit/group-0",
    entries: [
      {
        binding: entry.binding ?? 0,
        label: entry.label ?? "View projection uniform",
        resource: entry.resource ?? "uniform-buffer",
      },
    ],
  };
}
