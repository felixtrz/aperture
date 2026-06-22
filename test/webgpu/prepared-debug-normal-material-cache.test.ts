import { describe, expect, it } from "vitest";

import {
  AssetRegistry,
  createMaterialHandle,
  createDebugNormalMaterialAsset,
  createDebugNormalMaterialBindGroupLayoutPlan,
  createPreparedDebugNormalMaterialCache,
  prepareDebugNormalMaterialResource,
  type DebugNormalFrameGpuResourceDeviceLike,
  type DebugNormalMaterialBindGroupCreationDescriptor,
  type DebugNormalMaterialBindGroupLayoutResource,
} from "@aperture-engine/webgpu/test-support";

describe("DebugNormal prepared material cache", () => {
  it("creates, reuses, and invalidates group-2 prepared resources", () => {
    const createdBuffers: unknown[] = [];
    const createdBindGroups: DebugNormalMaterialBindGroupCreationDescriptor[] =
      [];
    const registry = new AssetRegistry();
    const handle = createMaterialHandle("normal-visualizer");
    const cache = createPreparedDebugNormalMaterialCache();
    const device = deviceWithResources(createdBuffers, createdBindGroups);

    registry.register(handle);
    const materialEntry = registry.markReady(
      handle,
      createDebugNormalMaterialAsset({ label: "Normal Visualizer" }),
    );

    const first = prepareDebugNormalMaterialResource({
      registry,
      device,
      cache,
      handle,
      material: required(materialEntry.asset),
      sourceVersion: materialEntry.version,
      frame: 30,
      pipelineKey: "debug-normal|opaque|back|less|none",
      layout: materialLayout(),
    });
    const second = prepareDebugNormalMaterialResource({
      registry,
      device,
      cache,
      handle,
      material: required(materialEntry.asset),
      sourceVersion: materialEntry.version,
      frame: 31,
      pipelineKey: "debug-normal|opaque|back|less|none",
      layout: materialLayout(),
    });
    const updatedMaterialEntry = registry.markReady(
      handle,
      createDebugNormalMaterialAsset({ label: "Normal Visualizer Updated" }),
    );
    const third = prepareDebugNormalMaterialResource({
      registry,
      device,
      cache,
      handle,
      material: required(updatedMaterialEntry.asset),
      sourceVersion: updatedMaterialEntry.version,
      frame: 32,
      pipelineKey: "debug-normal|opaque|back|less|none",
      layout: materialLayout(),
    });

    expect(first.status).toBe("created");
    expect(first.resource?.materialResourceKey).toBe(
      "material-buffer:prepared-material:material:normal-visualizer@v1",
    );
    expect(first.resource?.bindGroupResourceKey).toBe(
      "bind-group:debug-normal/group-2/0:material-buffer:prepared-material:material:normal-visualizer@v1",
    );
    expect(second.status).toBe("reused");
    expect(second.resource).toBe(first.resource);
    expect(second.resource?.lastUsedFrame).toBe(31);
    expect(third.status).toBe("created");
    expect(third.resource).not.toBe(first.resource);
    expect(third.resource?.sourceVersion).toBe(updatedMaterialEntry.version);
    expect(third.resource?.lastUsedFrame).toBe(32);
    expect(cache.resources.size).toBe(2);
    expect(createdBuffers).toHaveLength(2);
    expect(createdBindGroups).toHaveLength(2);
  });

  it("reports missing layout failures without creating GPU handles", () => {
    const registry = new AssetRegistry();
    const handle = createMaterialHandle("missing-layout");

    registry.register(handle);
    const entry = registry.markReady(handle, createDebugNormalMaterialAsset());

    const result = prepareDebugNormalMaterialResource({
      registry,
      device: deviceWithResources([], []),
      cache: createPreparedDebugNormalMaterialCache(),
      handle,
      material: required(entry.asset),
      sourceVersion: entry.version,
      frame: 1,
      pipelineKey: "debug-normal|opaque|back|less|none",
      layout: null,
    });

    expect(result).toMatchObject({
      valid: false,
      status: "failed",
      resource: null,
      diagnostics: [
        {
          code: "preparedDebugNormalMaterial.missingLayout",
          materialKey: "material:missing-layout",
        },
      ],
    });
    expect(JSON.stringify(result)).not.toContain("createBindGroup");
  });
});

function materialLayout(): DebugNormalMaterialBindGroupLayoutResource {
  return {
    group: 2,
    layoutKey: "debug-normal/group-2",
    layout: { group: 2 },
    descriptor: createDebugNormalMaterialBindGroupLayoutPlan().layout,
  };
}

function deviceWithResources(
  createdBuffers: unknown[],
  createdBindGroups: DebugNormalMaterialBindGroupCreationDescriptor[],
): DebugNormalFrameGpuResourceDeviceLike {
  return {
    queue: {
      writeBuffer: () => {},
    },
    createBuffer: (descriptor) => {
      const buffer = { descriptor };

      createdBuffers.push(buffer);
      return buffer;
    },
    createBindGroup: (descriptor) => {
      createdBindGroups.push(
        descriptor as DebugNormalMaterialBindGroupCreationDescriptor,
      );
      return { descriptor };
    },
  };
}

function required<T>(value: T | null): T {
  if (value === null) {
    throw new Error("Expected ready test asset.");
  }

  return value;
}
