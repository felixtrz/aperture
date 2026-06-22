import { describe, expect, it, vi } from "vitest";

import {
  GPU_OCCLUSION_MAP_READ,
  createGpuOcclusionFeedbackState,
  createGpuOcclusionQueryResources,
  planGpuOcclusionFeedbackCulling,
  readGpuOcclusionQueryResults,
  resolveGpuOcclusionQueries,
  updateGpuOcclusionFeedbackState,
  type GpuOcclusionBufferLike,
} from "@aperture-engine/webgpu/test-support";

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

  it("plans no skips until view-local feedback has ready query results", () => {
    const state = createGpuOcclusionFeedbackState();
    const plan = planGpuOcclusionFeedbackCulling({
      state,
      viewId: 1,
      frame: 2,
      candidateRenderIds: [10, 11],
    });

    expect(plan).toEqual({
      candidateDraws: 2,
      skippedRenderIds: [],
      forcedProbeRenderIds: [],
      fallbackReason: "not-ready",
    });
  });

  it("skips previously occluded draws and probes them after the interval", () => {
    const state = createGpuOcclusionFeedbackState();

    updateGpuOcclusionFeedbackState({
      state,
      viewId: 1,
      frame: 1,
      status: "ready",
      testedRenderIds: [10, 11],
      visibleRenderIds: [11],
      occludedRenderIds: [10],
    });

    expect(
      planGpuOcclusionFeedbackCulling({
        state,
        viewId: 1,
        frame: 2,
        candidateRenderIds: [10, 11],
      }),
    ).toMatchObject({
      candidateDraws: 2,
      skippedRenderIds: [10],
      forcedProbeRenderIds: [],
      fallbackReason: null,
    });
    expect(
      planGpuOcclusionFeedbackCulling({
        state,
        viewId: 2,
        frame: 2,
        candidateRenderIds: [10],
      }),
    ).toMatchObject({
      skippedRenderIds: [],
      forcedProbeRenderIds: [],
      fallbackReason: null,
    });
    expect(
      planGpuOcclusionFeedbackCulling({
        state,
        viewId: 1,
        frame: 5,
        candidateRenderIds: [10],
      }),
    ).toMatchObject({
      skippedRenderIds: [],
      forcedProbeRenderIds: [10],
      fallbackReason: null,
    });
  });

  it("removes a render id from skip feedback when a later probe is visible", () => {
    const state = createGpuOcclusionFeedbackState();

    updateGpuOcclusionFeedbackState({
      state,
      viewId: 1,
      frame: 1,
      status: "ready",
      testedRenderIds: [10],
      visibleRenderIds: [],
      occludedRenderIds: [10],
    });
    updateGpuOcclusionFeedbackState({
      state,
      viewId: 1,
      frame: 5,
      status: "ready",
      testedRenderIds: [10],
      visibleRenderIds: [10],
      occludedRenderIds: [],
    });

    expect(
      planGpuOcclusionFeedbackCulling({
        state,
        viewId: 1,
        frame: 6,
        candidateRenderIds: [10],
      }).skippedRenderIds,
    ).toEqual([]);
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
