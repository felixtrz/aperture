import {
  STANDARD_LIGHT_SHADOW_BIND_GROUP_LAYOUT_KEY,
  createStandardLightShadowBindGroupDescriptorPlan,
  createStandardLightShadowBindGroupLayoutDescriptor,
  createStandardLightShadowBindGroupLayoutResource,
  createStandardLightShadowBindGroupResource,
} from "@aperture-engine/webgpu";
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

function resourceInputs() {
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
        resourceKey: "shadow-matrices",
        label: "shadow-matrices",
        buffer: "shadow-matrix-buffer",
        byteSize: 64,
        matrixCount: 1,
        entryMatrixKeys: ["shadow-matrix:0"],
      },
      diagnostics: [],
    },
    depthTextureResources: {
      ready: true,
      status: "available",
      textureDescriptorCount: 1,
      createdTextureCount: 1,
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
          resourceKey: "shadow-depth",
          textureKey: "shadow-depth:texture",
          viewKey: "shadow-depth:view",
          allocation: {
            valid: true,
            resource: {
              resourceKey: "shadow-depth:texture",
              texture: "shadow-depth-texture",
              view: "shadow-depth-view",
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
        resourceKey: "shadow-sampler",
        sampler: "shadow-sampler-resource",
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
