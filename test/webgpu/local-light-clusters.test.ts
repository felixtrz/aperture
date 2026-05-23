import { describe, expect, it } from "vitest";

import {
  createLocalLightClusterDescriptor,
  createLocalLightClusterGpuResource,
  localLightClusterReportFromDescriptor,
  snapshotShouldUseClusteredLocalLights,
  type LightPacket,
  type RenderSnapshot,
  type WebGpuBufferCreateDescriptor,
  type WebGpuBufferDeviceLike,
} from "@aperture-engine/webgpu";

describe("local light cluster preparation", () => {
  it("keeps sparse local-light scenes on the packed-light shader loop", () => {
    const snapshot = snapshotWithPointLights(4);
    const descriptor = createLocalLightClusterDescriptor(snapshot);

    expect(snapshotShouldUseClusteredLocalLights(snapshot)).toBe(false);
    expect(descriptor).toMatchObject({
      enabled: false,
      fallbackReason: "below-threshold",
      totalLights: 4,
      totalLocalLights: 4,
      clusteredLocalLights: 0,
    });
    expect(descriptor.params[11]).toBe(0);
  });

  it("builds a bounded 3D index grid for many local lights", () => {
    const snapshot = snapshotWithPointLights(16);
    const descriptor = createLocalLightClusterDescriptor(snapshot, {
      dimensions: { x: 4, y: 1, z: 4 },
      maxLightsPerCell: 8,
    });

    expect(snapshotShouldUseClusteredLocalLights(snapshot)).toBe(true);
    expect(descriptor.enabled).toBe(true);
    expect(descriptor.fallbackReason).toBeNull();
    expect(descriptor.totalLocalLights).toBe(16);
    expect(descriptor.clusteredLocalLights).toBe(16);
    expect(descriptor.cellCount).toBe(16);
    expect(descriptor.cells).toHaveLength(32);
    expect(descriptor.indices.length).toBeGreaterThan(0);
    expect(descriptor.populatedCells).toBeGreaterThan(0);
    expect(descriptor.maxLightsPerPopulatedCell).toBeLessThan(16);
    expect(descriptor.totalAssignedLightReferences).toBeLessThan(16 * 16);
    expect(descriptor.params[8]).toBe(4);
    expect(descriptor.params[9]).toBe(1);
    expect(descriptor.params[10]).toBe(4);
    expect(descriptor.params[11]).toBe(1);
  });

  it("surfaces missing light transforms instead of clustering invalid data", () => {
    const descriptor = createLocalLightClusterDescriptor({
      ...snapshotWithPointLights(16),
      transforms: new Float32Array(0),
    });

    expect(descriptor).toMatchObject({
      enabled: false,
      fallbackReason: "missing-transform",
      totalLocalLights: 16,
    });
  });

  it("creates renderer-owned storage buffers and JSON-safe reports", () => {
    const created: WebGpuBufferCreateDescriptor[] = [];
    const writes: unknown[] = [];
    const descriptor = createLocalLightClusterDescriptor(
      snapshotWithPointLights(16),
      {
        resourceKey: "local-light-cluster:test",
      },
    );
    const result = createLocalLightClusterGpuResource({
      device: deviceWithBuffers(created, writes),
      descriptor,
    });

    expect(result.valid).toBe(true);
    expect(result.diagnostics).toEqual([]);
    expect(result.resource).toMatchObject({
      resourceKey: "local-light-cluster:test",
      paramsResourceKey: "local-light-cluster:test/params",
      cellsResourceKey: "local-light-cluster:test/cells",
      indicesResourceKey: "local-light-cluster:test/indices",
    });
    expect(created.map((entry) => entry.label)).toEqual([
      "local-light-cluster:test/params",
      "local-light-cluster:test/cells",
      "local-light-cluster:test/indices",
    ]);
    expect(writes).toHaveLength(3);

    expect(
      localLightClusterReportFromDescriptor(descriptor, {
        resource: result.resource,
        buffersCreated: 3,
      }),
    ).toMatchObject({
      enabled: true,
      resourceKey: "local-light-cluster:test",
      paramsResourceKey: "local-light-cluster:test/params",
      cellsResourceKey: "local-light-cluster:test/cells",
      indicesResourceKey: "local-light-cluster:test/indices",
      resourceReuse: {
        buffersCreated: 3,
        buffersReused: 0,
      },
    });
  });
});

function snapshotWithPointLights(count: number): RenderSnapshot {
  const transforms = new Float32Array(count * 16);
  const lights: LightPacket[] = [];
  const width = Math.ceil(Math.sqrt(count));

  for (let index = 0; index < count; index += 1) {
    const offset = index * 16;
    const x = (index % width) * 8;
    const z = Math.floor(index / width) * 8;

    transforms[offset] = 1;
    transforms[offset + 5] = 1;
    transforms[offset + 10] = 1;
    transforms[offset + 12] = x;
    transforms[offset + 13] = 0;
    transforms[offset + 14] = z;
    transforms[offset + 15] = 1;
    lights.push(pointLight(index, offset));
  }

  return {
    frame: 1,
    views: [],
    meshDraws: [],
    lights,
    environments: [],
    shadowRequests: [],
    bounds: [],
    transforms,
    viewMatrices: new Float32Array(0),
    diagnostics: [],
    report: {
      views: 0,
      meshDraws: 0,
      lights: lights.length,
      environments: 0,
      shadowRequests: 0,
      bounds: 0,
      diagnostics: 0,
    },
  };
}

function pointLight(seed: number, worldTransformOffset: number): LightPacket {
  return {
    lightId: 100 + seed,
    entity: { index: seed, generation: 0 },
    kind: "point",
    color: [1, 1, 1, 1],
    intensity: 10,
    range: 1,
    innerConeAngle: 0,
    outerConeAngle: 0,
    worldTransformOffset,
    layerMask: 1,
  };
}

function deviceWithBuffers(
  created: WebGpuBufferCreateDescriptor[],
  writes: unknown[],
): WebGpuBufferDeviceLike {
  return {
    queue: {
      writeBuffer: (buffer, bufferOffset, data, dataOffset, size) => {
        writes.push({ buffer, bufferOffset, data, dataOffset, size });
      },
    },
    createBuffer: (descriptor) => {
      created.push(descriptor);
      return { label: descriptor.label };
    },
  };
}
