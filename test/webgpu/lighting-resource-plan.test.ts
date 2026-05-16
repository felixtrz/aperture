import { describe, expect, it } from "vitest";

import {
  PACKED_LIGHT_FLOAT_STRIDE,
  createEnvironmentMapHandle,
  createRenderResourceSummaryReport,
  planSnapshotLightingResources,
  snapshotLightingResourcePlanToSummaryInput,
  snapshotLightingResourcePlanToJson,
  snapshotLightingResourcePlanToJsonValue,
  type EnvironmentPacket,
  type LightPacket,
  type RenderSnapshot,
} from "../../src/index.js";

describe("snapshot lighting resource planning", () => {
  it("composes light buffer and environment resource plans from a render snapshot", () => {
    const plan = planSnapshotLightingResources(
      snapshot({
        lights: [light("ambient", 1), light("directional", 2)],
        environments: [environment(1, null), environment(2, "studio")],
      }),
      { lightBuffer: { resourceKey: "light-buffer:frame" } },
    );

    expect(plan.lightBuffer).toMatchObject({
      resourceKey: "light-buffer:frame",
      count: 2,
      floatByteLength:
        2 * PACKED_LIGHT_FLOAT_STRIDE * Float32Array.BYTES_PER_ELEMENT,
    });
    expect(plan.environments).toMatchObject({
      environmentCount: 2,
      nullHandleCount: 1,
      requirements: [
        {
          resourceKey: "environment-map:studio",
          environmentIds: [2],
        },
      ],
    });
  });

  it("returns no-op plans for snapshots without lights or environment handles", () => {
    const plan = planSnapshotLightingResources(
      snapshot({ environments: [environment(9, null)] }),
    );

    expect(plan.lightBuffer.count).toBe(0);
    expect(plan.lightBuffer.byteLength).toBe(0);
    expect(plan.environments.environmentCount).toBe(1);
    expect(plan.environments.nullHandleCount).toBe(1);
    expect(plan.environments.requirements).toEqual([]);
  });

  it("serializes JSON-safe summaries without packed arrays or raw handles", () => {
    const plan = planSnapshotLightingResources(
      snapshot({
        lights: [light("point", 3)],
        environments: [environment(4, "studio")],
      }),
    );

    const value = snapshotLightingResourcePlanToJsonValue(plan);
    const json = snapshotLightingResourcePlanToJson(plan);

    expect(value).toMatchObject({
      lightBuffer: {
        resourceKey: "light-buffer:main",
        usageIntent: "read-only-storage",
        count: 1,
        byteLength: plan.lightBuffer.byteLength,
      },
      environments: {
        environmentCount: 1,
        nullHandleCount: 0,
        resourceKeys: ["environment-map:studio"],
      },
    });
    expect(JSON.parse(json) as unknown).toEqual(value);
    expect(json).not.toContain("Float32Array");
    expect(json).not.toContain("Int32Array");
    expect(json).not.toContain('"floats":');
    expect(json).not.toContain('"metadata":');
    expect(json).not.toContain('"handle"');
  });

  it("adapts snapshot lighting plans into resource summary inputs", () => {
    const lighting = planSnapshotLightingResources(
      snapshot({
        lights: [light("spot", 6)],
        environments: [environment(7, "studio")],
      }),
    );
    const report = createRenderResourceSummaryReport({
      meshResources: [],
      materialResources: [],
      viewUniformResources: [],
      shaderResources: [],
      pipelines: [],
      ...snapshotLightingResourcePlanToSummaryInput(lighting),
    });

    expect(report.counts).toMatchObject({
      lightBuffers: 1,
      environmentMaps: 1,
    });
    expect(report.diagnostics).toEqual([]);
  });
});

function snapshot(input: {
  readonly lights?: readonly LightPacket[];
  readonly environments?: readonly EnvironmentPacket[];
}): RenderSnapshot {
  return {
    frame: 1,
    views: [],
    meshDraws: [],
    lights: input.lights ?? [],
    environments: input.environments ?? [],
    shadowRequests: [],
    bounds: [],
    transforms: new Float32Array(0),
    viewMatrices: new Float32Array(0),
    diagnostics: [],
    report: {
      views: 0,
      meshDraws: 0,
      lights: input.lights?.length ?? 0,
      environments: input.environments?.length ?? 0,
      shadowRequests: 0,
      bounds: 0,
      diagnostics: 0,
    },
  };
}

function light(kind: LightPacket["kind"], seed: number): LightPacket {
  return {
    lightId: 100 + seed,
    entity: { index: seed, generation: 0 },
    kind,
    color: [1, 1, 1, 1],
    intensity: seed,
    range: 10,
    innerConeAngle: 0,
    outerConeAngle: 0,
    worldTransformOffset: 16 * seed,
    layerMask: 1,
  };
}

function environment(
  environmentId: number,
  handleId: string | null,
): EnvironmentPacket {
  return {
    environmentId,
    handle: handleId === null ? null : createEnvironmentMapHandle(handleId),
    color: [1, 1, 1, 1],
    intensity: 1,
    layerMask: 1,
  };
}
