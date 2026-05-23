import { describe, expect, it, vi } from "vitest";

import {
  GPU_OCCLUSION_MAP_READ,
  createGpuOcclusionQueryResources,
  readGpuOcclusionQueryResults,
  resolveGpuOcclusionQueries,
  type GpuOcclusionBufferLike,
} from "@aperture-engine/webgpu";

describe("GPU occlusion query helpers", () => {
  it("creates occlusion query resources with resolve and readback buffers", () => {
    const createdBuffers: {
      readonly label?: string;
      readonly usage: number;
    }[] = [];
    const result = createGpuOcclusionQueryResources({
      device: {
        createQuerySet: (descriptor) => ({ descriptor }),
        createBuffer: (descriptor) => {
          createdBuffers.push({
            usage: descriptor.usage,
            ...(descriptor.label === undefined
              ? {}
              : { label: descriptor.label }),
          });
          return buffer();
        },
      },
      label: "visibility",
      queryCount: 3,
    });

    expect(result.supported).toBe(true);
    expect(result.resources).toMatchObject({
      label: "visibility",
      queryCount: 3,
      byteLength: 24,
    });
    expect(createdBuffers).toMatchObject([
      { label: "visibility/resolve" },
      { label: "visibility/readback" },
    ]);
  });

  it("resolves query results into a map-readable buffer", () => {
    const calls: unknown[] = [];
    const resources = resourcesWithCounts([0n, 7n]);
    const report = resolveGpuOcclusionQueries(
      {
        resolveQuerySet: (...args) => calls.push(["resolveQuerySet", ...args]),
        copyBufferToBuffer: (...args) =>
          calls.push(["copyBufferToBuffer", ...args]),
      },
      resources,
      2,
    );

    expect(report).toEqual({ valid: true, diagnostics: [] });
    expect(calls).toEqual([
      ["resolveQuerySet", resources.querySet, 0, 2, resources.resolveBuffer, 0],
      [
        "copyBufferToBuffer",
        resources.resolveBuffer,
        0,
        resources.readbackBuffer,
        0,
        16,
      ],
    ]);
  });

  it("classifies zero samples as occluded and non-zero samples as visible", async () => {
    const resources = resourcesWithCounts([0n, 5n]);
    const result = await readGpuOcclusionQueryResults(resources, [10, 11]);

    expect(result).toMatchObject({
      valid: true,
      testedRenderIds: [10, 11],
      visibleRenderIds: [11],
      occludedRenderIds: [10],
      sampleCounts: ["0", "5"],
      diagnostics: [],
    });
    expect(resources.readbackBuffer.mapAsync).toHaveBeenCalledWith(
      GPU_OCCLUSION_MAP_READ,
      0,
      16,
    );
    expect(resources.readbackBuffer.unmap).toHaveBeenCalled();
  });
});

function resourcesWithCounts(counts: readonly bigint[]) {
  const data = new BigUint64Array(counts.length);
  data.set(counts);

  return {
    label: "visibility",
    queryCount: counts.length,
    byteLength: data.byteLength,
    querySet: { label: "queries" },
    resolveBuffer: buffer(),
    readbackBuffer: buffer(data.buffer),
  };
}

function buffer(mapped = new ArrayBuffer(0)): GpuOcclusionBufferLike {
  return {
    mapAsync: vi.fn(async () => {}),
    getMappedRange: vi.fn(() => mapped),
    unmap: vi.fn(),
  };
}
