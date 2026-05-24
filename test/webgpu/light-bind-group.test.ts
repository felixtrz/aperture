import { describe, expect, it } from "vitest";

import {
  createBindGroupResourceCache,
  createLightBindGroupResource,
  createLightBindGroupResourceResultToJson,
  createLightBindGroupResourceResultToJsonValue,
  createLightBindGroupDescriptorPlan,
  lightBindGroupDescriptorPlanToJson,
  lightBindGroupDescriptorPlanToJsonValue,
  lightBindGroupResourceKey,
  LOCAL_LIGHT_CLUSTER_CELLS_BINDING,
  LOCAL_LIGHT_CLUSTER_COOKIE_MATRIX_BINDING,
  LOCAL_LIGHT_CLUSTER_COOKIE_SAMPLER_BINDING,
  LOCAL_LIGHT_CLUSTER_COOKIE_TEXTURE_BINDING,
  LOCAL_LIGHT_CLUSTER_INDICES_BINDING,
  LOCAL_LIGHT_CLUSTER_METADATA_BINDING,
  LOCAL_LIGHT_CLUSTER_METADATA_WORD_STRIDE,
  LOCAL_LIGHT_CLUSTER_PARAMS_BINDING,
  type LightBindGroupCreationDescriptor,
  type LightBindGroupLayoutResource,
  type LightBindGroupResource,
  type LightGpuBufferResource,
  type LocalLightClusterCookieResources,
  type LocalLightClusterGpuResource,
} from "@aperture-engine/webgpu";

describe("light bind group descriptor planning", () => {
  it("plans stable entries from renderer-owned light GPU buffer resources", () => {
    const resource = lightGpuBufferResource();
    const plan = createLightBindGroupDescriptorPlan({
      lightGpuBufferResource: resource,
      layoutKey: "bind-group-layout:lights/group-3",
    });

    expect(plan).toMatchObject({
      valid: true,
      group: 3,
      label: "lights/group-3",
      resourceKey: lightBindGroupResourceKey("light-buffer:main"),
      layoutKey: "bind-group-layout:lights/group-3",
      diagnostics: [],
      entries: [
        {
          binding: 0,
          resourceKey: "light-buffer:main/floats",
          resource: { buffer: { handle: "raw-light-float-buffer" } },
        },
        {
          binding: 1,
          resourceKey: "light-buffer:main/metadata",
          resource: { buffer: { handle: "raw-light-metadata-buffer" } },
        },
      ],
    });
  });

  it("serializes JSON-safe summaries without raw GPU buffer handles", () => {
    const plan = createLightBindGroupDescriptorPlan({
      lightGpuBufferResource: lightGpuBufferResource(),
      layoutKey: "bind-group-layout:lights/group-3",
    });
    const value = lightBindGroupDescriptorPlanToJsonValue(plan);
    const json = lightBindGroupDescriptorPlanToJson(plan);

    expect(value).toEqual({
      valid: true,
      group: 3,
      label: "lights/group-3",
      resourceKey: "bind-group:lights/group-3/light-buffer:main",
      layoutKey: "bind-group-layout:lights/group-3",
      entries: [
        {
          binding: 0,
          resourceKey: "light-buffer:main/floats",
          resourceKind: "buffer",
        },
        {
          binding: 1,
          resourceKey: "light-buffer:main/metadata",
          resourceKind: "buffer",
        },
      ],
      diagnostics: [],
    });
    expect(JSON.parse(json) as unknown).toEqual(value);
    expect(json).toBe(lightBindGroupDescriptorPlanToJson(plan));
    expect(json).not.toContain("raw-light-float-buffer");
    expect(json).not.toContain("raw-light-metadata-buffer");
    expect(json).not.toContain('"resource":');
  });

  it("diagnoses missing light GPU buffer resources and layout keys", () => {
    expect(
      createLightBindGroupDescriptorPlan({
        lightGpuBufferResource: null,
        layoutKey: null,
      }),
    ).toEqual({
      valid: false,
      group: 3,
      label: "lights/group-3",
      resourceKey: null,
      layoutKey: null,
      entries: [],
      diagnostics: [
        {
          code: "lightBindGroup.missingLayoutKey",
          message: "Light bind group planning requires a layout resource key.",
        },
        {
          code: "lightBindGroup.missingLightGpuBufferResource",
          message:
            "Light bind group planning requires a light GPU buffer resource.",
        },
      ],
    });
  });

  it("supports custom group and label values", () => {
    expect(
      createLightBindGroupDescriptorPlan({
        lightGpuBufferResource: lightGpuBufferResource(),
        layoutKey: "bind-group-layout:lights/group-4",
        group: 4,
        label: "lights/custom",
      }),
    ).toMatchObject({
      valid: true,
      group: 4,
      label: "lights/custom",
      resourceKey: "bind-group:lights/group-4/light-buffer:main",
    });
  });

  it("plans transmission scene color resources as pipeline-scoped light bindings", () => {
    const plan = createLightBindGroupDescriptorPlan({
      lightGpuBufferResource: lightGpuBufferResource(),
      layoutKey: "bind-group-layout:lights/group-3",
      pipelineKey: "standard|transmission|blend|back|less|alpha",
      transmissionSceneColorResources: {
        texture: {
          resourceKey:
            "standard-transmission-grab:scene-color:960:960:bgra8unorm",
          view: { handle: "raw-transmission-scene-color-view" },
        },
        sampler: {
          resourceKey: "standard-transmission-grab:sampler",
          sampler: { handle: "raw-transmission-scene-color-sampler" },
        },
      },
    });

    expect(plan).toMatchObject({
      valid: true,
      resourceKey:
        "bind-group:lights/group-3/light-buffer:main|pipeline:standard|transmission|blend|back|less|alpha",
      pipelineKey: "standard|transmission|blend|back|less|alpha",
      entries: [
        { binding: 0, resourceKey: "light-buffer:main/floats" },
        { binding: 1, resourceKey: "light-buffer:main/metadata" },
        {
          binding: 14,
          resourceKey:
            "standard-transmission-grab:scene-color:960:960:bgra8unorm",
        },
        {
          binding: 15,
          resourceKey: "standard-transmission-grab:sampler",
        },
      ],
    });
  });

  it("plans clustered local-light storage entries for StandardMaterial variants", () => {
    const plan = createLightBindGroupDescriptorPlan({
      lightGpuBufferResource: lightGpuBufferResource(),
      layoutKey: "bind-group-layout:lights/group-3/clustered",
      localLightClusterResources: localLightClusterResource(),
    });

    expect(plan).toMatchObject({
      valid: true,
      resourceKey: "bind-group:lights/group-3/light-buffer:main",
      layoutKey: "bind-group-layout:lights/group-3/clustered",
      entries: [
        { binding: 0, resourceKey: "light-buffer:main/floats" },
        { binding: 1, resourceKey: "light-buffer:main/metadata" },
        {
          binding: LOCAL_LIGHT_CLUSTER_PARAMS_BINDING,
          resourceKey: "local-light-cluster:test/params",
        },
        {
          binding: LOCAL_LIGHT_CLUSTER_CELLS_BINDING,
          resourceKey: "local-light-cluster:test/cells",
        },
        {
          binding: LOCAL_LIGHT_CLUSTER_INDICES_BINDING,
          resourceKey: "local-light-cluster:test/indices",
        },
        {
          binding: LOCAL_LIGHT_CLUSTER_METADATA_BINDING,
          resourceKey: "local-light-cluster:test/metadata",
        },
      ],
    });
  });

  it("plans clustered local-light cookie resources for StandardMaterial variants", () => {
    const plan = createLightBindGroupDescriptorPlan({
      lightGpuBufferResource: lightGpuBufferResource(),
      layoutKey: "bind-group-layout:lights/group-3/clustered-cookie",
      localLightClusterResources: localLightClusterResource(),
      localLightCookieResources: localLightCookieResources(),
    });

    expect(plan).toMatchObject({
      valid: true,
      entries: [
        { binding: 0, resourceKey: "light-buffer:main/floats" },
        { binding: 1, resourceKey: "light-buffer:main/metadata" },
        {
          binding: LOCAL_LIGHT_CLUSTER_PARAMS_BINDING,
          resourceKey: "local-light-cluster:test/params",
        },
        {
          binding: LOCAL_LIGHT_CLUSTER_CELLS_BINDING,
          resourceKey: "local-light-cluster:test/cells",
        },
        {
          binding: LOCAL_LIGHT_CLUSTER_INDICES_BINDING,
          resourceKey: "local-light-cluster:test/indices",
        },
        {
          binding: LOCAL_LIGHT_CLUSTER_METADATA_BINDING,
          resourceKey: "local-light-cluster:test/metadata",
        },
        {
          binding: LOCAL_LIGHT_CLUSTER_COOKIE_TEXTURE_BINDING,
          resourceKey: "local-light-cookie:texture",
        },
        {
          binding: LOCAL_LIGHT_CLUSTER_COOKIE_SAMPLER_BINDING,
          resourceKey: "local-light-cookie:sampler",
        },
        {
          binding: LOCAL_LIGHT_CLUSTER_COOKIE_MATRIX_BINDING,
          resourceKey: "local-light-cookie:matrix",
        },
      ],
    });
  });

  it("creates renderer-owned light bind group resources from descriptor plans", () => {
    const descriptors: LightBindGroupCreationDescriptor[] = [];
    const result = createLightBindGroupResource({
      device: {
        createBindGroup: (descriptor) => {
          descriptors.push(descriptor);
          return { handle: "raw-light-bind-group" };
        },
      },
      plan: validPlan(),
      layout: layoutResource(),
    });

    expect(result).toMatchObject({
      valid: true,
      resource: {
        group: 3,
        resourceKey: "bind-group:lights/group-3/light-buffer:main",
        layoutKey: "bind-group-layout:lights/group-3",
        bindGroup: { handle: "raw-light-bind-group" },
        entryResourceKeys: [
          "light-buffer:main/floats",
          "light-buffer:main/metadata",
        ],
      },
      diagnostics: [],
    });
    expect(descriptors).toEqual([
      {
        label: "lights/group-3",
        layout: { handle: "raw-light-layout" },
        entries: [
          {
            binding: 0,
            resource: {
              buffer: { handle: "raw-light-float-buffer" },
            },
          },
          {
            binding: 1,
            resource: {
              buffer: { handle: "raw-light-metadata-buffer" },
            },
          },
        ],
      },
    ]);
  });

  it("reuses cached light bind group resources until layout or entries change", () => {
    const descriptors: LightBindGroupCreationDescriptor[] = [];
    const cache = createBindGroupResourceCache<LightBindGroupResource>();
    const device = {
      createBindGroup: (descriptor: LightBindGroupCreationDescriptor) => {
        descriptors.push(descriptor);
        return { handle: `raw-light-bind-group-${descriptors.length}` };
      },
    };

    const first = createLightBindGroupResource({
      device,
      plan: validPlan(),
      layout: layoutResource(),
      bindGroupCache: cache,
    });
    const second = createLightBindGroupResource({
      device,
      plan: validPlan(),
      layout: layoutResource(),
      bindGroupCache: cache,
    });
    const transmission = createLightBindGroupResource({
      device,
      plan: createLightBindGroupDescriptorPlan({
        lightGpuBufferResource: lightGpuBufferResource(),
        layoutKey: "bind-group-layout:lights/group-3",
        pipelineKey: "standard|transmission|blend|back|less|alpha",
        transmissionSceneColorResources: {
          texture: {
            resourceKey:
              "standard-transmission-grab:scene-color:960:960:bgra8unorm",
            view: { handle: "raw-transmission-scene-color-view" },
          },
          sampler: {
            resourceKey: "standard-transmission-grab:sampler",
            sampler: { handle: "raw-transmission-scene-color-sampler" },
          },
        },
      }),
      layout: layoutResource(),
      bindGroupCache: cache,
    });

    expect(first.valid).toBe(true);
    expect(second.resource).toBe(first.resource);
    expect(transmission.resource).not.toBe(first.resource);
    expect(descriptors).toHaveLength(2);
    expect(cache).toMatchObject({
      created: 2,
      reused: 1,
    });
  });

  it("diagnoses null and invalid light bind group descriptor plans", () => {
    expect(
      createLightBindGroupResource({
        device: { createBindGroup: () => ({}) },
        plan: null,
        layout: layoutResource(),
      }),
    ).toMatchObject({
      valid: false,
      resource: null,
      diagnostics: [{ code: "lightBindGroupResource.nullDescriptorPlan" }],
    });

    expect(
      createLightBindGroupResource({
        device: { createBindGroup: () => ({}) },
        plan: createLightBindGroupDescriptorPlan({
          lightGpuBufferResource: null,
          layoutKey: "bind-group-layout:lights/group-3",
        }),
        layout: layoutResource(),
      }),
    ).toMatchObject({
      valid: false,
      resource: null,
      diagnostics: [{ code: "lightBindGroupResource.invalidDescriptorPlan" }],
    });
  });

  it("diagnoses missing layout resources and missing bind group device support", () => {
    expect(
      createLightBindGroupResource({
        device: { createBindGroup: () => ({}) },
        plan: validPlan(),
        layout: null,
      }),
    ).toMatchObject({
      valid: false,
      resource: null,
      diagnostics: [
        {
          code: "lightBindGroupResource.missingLayout",
          resourceKey: "bind-group:lights/group-3/light-buffer:main",
          layoutKey: "bind-group-layout:lights/group-3",
        },
      ],
    });

    expect(
      createLightBindGroupResource({
        device: {},
        plan: validPlan(),
        layout: layoutResource(),
      }),
    ).toMatchObject({
      valid: false,
      resource: null,
      diagnostics: [
        {
          code: "lightBindGroupResource.missingDeviceSupport",
          resourceKey: "bind-group:lights/group-3/light-buffer:main",
          layoutKey: "bind-group-layout:lights/group-3",
        },
      ],
    });
  });

  it("diagnoses bind group creation failures", () => {
    expect(
      createLightBindGroupResource({
        device: {
          createBindGroup: () => {
            throw new Error("bind group denied");
          },
        },
        plan: validPlan(),
        layout: layoutResource(),
      }),
    ).toEqual({
      valid: false,
      resource: null,
      diagnostics: [
        {
          code: "lightBindGroupResource.creationFailed",
          resourceKey: "bind-group:lights/group-3/light-buffer:main",
          layoutKey: "bind-group-layout:lights/group-3",
          message:
            "Failed to create light bind group 'bind-group:lights/group-3/light-buffer:main': bind group denied",
        },
      ],
    });
  });

  it("serializes successful light bind group resources without raw handles", () => {
    const result = createLightBindGroupResource({
      device: {
        createBindGroup: () => ({ handle: "raw-light-bind-group" }),
      },
      plan: validPlan(),
      layout: layoutResource(),
    });
    const value = createLightBindGroupResourceResultToJsonValue(result);
    const json = createLightBindGroupResourceResultToJson(result);

    expect(value).toEqual({
      valid: true,
      resource: {
        group: 3,
        resourceKey: "bind-group:lights/group-3/light-buffer:main",
        layoutKey: "bind-group-layout:lights/group-3",
        entryResourceKeys: [
          "light-buffer:main/floats",
          "light-buffer:main/metadata",
        ],
      },
      counts: {
        bindGroups: 1,
        entries: 2,
        diagnostics: 0,
      },
      diagnostics: [],
    });
    expect(JSON.parse(json) as unknown).toEqual(value);
    expect(json).toBe(createLightBindGroupResourceResultToJson(result));
    expect(json).not.toContain("raw-light-bind-group");
    expect(json).not.toContain("raw-light-layout");
    expect(json).not.toContain("raw-light-float-buffer");
    expect(json).not.toContain("raw-light-metadata-buffer");
    expect(json).not.toContain('"bindGroup"');
    expect(json).not.toContain('"layout"');
  });

  it("serializes light bind group resource failures", () => {
    const cases = [
      createLightBindGroupResource({
        device: { createBindGroup: () => ({}) },
        plan: null,
        layout: layoutResource(),
      }),
      createLightBindGroupResource({
        device: { createBindGroup: () => ({}) },
        plan: createLightBindGroupDescriptorPlan({
          lightGpuBufferResource: null,
          layoutKey: "bind-group-layout:lights/group-3",
        }),
        layout: layoutResource(),
      }),
      createLightBindGroupResource({
        device: { createBindGroup: () => ({}) },
        plan: validPlan(),
        layout: null,
      }),
      createLightBindGroupResource({
        device: {},
        plan: validPlan(),
        layout: layoutResource(),
      }),
    ];

    expect(
      cases.map((result) =>
        createLightBindGroupResourceResultToJsonValue(result),
      ),
    ).toMatchObject([
      {
        valid: false,
        resource: null,
        counts: { bindGroups: 0, entries: 0, diagnostics: 1 },
        diagnostics: [{ code: "lightBindGroupResource.nullDescriptorPlan" }],
      },
      {
        valid: false,
        resource: null,
        counts: { bindGroups: 0, entries: 0, diagnostics: 1 },
        diagnostics: [{ code: "lightBindGroupResource.invalidDescriptorPlan" }],
      },
      {
        valid: false,
        resource: null,
        counts: { bindGroups: 0, entries: 0, diagnostics: 1 },
        diagnostics: [{ code: "lightBindGroupResource.missingLayout" }],
      },
      {
        valid: false,
        resource: null,
        counts: { bindGroups: 0, entries: 0, diagnostics: 1 },
        diagnostics: [{ code: "lightBindGroupResource.missingDeviceSupport" }],
      },
    ]);
  });
});

function lightGpuBufferResource(): LightGpuBufferResource {
  return {
    resourceKey: "light-buffer:main",
    floatResourceKey: "light-buffer:main/floats",
    metadataResourceKey: "light-buffer:main/metadata",
    floatBuffer: { handle: "raw-light-float-buffer" },
    metadataBuffer: { handle: "raw-light-metadata-buffer" },
    count: 1,
  };
}

function localLightClusterResource(): LocalLightClusterGpuResource {
  return {
    resourceKey: "local-light-cluster:test",
    paramsResourceKey: "local-light-cluster:test/params",
    cellsResourceKey: "local-light-cluster:test/cells",
    indicesResourceKey: "local-light-cluster:test/indices",
    metadataResourceKey: "local-light-cluster:test/metadata",
    paramsBuffer: { handle: "raw-local-light-cluster-params" },
    cellsBuffer: { handle: "raw-local-light-cluster-cells" },
    indicesBuffer: { handle: "raw-local-light-cluster-indices" },
    metadataBuffer: { handle: "raw-local-light-cluster-metadata" },
    descriptor: {
      resourceKey: "local-light-cluster:test",
      enabled: true,
      fallbackReason: null,
      totalLights: 16,
      totalLocalLights: 16,
      clusteredLocalLights: 16,
      layerMask: null,
      lightSetKey: "layers:all|lights:test",
      coordinateSpace: "view-depth",
      viewId: 1,
      boundsMin: { x: -1, y: -1, z: -8 },
      boundsMax: { x: 1, y: 1, z: -1 },
      dimensions: { x: 8, y: 4, z: 8 },
      cellCount: 256,
      populatedCells: 4,
      maxLightsPerPopulatedCell: 4,
      averageLightsPerPopulatedCell: 2,
      totalAssignedLightReferences: 8,
      occupancyHash: 123,
      overflowedCells: 0,
      maxLightsPerCell: 64,
      buildPressure: {
        assignmentStrategy: "light-range",
        naiveCellLightPairTests: 4096,
        lightCellRangeTests: 16,
        lightCellWriteAttempts: 8,
        storedLightReferences: 8,
        skippedOverflowReferences: 0,
      },
      shadowCookieMetadata: {
        wordsPerLight: LOCAL_LIGHT_CLUSTER_METADATA_WORD_STRIDE,
        totalMetadataLights: 16,
        shadow: {
          status: "not-requested",
          samplingSupported: false,
          localRequestCount: 0,
          clusteredLightCount: 0,
          supportedLightCount: 0,
          hardFilterLightCount: 0,
          softFilterLightCount: 0,
          maxFilterRadiusTexels: 0,
          fallbackReason: null,
        },
        cookie: {
          status: "not-requested",
          samplingSupported: false,
          localRequestCount: 0,
          clusteredLightCount: 0,
          supportedLightCount: 0,
          fallbackReason: null,
        },
      },
      params: new Float32Array(28),
      cells: new Uint32Array(512),
      indices: new Uint32Array([0]),
      metadata: new Uint32Array(16 * LOCAL_LIGHT_CLUSTER_METADATA_WORD_STRIDE),
    },
  };
}

function localLightCookieResources(): LocalLightClusterCookieResources {
  return {
    matrixResource: {
      resourceKey: "local-light-cookie:matrix",
      label: "LocalLightCookieMatrices",
      buffer: { handle: "raw-local-light-cookie-matrix-buffer" },
      matrixCount: 1,
      entryLightIds: [100],
    },
    textureResource: {
      resourceKey: "local-light-cookie:texture",
      texture: { handle: "raw-local-light-cookie-texture" },
      view: { handle: "raw-local-light-cookie-texture-view" },
      descriptor: {
        size: [1, 1, 1],
        format: "rgba8unorm",
        usage: 0,
      },
    },
    samplerResource: {
      resourceKey: "local-light-cookie:sampler",
      sampler: { handle: "raw-local-light-cookie-sampler" },
      descriptor: {
        addressModeU: "clamp-to-edge",
        addressModeV: "clamp-to-edge",
        addressModeW: "clamp-to-edge",
        magFilter: "linear",
        minFilter: "linear",
        mipmapFilter: "linear",
        lodMinClamp: 0,
        lodMaxClamp: 32,
        maxAnisotropy: 1,
      },
    },
    textureViewDimension: "2d",
    textureKey: "local-light-cookie:texture",
    samplerKey: "local-light-cookie:sampler",
    supportedResources: [
      {
        lightId: 100,
        textureKey: "local-light-cookie:texture",
        samplerKey: "local-light-cookie:sampler",
        textureViewDimension: "2d",
        matrixBaseIndex: 0,
      },
    ],
  };
}

function validPlan() {
  return createLightBindGroupDescriptorPlan({
    lightGpuBufferResource: lightGpuBufferResource(),
    layoutKey: "bind-group-layout:lights/group-3",
  });
}

function layoutResource(): LightBindGroupLayoutResource {
  return {
    group: 3,
    layoutKey: "bind-group-layout:lights/group-3",
    layout: { handle: "raw-light-layout" },
    descriptor: {
      label: "lights/group-3",
      entries: [],
    },
  };
}
