import { describe, expect, it } from "vitest";

import {
  DEFAULT_LIGHT_BIND_GROUP,
  DEFAULT_LIGHT_BIND_GROUP_LAYOUT_VISIBILITY,
  LOCAL_LIGHT_CLUSTER_CELLS_BINDING,
  LOCAL_LIGHT_CLUSTER_INDICES_BINDING,
  LOCAL_LIGHT_CLUSTER_PARAMS_BINDING,
  createLightBindGroupLayoutDescriptor,
  createLightBindGroupLayoutResource,
  lightBindGroupLayoutResourceKey,
  type WebGpuBindGroupLayoutDescriptor,
  type WebGpuBindGroupLayoutDeviceLike,
} from "@aperture-engine/webgpu";

describe("light bind group layout resources", () => {
  it("creates read-only storage layout entries for packed light buffers", () => {
    expect(createLightBindGroupLayoutDescriptor()).toEqual({
      label: "lights/group-3",
      entries: [
        {
          binding: 0,
          visibility: DEFAULT_LIGHT_BIND_GROUP_LAYOUT_VISIBILITY,
          buffer: { type: "read-only-storage" },
        },
        {
          binding: 1,
          visibility: DEFAULT_LIGHT_BIND_GROUP_LAYOUT_VISIBILITY,
          buffer: { type: "read-only-storage" },
        },
      ],
    });
  });

  it("adds transmission scene color bindings when requested", () => {
    expect(
      createLightBindGroupLayoutDescriptor({
        transmissionSceneColor: true,
      }).entries,
    ).toEqual([
      {
        binding: 0,
        visibility: DEFAULT_LIGHT_BIND_GROUP_LAYOUT_VISIBILITY,
        buffer: { type: "read-only-storage" },
      },
      {
        binding: 1,
        visibility: DEFAULT_LIGHT_BIND_GROUP_LAYOUT_VISIBILITY,
        buffer: { type: "read-only-storage" },
      },
      {
        binding: 14,
        visibility: DEFAULT_LIGHT_BIND_GROUP_LAYOUT_VISIBILITY,
        texture: { sampleType: "float" },
      },
      {
        binding: 15,
        visibility: DEFAULT_LIGHT_BIND_GROUP_LAYOUT_VISIBILITY,
        sampler: { type: "filtering" },
      },
    ]);
  });

  it("adds clustered local-light storage bindings when requested", () => {
    expect(
      createLightBindGroupLayoutDescriptor({
        clusteredLocalLights: true,
      }).entries.slice(2),
    ).toEqual([
      {
        binding: LOCAL_LIGHT_CLUSTER_PARAMS_BINDING,
        visibility: DEFAULT_LIGHT_BIND_GROUP_LAYOUT_VISIBILITY,
        buffer: { type: "read-only-storage" },
      },
      {
        binding: LOCAL_LIGHT_CLUSTER_CELLS_BINDING,
        visibility: DEFAULT_LIGHT_BIND_GROUP_LAYOUT_VISIBILITY,
        buffer: { type: "read-only-storage" },
      },
      {
        binding: LOCAL_LIGHT_CLUSTER_INDICES_BINDING,
        visibility: DEFAULT_LIGHT_BIND_GROUP_LAYOUT_VISIBILITY,
        buffer: { type: "read-only-storage" },
      },
    ]);
  });

  it("creates renderer-owned light bind group layout resources", () => {
    const descriptors: WebGpuBindGroupLayoutDescriptor[] = [];
    const result = createLightBindGroupLayoutResource({
      device: {
        createBindGroupLayout: (descriptor) => {
          descriptors.push(descriptor);
          return { handle: "raw-light-layout" };
        },
      },
    });

    expect(result.valid).toBe(true);
    expect(result.diagnostics).toEqual([]);
    expect(result.resource).toMatchObject({
      group: DEFAULT_LIGHT_BIND_GROUP,
      layoutKey: lightBindGroupLayoutResourceKey(),
      layout: { handle: "raw-light-layout" },
      descriptor: createLightBindGroupLayoutDescriptor(),
    });
    expect(descriptors).toEqual([createLightBindGroupLayoutDescriptor()]);
  });

  it("supports stable custom group, visibility, label, and layout key values", () => {
    const result = createLightBindGroupLayoutResource({
      device: deviceWithLayout(),
      group: 4,
      visibility: 0x6,
      label: "lights/custom",
      layoutKey: "bind-group-layout:lights/custom",
    });

    expect(result.resource).toMatchObject({
      group: 4,
      layoutKey: "bind-group-layout:lights/custom",
      descriptor: {
        label: "lights/custom",
        entries: [
          {
            binding: 0,
            visibility: 0x6,
            buffer: { type: "read-only-storage" },
          },
          {
            binding: 1,
            visibility: 0x6,
            buffer: { type: "read-only-storage" },
          },
        ],
      },
    });
  });

  it("diagnoses missing bind group layout device support", () => {
    expect(createLightBindGroupLayoutResource({ device: {} })).toEqual({
      valid: false,
      resource: null,
      diagnostics: [
        {
          code: "lightBindGroupLayout.missingDeviceSupport",
          layoutKey: "bind-group-layout:lights/group-3",
          message: "WebGPU device cannot create light bind group layouts.",
        },
      ],
    });
  });

  it("diagnoses bind group layout creation failures", () => {
    expect(
      createLightBindGroupLayoutResource({
        device: {
          createBindGroupLayout: () => {
            throw new Error("layout denied");
          },
        },
      }),
    ).toEqual({
      valid: false,
      resource: null,
      diagnostics: [
        {
          code: "lightBindGroupLayout.creationFailed",
          layoutKey: "bind-group-layout:lights/group-3",
          message:
            "Failed to create light bind group layout 'bind-group-layout:lights/group-3': layout denied",
        },
      ],
    });
  });
});

function deviceWithLayout(): WebGpuBindGroupLayoutDeviceLike {
  return {
    createBindGroupLayout: (descriptor) => ({ descriptor }),
  };
}
