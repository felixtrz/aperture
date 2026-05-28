import {
  STANDARD_LIGHT_CASCADED_SHADOW_BIND_GROUP_LAYOUT_KEY,
  STANDARD_LIGHT_CASCADED_SHADOW_IBL_BIND_GROUP_LAYOUT_KEY,
  STANDARD_LIGHT_MULTI_SHADOW_BIND_GROUP_LAYOUT_KEY,
  STANDARD_LIGHT_SHADOW_BIND_GROUP_LAYOUT_KEY,
  createStandardLightCascadedShadowBindGroupLayoutDescriptor,
  createStandardLightIblBindGroupLayoutDescriptor,
  createStandardLightMultiShadowBindGroupDescriptorPlan,
  createStandardLightMultiShadowBindGroupLayoutDescriptor,
  createStandardLightShadowBindGroupDescriptorPlan,
  createStandardLightShadowBindGroupLayoutDescriptor,
  createStandardLightShadowBindGroupLayoutResource,
  createStandardLightShadowBindGroupResource,
} from "@aperture-engine/webgpu/test-support";
import { describe, expect, it } from "vitest";

describe("StandardMaterial light/shadow bind group", () => {
  it("plans a browser-safe group 3 layout for lights and receiver shadows", () => {
    expect(createStandardLightShadowBindGroupLayoutDescriptor()).toEqual({
      label: STANDARD_LIGHT_SHADOW_BIND_GROUP_LAYOUT_KEY,
      entries: [
        { binding: 0, visibility: 2, buffer: { type: "read-only-storage" } },
        { binding: 1, visibility: 2, buffer: { type: "read-only-storage" } },
        { binding: 2, visibility: 3, buffer: { type: "read-only-storage" } },
        {
          binding: 3,
          visibility: 2,
          texture: {
            sampleType: "depth",
            viewDimension: "2d",
            multisampled: false,
          },
        },
        { binding: 4, visibility: 2, sampler: { type: "comparison" } },
      ],
    });
  });

  it("plans a browser-safe group 3 layout for cascaded directional shadow arrays", () => {
    expect(
      createStandardLightCascadedShadowBindGroupLayoutDescriptor(),
    ).toEqual({
      label: STANDARD_LIGHT_CASCADED_SHADOW_BIND_GROUP_LAYOUT_KEY,
      entries: [
        { binding: 0, visibility: 2, buffer: { type: "read-only-storage" } },
        { binding: 1, visibility: 2, buffer: { type: "read-only-storage" } },
        { binding: 2, visibility: 3, buffer: { type: "read-only-storage" } },
        {
          binding: 3,
          visibility: 2,
          texture: {
            sampleType: "depth",
            viewDimension: "2d-array",
            multisampled: false,
          },
        },
        { binding: 4, visibility: 2, sampler: { type: "comparison" } },
      ],
    });
  });

  it("plans a combined cascaded shadow and IBL group 3 layout", () => {
    expect(
      createStandardLightIblBindGroupLayoutDescriptor({
        shadowMap: true,
        cascadedShadowMap: true,
        specularProof: true,
      }),
    ).toEqual({
      label: STANDARD_LIGHT_CASCADED_SHADOW_IBL_BIND_GROUP_LAYOUT_KEY,
      entries: [
        { binding: 0, visibility: 2, buffer: { type: "read-only-storage" } },
        { binding: 1, visibility: 2, buffer: { type: "read-only-storage" } },
        { binding: 2, visibility: 3, buffer: { type: "read-only-storage" } },
        {
          binding: 3,
          visibility: 2,
          texture: {
            sampleType: "depth",
            viewDimension: "2d-array",
            multisampled: false,
          },
        },
        { binding: 4, visibility: 2, sampler: { type: "comparison" } },
        {
          binding: 5,
          visibility: 2,
          texture: {
            sampleType: "float",
            viewDimension: "cube",
            multisampled: false,
          },
        },
        { binding: 6, visibility: 2, sampler: { type: "filtering" } },
        {
          binding: 7,
          visibility: 2,
          texture: {
            sampleType: "float",
            viewDimension: "cube",
            multisampled: false,
          },
        },
      ],
    });
  });

  it("plans separate group 3 bindings for directional, spot, and point shadow receivers", () => {
    expect(createStandardLightMultiShadowBindGroupLayoutDescriptor()).toEqual({
      label: STANDARD_LIGHT_MULTI_SHADOW_BIND_GROUP_LAYOUT_KEY,
      entries: [
        { binding: 0, visibility: 2, buffer: { type: "read-only-storage" } },
        { binding: 1, visibility: 2, buffer: { type: "read-only-storage" } },
        { binding: 2, visibility: 3, buffer: { type: "read-only-storage" } },
        {
          binding: 3,
          visibility: 2,
          texture: {
            sampleType: "depth",
            viewDimension: "2d",
            multisampled: false,
          },
        },
        { binding: 4, visibility: 2, sampler: { type: "comparison" } },
        { binding: 5, visibility: 3, buffer: { type: "read-only-storage" } },
        {
          binding: 6,
          visibility: 2,
          texture: {
            sampleType: "depth",
            viewDimension: "2d",
            multisampled: false,
          },
        },
        { binding: 7, visibility: 2, sampler: { type: "comparison" } },
        { binding: 8, visibility: 3, buffer: { type: "read-only-storage" } },
        {
          binding: 9,
          visibility: 2,
          texture: {
            sampleType: "depth",
            viewDimension: "cube",
            multisampled: false,
          },
        },
        { binding: 10, visibility: 2, sampler: { type: "comparison" } },
      ],
    });
  });

  it("uses compact group 3 bindings for clustered local spot and point shadow receivers", () => {
    expect(
      createStandardLightMultiShadowBindGroupLayoutDescriptor({
        clusteredLocalLights: true,
      }),
    ).toMatchObject({
      label: STANDARD_LIGHT_MULTI_SHADOW_BIND_GROUP_LAYOUT_KEY,
      entries: [
        { binding: 0, visibility: 2, buffer: { type: "read-only-storage" } },
        { binding: 1, visibility: 2, buffer: { type: "read-only-storage" } },
        { binding: 2, visibility: 3, buffer: { type: "read-only-storage" } },
        {
          binding: 3,
          visibility: 2,
          texture: {
            sampleType: "depth",
            viewDimension: "2d",
            multisampled: false,
          },
        },
        { binding: 4, visibility: 2, sampler: { type: "comparison" } },
        { binding: 8, visibility: 3, buffer: { type: "read-only-storage" } },
        {
          binding: 9,
          visibility: 2,
          texture: {
            sampleType: "depth",
            viewDimension: "cube",
            multisampled: false,
          },
        },
        { binding: 10, visibility: 2, sampler: { type: "comparison" } },
        { binding: 16, visibility: 2, buffer: { type: "read-only-storage" } },
        { binding: 17, visibility: 2, buffer: { type: "read-only-storage" } },
        { binding: 18, visibility: 2, buffer: { type: "read-only-storage" } },
        { binding: 19, visibility: 2, buffer: { type: "read-only-storage" } },
      ],
    });
  });

  it("uses a depth-array binding for compact clustered local multi-spot shadow receivers", () => {
    const descriptor = createStandardLightMultiShadowBindGroupLayoutDescriptor({
      clusteredLocalLights: true,
      clusteredLocalLightArrayShadows: true,
    });

    expect(descriptor.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          binding: 3,
          texture: expect.objectContaining({ viewDimension: "2d-array" }),
        }),
        expect.objectContaining({
          binding: 9,
          texture: expect.objectContaining({ viewDimension: "cube" }),
        }),
      ]),
    );
    expect(descriptor.entries).not.toContainEqual(
      expect.objectContaining({ binding: 5 }),
    );
    expect(descriptor.entries).not.toContainEqual(
      expect.objectContaining({ binding: 6 }),
    );
    expect(descriptor.entries).not.toContainEqual(
      expect.objectContaining({ binding: 7 }),
    );
  });

  it("uses a depth-array binding for flattened clustered point-shadow receivers", () => {
    const descriptor = createStandardLightMultiShadowBindGroupLayoutDescriptor({
      clusteredLocalLights: true,
      clusteredLocalLightArrayShadows: true,
      clusteredLocalLightPointArrayShadows: true,
    });

    expect(descriptor.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          binding: 3,
          texture: expect.objectContaining({ viewDimension: "2d-array" }),
        }),
        expect.objectContaining({
          binding: 9,
          texture: expect.objectContaining({ viewDimension: "2d-array" }),
        }),
      ]),
    );
  });

  it("keeps packed local shadows plus cookies within a WebGPU-minimum group layout", () => {
    const descriptor = createStandardLightMultiShadowBindGroupLayoutDescriptor({
      clusteredLocalLights: true,
      clusteredLocalLightArrayShadows: true,
      clusteredLocalLightCookies: true,
      clusteredLocalLightShadowCookies: true,
      clusteredLocalLightCookieTextureViewDimension: "2d",
    });

    expect(descriptor.entries).toHaveLength(14);
    expect(descriptor.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          binding: 3,
          texture: expect.objectContaining({ viewDimension: "2d-array" }),
        }),
        expect.objectContaining({
          binding: 9,
          texture: expect.objectContaining({ viewDimension: "cube" }),
        }),
        expect.objectContaining({
          binding: 20,
          texture: expect.objectContaining({ viewDimension: "2d" }),
        }),
        expect.objectContaining({ binding: 21 }),
      ]),
    );
    expect(descriptor.entries).not.toContainEqual(
      expect.objectContaining({ binding: 22 }),
    );
    expect(descriptor.entries).not.toContainEqual(
      expect.objectContaining({ binding: 5 }),
    );
    expect(descriptor.entries).not.toContainEqual(
      expect.objectContaining({ binding: 6 }),
    );
    expect(descriptor.entries).not.toContainEqual(
      expect.objectContaining({ binding: 7 }),
    );
  });

  it("keeps flattened point-array shadows plus cookies within a WebGPU-minimum group layout", () => {
    const descriptor = createStandardLightMultiShadowBindGroupLayoutDescriptor({
      clusteredLocalLights: true,
      clusteredLocalLightArrayShadows: true,
      clusteredLocalLightPointArrayShadows: true,
      clusteredLocalLightCookies: true,
      clusteredLocalLightShadowCookies: true,
      clusteredLocalLightCookieTextureViewDimension: "2d",
    });

    expect(descriptor.entries).toHaveLength(14);
    expect(descriptor.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          binding: 3,
          texture: expect.objectContaining({ viewDimension: "2d-array" }),
        }),
        expect.objectContaining({
          binding: 9,
          texture: expect.objectContaining({ viewDimension: "2d-array" }),
        }),
        expect.objectContaining({
          binding: 20,
          texture: expect.objectContaining({ viewDimension: "2d" }),
        }),
        expect.objectContaining({ binding: 21 }),
      ]),
    );
    expect(descriptor.entries).not.toContainEqual(
      expect.objectContaining({ binding: 22 }),
    );
    expect(descriptor.entries).not.toContainEqual(
      expect.objectContaining({ binding: 5 }),
    );
    expect(descriptor.entries).not.toContainEqual(
      expect.objectContaining({ binding: 6 }),
    );
    expect(descriptor.entries).not.toContainEqual(
      expect.objectContaining({ binding: 7 }),
    );
  });

  it("keeps atlas local shadows plus cookies within a WebGPU-minimum group layout", () => {
    const descriptor = createStandardLightMultiShadowBindGroupLayoutDescriptor({
      clusteredLocalLights: true,
      clusteredLocalLightCookies: true,
      clusteredLocalLightShadowCookies: true,
      clusteredLocalLightCookieTextureViewDimension: "2d",
    });

    expect(descriptor.entries).toHaveLength(14);
    expect(descriptor.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          binding: 3,
          texture: expect.objectContaining({ viewDimension: "2d" }),
        }),
        expect.objectContaining({
          binding: 9,
          texture: expect.objectContaining({ viewDimension: "cube" }),
        }),
        expect.objectContaining({
          binding: 20,
          texture: expect.objectContaining({ viewDimension: "2d" }),
        }),
        expect.objectContaining({ binding: 21 }),
      ]),
    );
    expect(descriptor.entries).not.toContainEqual(
      expect.objectContaining({ binding: 22 }),
    );
    expect(descriptor.entries).not.toContainEqual(
      expect.objectContaining({ binding: 5 }),
    );
    expect(descriptor.entries).not.toContainEqual(
      expect.objectContaining({ binding: 6 }),
    );
    expect(descriptor.entries).not.toContainEqual(
      expect.objectContaining({ binding: 7 }),
    );
  });

  it("creates a multi-shadow light bind group resource", () => {
    const createdBindGroups: unknown[] = [];
    const directional = resourceInputs("directional", "2d");
    const spot = resourceInputs("spot", "2d");
    const point = resourceInputs("point", "cube");
    const plan = createStandardLightMultiShadowBindGroupDescriptorPlan({
      lightGpuBufferResource: directional.lightGpuBufferResource,
      directionalShadowReceiverResources: directional,
      spotShadowReceiverResources: spot,
      pointShadowReceiverResources: point,
    });
    const result = createStandardLightShadowBindGroupResource({
      ...directional,
      additionalShadowReceiverResources: [spot, point],
      plan,
      layout: {
        group: 3,
        layoutKey: STANDARD_LIGHT_MULTI_SHADOW_BIND_GROUP_LAYOUT_KEY,
        layout: "multi-shadow-layout",
        descriptor: createStandardLightMultiShadowBindGroupLayoutDescriptor(),
      },
      device: {
        createBindGroup: (descriptor) => {
          createdBindGroups.push(descriptor);
          return "multi-shadow-bind-group";
        },
      },
    });

    expect(plan).toMatchObject({
      valid: true,
      group: 3,
      layoutKey: STANDARD_LIGHT_MULTI_SHADOW_BIND_GROUP_LAYOUT_KEY,
      entries: [
        { binding: 0, resourceKey: "light-floats", resourceKind: "buffer" },
        {
          binding: 1,
          resourceKey: "light-metadata",
          resourceKind: "buffer",
        },
        {
          binding: 2,
          resourceKey: "directional-shadow-matrices",
          resourceKind: "buffer",
        },
        {
          binding: 3,
          resourceKey: "directional-shadow-depth:texture",
          resourceKind: "texture-view",
        },
        {
          binding: 4,
          resourceKey: "directional-shadow-sampler",
          resourceKind: "sampler",
        },
        {
          binding: 5,
          resourceKey: "spot-shadow-matrices",
          resourceKind: "buffer",
        },
        {
          binding: 6,
          resourceKey: "spot-shadow-depth:texture",
          resourceKind: "texture-view",
        },
        {
          binding: 7,
          resourceKey: "spot-shadow-sampler",
          resourceKind: "sampler",
        },
        {
          binding: 8,
          resourceKey: "point-shadow-matrices",
          resourceKind: "buffer",
        },
        {
          binding: 9,
          resourceKey: "point-shadow-depth:texture",
          resourceKind: "texture-view",
        },
        {
          binding: 10,
          resourceKey: "point-shadow-sampler",
          resourceKind: "sampler",
        },
      ],
      diagnostics: [],
    });
    expect(result.valid).toBe(true);
    expect(result.resource).toMatchObject({
      group: 3,
      layoutKey: STANDARD_LIGHT_MULTI_SHADOW_BIND_GROUP_LAYOUT_KEY,
      bindGroup: "multi-shadow-bind-group",
    });
    expect(createdBindGroups).toEqual([
      {
        label: STANDARD_LIGHT_MULTI_SHADOW_BIND_GROUP_LAYOUT_KEY,
        layout: "multi-shadow-layout",
        entries: [
          { binding: 0, resource: { buffer: "light-float-buffer" } },
          { binding: 1, resource: { buffer: "light-metadata-buffer" } },
          {
            binding: 2,
            resource: { buffer: "directional-shadow-matrix-buffer" },
          },
          { binding: 3, resource: "directional-shadow-depth-view" },
          { binding: 4, resource: "directional-shadow-sampler-resource" },
          { binding: 5, resource: { buffer: "spot-shadow-matrix-buffer" } },
          { binding: 6, resource: "spot-shadow-depth-view" },
          { binding: 7, resource: "spot-shadow-sampler-resource" },
          { binding: 8, resource: { buffer: "point-shadow-matrix-buffer" } },
          { binding: 9, resource: "point-shadow-depth-view" },
          { binding: 10, resource: "point-shadow-sampler-resource" },
        ],
      },
    ]);
  });

  it("plans compact clustered local multi-shadow entries without duplicate spot storage", () => {
    const directional = resourceInputs("directional", "2d");
    const spot = resourceInputs("spot", "2d");
    const point = resourceInputs("point", "cube");
    const plan = createStandardLightMultiShadowBindGroupDescriptorPlan({
      lightGpuBufferResource: directional.lightGpuBufferResource,
      directionalShadowReceiverResources: spot,
      spotShadowReceiverResources: spot,
      pointShadowReceiverResources: point,
      localLightClusterResources: {
        resourceKey: "cluster",
        paramsResourceKey: "cluster-params",
        cellsResourceKey: "cluster-cells",
        indicesResourceKey: "cluster-indices",
        metadataResourceKey: "cluster-metadata",
        paramsBuffer: "cluster-params-buffer",
        cellsBuffer: "cluster-cells-buffer",
        indicesBuffer: "cluster-indices-buffer",
        metadataBuffer: "cluster-metadata-buffer",
        descriptor: null,
      } as never,
    });

    expect(plan.valid).toBe(true);
    expect(plan.entries.map((entry) => entry.binding)).toEqual([
      0, 1, 2, 3, 4, 8, 9, 10, 16, 17, 18, 19,
    ]);
    expect(plan.entries).not.toContainEqual(
      expect.objectContaining({ binding: 5 }),
    );
  });

  it("plans compact clustered local shadows and cookie resources together", () => {
    const directional = resourceInputs("directional", "2d");
    const spot = resourceInputs("spot", "2d");
    const point = resourceInputs("point", "cube");
    const plan = createStandardLightMultiShadowBindGroupDescriptorPlan({
      lightGpuBufferResource: directional.lightGpuBufferResource,
      directionalShadowReceiverResources: spot,
      spotShadowReceiverResources: spot,
      pointShadowReceiverResources: point,
      localLightClusterResources: {
        resourceKey: "cluster",
        paramsResourceKey: "cluster-params",
        cellsResourceKey: "cluster-cells",
        indicesResourceKey: "cluster-indices",
        metadataResourceKey: "cluster-metadata",
        paramsBuffer: "cluster-params-buffer",
        cellsBuffer: "cluster-cells-buffer",
        indicesBuffer: "cluster-indices-buffer",
        metadataBuffer: "cluster-metadata-buffer",
        descriptor: null,
      } as never,
      localLightCookieResources: {
        matrixResource: {
          resourceKey: "cluster-cookie-matrices",
          label: "cluster-cookie-matrices",
          buffer: "cluster-cookie-matrix-buffer",
          matrixCount: 1,
          entryLightIds: [37],
        },
        textureResource: {
          resourceKey: "cluster-cookie-texture",
          texture: "cluster-cookie-texture-resource",
          view: "cluster-cookie-texture-view",
          descriptor: {},
        },
        samplerResource: {
          resourceKey: "cluster-cookie-sampler",
          sampler: "cluster-cookie-sampler-resource",
          descriptor: {},
        },
        textureViewDimension: "2d",
        textureKey: "texture:cluster-cookie",
        samplerKey: "sampler:cluster-cookie",
        supportedResources: [],
      } as never,
      reuseShadowMatricesForLocalLightCookies: true,
    });

    expect(plan.valid).toBe(true);
    expect(plan.entries.map((entry) => entry.binding)).toEqual([
      0, 1, 2, 3, 4, 8, 9, 10, 16, 17, 18, 19, 20, 21,
    ]);
  });

  it("creates a combined light and shadow bind group resource", () => {
    const createdLayouts: unknown[] = [];
    const createdBindGroups: unknown[] = [];
    const resources = resourceInputs();
    const plan = createStandardLightShadowBindGroupDescriptorPlan(resources);
    const layout = createStandardLightShadowBindGroupLayoutResource(
      (descriptor) => {
        createdLayouts.push(descriptor);
        return "light-shadow-layout";
      },
    );
    const result = createStandardLightShadowBindGroupResource({
      ...resources,
      plan,
      layout,
      device: {
        createBindGroup: (descriptor) => {
          createdBindGroups.push(descriptor);
          return "light-shadow-bind-group";
        },
      },
    });

    expect(plan).toMatchObject({
      valid: true,
      group: 3,
      layoutKey: STANDARD_LIGHT_SHADOW_BIND_GROUP_LAYOUT_KEY,
      entries: [
        { binding: 0, resourceKey: "light-floats", resourceKind: "buffer" },
        {
          binding: 1,
          resourceKey: "light-metadata",
          resourceKind: "buffer",
        },
        { binding: 2, resourceKey: "shadow-matrices", resourceKind: "buffer" },
        {
          binding: 3,
          resourceKey: "shadow-depth:texture",
          resourceKind: "texture-view",
        },
        { binding: 4, resourceKey: "shadow-sampler", resourceKind: "sampler" },
      ],
      diagnostics: [],
    });
    expect(result.valid).toBe(true);
    expect(result.resource).toMatchObject({
      group: 3,
      layoutKey: STANDARD_LIGHT_SHADOW_BIND_GROUP_LAYOUT_KEY,
      bindGroup: "light-shadow-bind-group",
      entryResourceKeys: [
        "light-floats",
        "light-metadata",
        "shadow-matrices",
        "shadow-depth:texture",
        "shadow-sampler",
      ],
    });
    expect(createdLayouts).toHaveLength(1);
    expect(createdBindGroups).toEqual([
      {
        label: STANDARD_LIGHT_SHADOW_BIND_GROUP_LAYOUT_KEY,
        layout: "light-shadow-layout",
        entries: [
          { binding: 0, resource: { buffer: "light-float-buffer" } },
          { binding: 1, resource: { buffer: "light-metadata-buffer" } },
          { binding: 2, resource: { buffer: "shadow-matrix-buffer" } },
          { binding: 3, resource: "shadow-depth-view" },
          { binding: 4, resource: "shadow-sampler-resource" },
        ],
      },
    ]);
  });

  it("diagnoses missing receiver resources before creation", () => {
    const plan = createStandardLightShadowBindGroupDescriptorPlan({
      ...resourceInputs(),
      matrixBufferResource: {
        ...resourceInputs().matrixBufferResource,
        resource: null,
      },
      samplerResource: { ...resourceInputs().samplerResource, resource: null },
    });

    expect(plan.valid).toBe(false);
    expect(plan.resourceKey).toBeNull();
    expect(plan.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "standardLightShadowBindGroup.missingMatrixBufferResource",
      "standardLightShadowBindGroup.missingSamplerResource",
    ]);
  });
});

function resourceInputs(prefix = "", viewDimension: "2d" | "cube" = "2d") {
  const keyPrefix = prefix.length === 0 ? "" : `${prefix}-`;

  return {
    lightGpuBufferResource: {
      resourceKey: "lights",
      floatResourceKey: "light-floats",
      metadataResourceKey: "light-metadata",
      floatBuffer: "light-float-buffer",
      metadataBuffer: "light-metadata-buffer",
      count: 2,
    },
    matrixBufferResource: {
      ready: true,
      status: "available",
      matrixCount: 1,
      byteSize: 64,
      createdBufferCount: 1,
      reusedBufferCount: 0,
      sections: {
        matrixComputation: true,
        bufferDescriptor: true,
        bufferAllocation: true,
        upload: true,
        bindGroupResource: false,
        shaderSampling: false,
      },
      resource: {
        resourceKey: `${keyPrefix}shadow-matrices`,
        label: `${keyPrefix}shadow-matrices`,
        buffer: `${keyPrefix}shadow-matrix-buffer`,
        byteSize: 64,
        matrixCount: 1,
        entryMatrixKeys: [`${keyPrefix}shadow-matrix:0`],
      },
      diagnostics: [],
    },
    depthTextureResources: {
      ready: true,
      status: "available",
      textureDescriptorCount: 1,
      createdTextureCount: 1,
      reusedTextureCount: 0,
      sections: {
        textureDescriptors: true,
        depthTextureResource: true,
        gpuAllocation: true,
        matrixUpload: false,
        passSubmission: false,
        shaderSampling: false,
      },
      resources: [
        {
          shadowId: 1,
          lightId: 2,
          resourceKey: `${keyPrefix}shadow-depth`,
          textureKey: `${keyPrefix}shadow-depth:texture`,
          viewKey: `${keyPrefix}shadow-depth:view`,
          faceCount: viewDimension === "cube" ? 6 : 1,
          viewDimension,
          attachmentViews: [
            {
              faceIndex: 0,
              viewKey: `${keyPrefix}shadow-depth:view`,
              view: `${keyPrefix}shadow-depth-view`,
            },
          ],
          allocation: {
            valid: true,
            resource: {
              resourceKey: `${keyPrefix}shadow-depth:texture`,
              texture: `${keyPrefix}shadow-depth-texture`,
              view: `${keyPrefix}shadow-depth-view`,
              descriptor: {
                size: [1024, 1024, 1],
                format: "depth32float",
                usage: 20,
              },
            },
            diagnostics: [],
          },
        },
      ],
      diagnostics: [],
    },
    samplerResource: {
      ready: true,
      status: "available",
      createdSamplerCount: 1,
      reusedSamplerCount: 0,
      sections: {
        samplerDescriptor: true,
        samplerResource: true,
        bindGroupResource: false,
        shaderSampling: false,
      },
      resource: {
        resourceKey: `${keyPrefix}shadow-sampler`,
        sampler: `${keyPrefix}shadow-sampler-resource`,
        descriptor: {
          label: "shadow-sampler",
          addressModeU: "clamp-to-edge",
          addressModeV: "clamp-to-edge",
          addressModeW: "clamp-to-edge",
          magFilter: "nearest",
          minFilter: "nearest",
          mipmapFilter: "nearest",
          lodMinClamp: 0,
          lodMaxClamp: 32,
          compare: "less-equal",
        },
      },
      diagnostics: [],
    },
  } as const;
}
