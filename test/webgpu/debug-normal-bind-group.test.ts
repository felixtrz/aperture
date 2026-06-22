import { describe, expect, it } from "vitest";

import {
  createDebugNormalMaterialBindGroupDescriptorPlan,
  createDebugNormalMaterialBindGroupLayoutMetadata,
  createDebugNormalMaterialBindGroupLayoutPlan,
  createDebugNormalMaterialBindGroupResource,
  createDebugNormalMaterialBindGroupResourceKey,
  debugNormalMaterialBindGroupResourceToJsonValue,
  validateDebugNormalMaterialBindGroupLayout,
  type DebugNormalMaterialBindGroupCreationDescriptor,
} from "@aperture-engine/webgpu/test-support";

describe("debug-normal material bind group descriptor planning", () => {
  it("creates a required material group-2 descriptor", () => {
    const plan = createDebugNormalMaterialBindGroupDescriptorPlan({
      materialResourceKey:
        "material-buffer:DebugNormalMaterial/Normals/uniform",
    });

    expect(plan).toEqual({
      valid: true,
      group: 2,
      resourceKey:
        "bind-group:debug-normal/group-2/0:material-buffer:DebugNormalMaterial/Normals/uniform",
      diagnostics: [],
      entries: [
        {
          group: 2,
          binding: 0,
          resourceKey: "material-buffer:DebugNormalMaterial/Normals/uniform",
          resourceKind: "buffer",
        },
      ],
    });
  });

  it("reports missing required material resource keys", () => {
    const plan = createDebugNormalMaterialBindGroupDescriptorPlan({
      materialResourceKey: null,
    });

    expect(plan.valid).toBe(false);
    expect(plan.resourceKey).toBeNull();
    expect(plan.diagnostics).toEqual([
      {
        code: "debugNormalMaterialBindGroup.missingMaterialResource",
        binding: 0,
        message:
          "DebugNormal material bind group planning requires a material uniform buffer resource.",
      },
    ]);
  });

  it("creates stable bind group keys from sorted entries", () => {
    expect(
      createDebugNormalMaterialBindGroupResourceKey([
        {
          group: 2,
          binding: 0,
          resourceKey: "material-buffer:debug-normal",
          resourceKind: "buffer",
        },
      ]),
    ).toBe("bind-group:debug-normal/group-2/0:material-buffer:debug-normal");
  });

  it("creates debug-normal material bind groups from GPU resources", () => {
    const bindGroups: DebugNormalMaterialBindGroupCreationDescriptor[] = [];
    const plan = createDebugNormalMaterialBindGroupDescriptorPlan({
      materialResourceKey:
        "material-buffer:DebugNormalMaterial/Normals/uniform",
    });
    const layoutPlan = createDebugNormalMaterialBindGroupLayoutPlan();
    const result = createDebugNormalMaterialBindGroupResource({
      device: {
        createBindGroup(descriptor) {
          bindGroups.push(descriptor);
          return { kind: "debug-normal-bind-group" };
        },
      },
      plan,
      layout: {
        group: 2,
        layoutKey: "debug-normal/group-2",
        layout: "raw-debug-normal-layout",
        descriptor: layoutPlan.layout,
      },
      buffers: [
        {
          resourceKey: "material-buffer:DebugNormalMaterial/Normals/uniform",
          buffer: { kind: "raw-debug-normal-buffer" },
        },
      ],
    });

    expect(result.diagnostics).toEqual([]);
    expect(result.resource).toEqual({
      group: 2,
      resourceKey:
        "bind-group:debug-normal/group-2/0:material-buffer:DebugNormalMaterial/Normals/uniform",
      layoutKey: "debug-normal/group-2",
      bindGroup: { kind: "debug-normal-bind-group" },
      entryResourceKeys: [
        "material-buffer:DebugNormalMaterial/Normals/uniform",
      ],
    });
    expect(bindGroups).toEqual([
      {
        label: "debug-normal/group-2",
        layout: "raw-debug-normal-layout",
        entries: [
          {
            binding: 0,
            resource: { buffer: { kind: "raw-debug-normal-buffer" } },
          },
        ],
      },
    ]);
    expect(
      debugNormalMaterialBindGroupResourceToJsonValue(
        required(result.resource),
      ),
    ).toEqual({
      group: 2,
      resourceKey:
        "bind-group:debug-normal/group-2/0:material-buffer:DebugNormalMaterial/Normals/uniform",
      layoutKey: "debug-normal/group-2",
      entryResourceKeys: [
        "material-buffer:DebugNormalMaterial/Normals/uniform",
      ],
    });
    expect(
      JSON.stringify(
        debugNormalMaterialBindGroupResourceToJsonValue(
          required(result.resource),
        ),
      ),
    ).not.toMatch(/bindGroup|GPUBuffer|GPUDevice|rawGpuHandle/);
  });

  it("reports missing GPU resources without creating a fallback group", () => {
    const plan = createDebugNormalMaterialBindGroupDescriptorPlan({
      materialResourceKey:
        "material-buffer:DebugNormalMaterial/Missing/uniform",
    });
    const result = createDebugNormalMaterialBindGroupResource({
      device: {
        createBindGroup() {
          return {};
        },
      },
      plan,
      layout: {
        group: 2,
        layoutKey: "debug-normal/group-2",
        layout: "raw-debug-normal-layout",
        descriptor: createDebugNormalMaterialBindGroupLayoutPlan().layout,
      },
      buffers: [],
    });

    expect(result.valid).toBe(false);
    expect(result.resource).toBeNull();
    expect(result.diagnostics).toEqual([
      {
        code: "debugNormalMaterialBindGroupResource.missingBufferResource",
        group: 2,
        binding: 0,
        resourceKey: "material-buffer:DebugNormalMaterial/Missing/uniform",
        message:
          "Missing GPU buffer resource 'material-buffer:DebugNormalMaterial/Missing/uniform' for debug-normal material group 2.",
      },
    ]);
  });
});

describe("debug-normal material bind group layout metadata", () => {
  it("creates required group-2 layout metadata", () => {
    const plan = createDebugNormalMaterialBindGroupLayoutPlan();

    expect(plan).toMatchObject({
      valid: true,
      diagnostics: [],
      layout: {
        group: 2,
        label: "debug-normal/group-2",
        metadata: {
          group: 2,
          name: "debugNormalMaterial",
          layoutKey: "debug-normal/group-2",
        },
      },
    });
    expect(plan.layout.entries).toEqual([
      {
        binding: 0,
        label: "debugNormalMaterial",
        resource: "uniform-buffer",
      },
    ]);
    expect(plan.layout.metadata.bindings).toEqual([
      {
        binding: 0,
        name: "debugNormalMaterial",
        resourceKind: "buffer",
        visibility: ["fragment"],
        required: true,
      },
    ]);
  });

  it("validates required debug-normal material group metadata", () => {
    expect(
      validateDebugNormalMaterialBindGroupLayout({
        group: 2,
        metadata: createDebugNormalMaterialBindGroupLayoutMetadata(),
        entries: [
          {
            binding: 0,
            label: "debugNormalMaterial",
            resource: "uniform-buffer",
          },
        ],
      }),
    ).toEqual([]);

    expect(
      validateDebugNormalMaterialBindGroupLayout({
        group: 1,
        entries: [],
      }).map((diagnostic) => diagnostic.code),
    ).toEqual([
      "debugNormalMaterialBindGroupLayout.invalidGroup",
      "debugNormalMaterialBindGroupLayout.missingBinding",
    ]);
  });
});

function required<T>(value: T | null): T {
  if (value === null) {
    throw new Error("Expected test fixture value to exist.");
  }

  return value;
}
