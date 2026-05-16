import { describe, expect, it } from "vitest";

import {
  createRenderResourceSummaryReport,
  createSnapshotLightResourceSummaryReport,
  createSnapshotLightBindGroupResources,
  createSnapshotLightBindGroupResourcesResultToJson,
  createSnapshotLightBindGroupResourcesResultToJsonValue,
  snapshotLightResourceSummaryReportToJson,
  snapshotLightResourceSummaryReportToJsonValue,
  snapshotLightBindGroupResourcesToSummaryInput,
  type LightBindGroupCreationDescriptor,
  type LightPacket,
  type RenderSnapshot,
  type SnapshotLightBindGroupDeviceLike,
  type WebGpuBindGroupLayoutDescriptor,
  type WebGpuBufferCreateDescriptor,
} from "@aperture-engine/webgpu";

describe("snapshot light bind group resource creation", () => {
  it("returns a valid no-op for snapshots without lights", () => {
    const result = createSnapshotLightBindGroupResources(snapshot({}), {
      device: device(),
    });

    expect(result).toMatchObject({
      valid: true,
      layout: null,
      descriptorPlan: null,
      bindGroup: null,
      diagnostics: [],
    });
    expect(result.lightGpuBuffers).toMatchObject({
      valid: true,
      resource: null,
      diagnostics: [],
    });
  });

  it("creates light GPU buffers, layout, descriptor plan, and bind group resources", () => {
    const created = {
      buffers: [] as WebGpuBufferCreateDescriptor[],
      layouts: [] as WebGpuBindGroupLayoutDescriptor[],
      bindGroups: [] as LightBindGroupCreationDescriptor[],
    };
    const result = createSnapshotLightBindGroupResources(
      snapshot({ lights: [light("directional", 1)] }),
      {
        device: device(created),
        lightBuffer: { resourceKey: "light-buffer:snapshot" },
      },
    );

    expect(result.valid).toBe(true);
    expect(result.diagnostics).toEqual([]);
    expect(result.lightGpuBuffers.resource).toMatchObject({
      resourceKey: "light-buffer:snapshot",
      floatResourceKey: "light-buffer:snapshot/floats",
      metadataResourceKey: "light-buffer:snapshot/metadata",
      count: 1,
    });
    expect(result.layout?.resource).toMatchObject({
      group: 3,
      layoutKey: "bind-group-layout:lights/group-3",
    });
    expect(result.descriptorPlan).toMatchObject({
      resourceKey: "bind-group:lights/group-3/light-buffer:snapshot",
      layoutKey: "bind-group-layout:lights/group-3",
      entries: [
        { binding: 0, resourceKey: "light-buffer:snapshot/floats" },
        { binding: 1, resourceKey: "light-buffer:snapshot/metadata" },
      ],
    });
    expect(result.bindGroup?.resource).toMatchObject({
      resourceKey: "bind-group:lights/group-3/light-buffer:snapshot",
      layoutKey: "bind-group-layout:lights/group-3",
      entryResourceKeys: [
        "light-buffer:snapshot/floats",
        "light-buffer:snapshot/metadata",
      ],
    });
    expect(created.buffers).toHaveLength(2);
    expect(created.layouts).toHaveLength(1);
    expect(created.bindGroups).toMatchObject([
      {
        label: "lights/group-3",
        entries: [
          { binding: 0, resource: { buffer: { kind: "buffer" } } },
          { binding: 1, resource: { buffer: { kind: "buffer" } } },
        ],
      },
    ]);
  });

  it("preserves light GPU buffer creation diagnostics and skips later phases", () => {
    const result = createSnapshotLightBindGroupResources(
      snapshot({ lights: [light("point", 2)] }),
      {
        device: {
          queue: { writeBuffer: () => undefined },
          createBindGroupLayout: () => ({}),
          createBindGroup: () => ({}),
        },
      },
    );

    expect(result.valid).toBe(false);
    expect(result.layout).toBeNull();
    expect(result.bindGroup).toBeNull();
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "lightGpuBuffer.creationFailed",
      "lightGpuBuffer.creationFailed",
    ]);
  });

  it("preserves layout and bind group creation diagnostics", () => {
    const layoutFailure = createSnapshotLightBindGroupResources(
      snapshot({ lights: [light("spot", 3)] }),
      {
        device: deviceWithoutLayout(),
      },
    );
    const bindGroupFailure = createSnapshotLightBindGroupResources(
      snapshot({ lights: [light("spot", 4)] }),
      {
        device: deviceWithoutBindGroup(),
      },
    );

    expect(layoutFailure.valid).toBe(false);
    expect(layoutFailure.bindGroup).toBeNull();
    expect(
      layoutFailure.diagnostics.map((diagnostic) => diagnostic.code),
    ).toEqual(["lightBindGroupLayout.missingDeviceSupport"]);
    expect(bindGroupFailure.valid).toBe(false);
    expect(bindGroupFailure.layout?.valid).toBe(true);
    expect(
      bindGroupFailure.diagnostics.map((diagnostic) => diagnostic.code),
    ).toEqual(["lightBindGroupResource.missingDeviceSupport"]);
  });

  it("serializes successful snapshot light bind group resources without raw handles", () => {
    const result = createSnapshotLightBindGroupResources(
      snapshot({ lights: [light("directional", 5)] }),
      {
        device: device(),
        lightBuffer: { resourceKey: "light-buffer:json" },
      },
    );
    const value =
      createSnapshotLightBindGroupResourcesResultToJsonValue(result);
    const json = createSnapshotLightBindGroupResourcesResultToJson(result);

    expect(value).toMatchObject({
      valid: true,
      phases: {
        lightGpuBuffers: true,
        layout: true,
        descriptorPlan: true,
        bindGroup: true,
      },
      counts: {
        plannedLights: 1,
        lightGpuBuffers: 1,
        layouts: 1,
        bindGroups: 1,
        diagnostics: 0,
      },
      lightGpuBuffers: {
        resource: {
          resourceKey: "light-buffer:json",
          floatResourceKey: "light-buffer:json/floats",
          metadataResourceKey: "light-buffer:json/metadata",
        },
      },
      layout: {
        resource: {
          group: 3,
          layoutKey: "bind-group-layout:lights/group-3",
        },
      },
      descriptorPlan: {
        resourceKey: "bind-group:lights/group-3/light-buffer:json",
        layoutKey: "bind-group-layout:lights/group-3",
      },
      bindGroup: {
        resource: {
          resourceKey: "bind-group:lights/group-3/light-buffer:json",
          layoutKey: "bind-group-layout:lights/group-3",
        },
      },
      diagnostics: [],
    });
    expect(JSON.parse(json) as unknown).toEqual(value);
    expect(json).toBe(
      createSnapshotLightBindGroupResourcesResultToJson(result),
    );
    expect(json).not.toContain("Float32Array");
    expect(json).not.toContain("Int32Array");
    expect(json).not.toContain("raw-light");
    expect(json).not.toContain('"buffer":');
  });

  it("serializes no-op and failed snapshot light bind group resources", () => {
    const noOp = createSnapshotLightBindGroupResources(snapshot({}), {
      device: device(),
    });
    const bufferFailure = createSnapshotLightBindGroupResources(
      snapshot({ lights: [light("point", 6)] }),
      {
        device: {
          queue: { writeBuffer: () => undefined },
          createBindGroupLayout: () => ({}),
          createBindGroup: () => ({}),
        },
      },
    );
    const layoutFailure = createSnapshotLightBindGroupResources(
      snapshot({ lights: [light("spot", 7)] }),
      { device: deviceWithoutLayout() },
    );
    const bindGroupFailure = createSnapshotLightBindGroupResources(
      snapshot({ lights: [light("spot", 8)] }),
      { device: deviceWithoutBindGroup() },
    );

    expect(
      [noOp, bufferFailure, layoutFailure, bindGroupFailure].map((result) =>
        createSnapshotLightBindGroupResourcesResultToJsonValue(result),
      ),
    ).toMatchObject([
      {
        valid: true,
        phases: {
          lightGpuBuffers: true,
          layout: null,
          descriptorPlan: null,
          bindGroup: null,
        },
        counts: {
          plannedLights: 0,
          lightGpuBuffers: 0,
          layouts: 0,
          bindGroups: 0,
          diagnostics: 0,
        },
      },
      {
        valid: false,
        phases: {
          lightGpuBuffers: false,
          layout: null,
          descriptorPlan: null,
          bindGroup: null,
        },
        diagnostics: [
          { code: "lightGpuBuffer.creationFailed" },
          { code: "lightGpuBuffer.creationFailed" },
        ],
      },
      {
        valid: false,
        phases: {
          lightGpuBuffers: true,
          layout: false,
          descriptorPlan: null,
          bindGroup: null,
        },
        diagnostics: [{ code: "lightBindGroupLayout.missingDeviceSupport" }],
      },
      {
        valid: false,
        phases: {
          lightGpuBuffers: true,
          layout: true,
          descriptorPlan: true,
          bindGroup: false,
        },
        diagnostics: [{ code: "lightBindGroupResource.missingDeviceSupport" }],
      },
    ]);
  });

  it("adapts snapshot light bind group success and no-op results into resource summaries", () => {
    const success = createResourceSummary(
      snapshotLightBindGroupResourcesToSummaryInput(
        createSnapshotLightBindGroupResources(
          snapshot({ lights: [light("directional", 9)] }),
          { device: device() },
        ),
      ),
    );
    const noOp = createResourceSummary(
      snapshotLightBindGroupResourcesToSummaryInput(
        createSnapshotLightBindGroupResources(snapshot({}), {
          device: device(),
        }),
      ),
    );

    expect(success.counts).toMatchObject({
      lightBuffers: 1,
      lightGpuBuffers: 1,
      lightBindGroups: 1,
      warnings: 0,
      errors: 0,
    });
    expect(success.diagnostics).toEqual([]);
    expect(noOp.counts).toMatchObject({
      lightBuffers: 1,
      lightGpuBuffers: 0,
      lightBindGroups: 0,
      warnings: 0,
      errors: 0,
    });
    expect(noOp.diagnostics).toEqual([]);
  });

  it("adapts snapshot light bind group failures into resource summary diagnostics", () => {
    const bufferFailure = createResourceSummary(
      snapshotLightBindGroupResourcesToSummaryInput(
        createSnapshotLightBindGroupResources(
          snapshot({ lights: [light("point", 10)] }),
          {
            device: {
              queue: { writeBuffer: () => undefined },
              createBindGroupLayout: () => ({}),
              createBindGroup: () => ({}),
            },
          },
        ),
      ),
    );
    const bindGroupFailure = createResourceSummary(
      snapshotLightBindGroupResourcesToSummaryInput(
        createSnapshotLightBindGroupResources(
          snapshot({ lights: [light("spot", 11)] }),
          { device: deviceWithoutBindGroup() },
        ),
      ),
    );

    expect(bufferFailure.counts).toMatchObject({
      lightBuffers: 1,
      lightGpuBuffers: 0,
      lightBindGroups: 0,
      warnings: 2,
      errors: 0,
    });
    expect(
      bufferFailure.diagnostics.map((diagnostic) => diagnostic.code),
    ).toEqual([
      "lightGpuBuffer.creationFailed",
      "lightGpuBuffer.creationFailed",
    ]);
    expect(bindGroupFailure.counts).toMatchObject({
      lightBuffers: 1,
      lightGpuBuffers: 1,
      lightBindGroups: 0,
      warnings: 1,
      errors: 0,
    });
    expect(
      bindGroupFailure.diagnostics.map((diagnostic) => diagnostic.code),
    ).toEqual(["lightBindGroupResource.missingDeviceSupport"]);
  });

  it("creates focused resource summary reports for snapshot light resources", () => {
    const success = createSnapshotLightResourceSummaryReport(
      createSnapshotLightBindGroupResources(
        snapshot({ lights: [light("directional", 12)] }),
        { device: device() },
      ),
    );
    const noOp = createSnapshotLightResourceSummaryReport(
      createSnapshotLightBindGroupResources(snapshot({}), {
        device: device(),
      }),
    );
    const failure = createSnapshotLightResourceSummaryReport(
      createSnapshotLightBindGroupResources(
        snapshot({ lights: [light("point", 13)] }),
        {
          device: {
            queue: { writeBuffer: () => undefined },
            createBindGroupLayout: () => ({}),
            createBindGroup: () => ({}),
          },
        },
      ),
    );

    expect(success.counts).toMatchObject({
      lightBuffers: 1,
      lightGpuBuffers: 1,
      lightBindGroups: 1,
      warnings: 0,
      errors: 0,
    });
    expect(noOp.counts).toMatchObject({
      lightBuffers: 1,
      lightGpuBuffers: 0,
      lightBindGroups: 0,
      warnings: 0,
      errors: 0,
    });
    expect(failure.counts).toMatchObject({
      lightBuffers: 1,
      lightGpuBuffers: 0,
      lightBindGroups: 0,
      warnings: 2,
      errors: 0,
    });
    expect(failure.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "lightGpuBuffer.creationFailed",
      "lightGpuBuffer.creationFailed",
    ]);
  });

  it("serializes focused snapshot light resource summaries without raw handles", () => {
    const result = createSnapshotLightBindGroupResources(
      snapshot({ lights: [light("directional", 14)] }),
      { device: device() },
    );
    const value = snapshotLightResourceSummaryReportToJsonValue(result);
    const json = snapshotLightResourceSummaryReportToJson(result);

    expect(value.counts).toMatchObject({
      lightBuffers: 1,
      lightGpuBuffers: 1,
      lightBindGroups: 1,
      warnings: 0,
      errors: 0,
    });
    expect(value.diagnostics).toEqual([]);
    expect(JSON.parse(json) as unknown).toEqual(value);
    expect(json).toBe(snapshotLightResourceSummaryReportToJson(result));
    expect(json).not.toContain("raw-light");
    expect(json).not.toContain("Float32Array");
    expect(json).not.toContain("Int32Array");
  });
});

function snapshot(input: {
  readonly lights?: readonly LightPacket[];
}): RenderSnapshot {
  return {
    frame: 1,
    views: [],
    meshDraws: [],
    lights: input.lights ?? [],
    environments: [],
    shadowRequests: [],
    bounds: [],
    transforms: new Float32Array(0),
    viewMatrices: new Float32Array(0),
    diagnostics: [],
    report: {
      views: 0,
      meshDraws: 0,
      lights: input.lights?.length ?? 0,
      environments: 0,
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

function device(
  created: {
    readonly buffers: WebGpuBufferCreateDescriptor[];
    readonly layouts: WebGpuBindGroupLayoutDescriptor[];
    readonly bindGroups: LightBindGroupCreationDescriptor[];
  } = { buffers: [], layouts: [], bindGroups: [] },
): SnapshotLightBindGroupDeviceLike {
  return {
    queue: {
      writeBuffer: () => undefined,
    },
    createBuffer: (descriptor) => {
      created.buffers.push(descriptor);
      return { kind: "buffer", descriptor };
    },
    createBindGroupLayout: (descriptor) => {
      created.layouts.push(descriptor);
      return { kind: "layout", descriptor };
    },
    createBindGroup: (descriptor) => {
      created.bindGroups.push(descriptor);
      return { kind: "bind-group", descriptor };
    },
  };
}

function deviceWithoutLayout(): SnapshotLightBindGroupDeviceLike {
  return {
    queue: {
      writeBuffer: () => undefined,
    },
    createBuffer: (descriptor) => ({ kind: "buffer", descriptor }),
    createBindGroup: (descriptor) => ({ kind: "bind-group", descriptor }),
  };
}

function deviceWithoutBindGroup(): SnapshotLightBindGroupDeviceLike {
  return {
    queue: {
      writeBuffer: () => undefined,
    },
    createBuffer: (descriptor) => ({ kind: "buffer", descriptor }),
    createBindGroupLayout: (descriptor) => ({ kind: "layout", descriptor }),
  };
}

function createResourceSummary(
  input: ReturnType<typeof snapshotLightBindGroupResourcesToSummaryInput>,
) {
  return createRenderResourceSummaryReport({
    meshResources: [],
    materialResources: [],
    viewUniformResources: [],
    shaderResources: [],
    pipelines: [],
    ...input,
  });
}
