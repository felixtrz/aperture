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
      coordinateSpace: "world",
      viewId: null,
    });
    expect(descriptor.params[11]).toBe(0);
    expect(descriptor.params).toHaveLength(28);
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
    expect(descriptor.coordinateSpace).toBe("world");
    expect(descriptor.viewId).toBeNull();
    expect(descriptor.cellCount).toBe(16);
    expect(descriptor.cells).toHaveLength(32);
    expect(descriptor.indices.length).toBeGreaterThan(0);
    expect(descriptor.populatedCells).toBeGreaterThan(0);
    expect(descriptor.maxLightsPerPopulatedCell).toBeLessThan(16);
    expect(descriptor.totalAssignedLightReferences).toBeLessThan(16 * 16);
    expect(descriptor.buildPressure).toMatchObject({
      assignmentStrategy: "light-range",
      naiveCellLightPairTests: descriptor.cellCount *
        descriptor.clusteredLocalLights,
      lightCellRangeTests: 16,
      storedLightReferences: descriptor.totalAssignedLightReferences,
      skippedOverflowReferences: 0,
    });
    expect(descriptor.buildPressure.lightCellWriteAttempts).toBeLessThan(
      descriptor.buildPressure.naiveCellLightPairTests,
    );
    expect(descriptor.params[8]).toBe(4);
    expect(descriptor.params[9]).toBe(1);
    expect(descriptor.params[10]).toBe(4);
    expect(descriptor.params[11]).toBe(1);
    expect(Array.from(descriptor.params.slice(12, 28))).toEqual([
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1,
    ]);
  });

  it("derives view/depth cluster bounds from the active view", () => {
    const viewMatrix = matrixWithTranslation(-2, 0, -32);
    const descriptor = createLocalLightClusterDescriptor(
      snapshotWithPointLights(16, { viewId: 7, viewMatrix }),
      {
        dimensions: { x: 4, y: 1, z: 4 },
        maxLightsPerCell: 8,
      },
    );

    expect(descriptor.enabled).toBe(true);
    expect(descriptor.coordinateSpace).toBe("view-depth");
    expect(descriptor.viewId).toBe(7);
    expect(descriptor.params[3]).toBe(1);
    expect(descriptor.params[7]).toBe(7);
    expect(descriptor.boundsMin.x).toBeLessThan(0);
    expect(descriptor.boundsMax.x).toBeGreaterThan(0);
    expect(descriptor.boundsMin.z).toBeLessThan(descriptor.boundsMax.z);
    expect(Array.from(descriptor.params.slice(12, 28))).toEqual(viewMatrix);
  });

  it("changes cluster occupancy when the selected camera moves", () => {
    const centered = createLocalLightClusterDescriptor(
      snapshotWithPointLights(16, {
        viewMatrix: matrixWithTranslation(0, 0, -32),
      }),
      {
        dimensions: { x: 4, y: 1, z: 4 },
        maxLightsPerCell: 8,
      },
    );
    const shifted = createLocalLightClusterDescriptor(
      snapshotWithPointLights(16, {
        viewMatrix: matrixWithTranslation(-8, 0, -32),
      }),
      {
        dimensions: { x: 4, y: 1, z: 4 },
        maxLightsPerCell: 8,
      },
    );

    expect(centered.coordinateSpace).toBe("view-depth");
    expect(shifted.coordinateSpace).toBe("view-depth");
    expect(centered.indices).toHaveLength(centered.cellCount * 8);
    expect(shifted.indices).toHaveLength(shifted.cellCount * 8);
    expect(Array.from(centered.cells)).not.toEqual(Array.from(shifted.cells));
  });

  it("creates distinct view/light-set descriptors for layer-isolated views", () => {
    const snapshot = snapshotWithTwoLayerViews();
    const firstView = createLocalLightClusterDescriptor(snapshot, {
      layerMask: 1,
      minLocalLights: 1,
      dimensions: { x: 4, y: 1, z: 4 },
      maxLightsPerCell: 8,
    });
    const secondView = createLocalLightClusterDescriptor(snapshot, {
      layerMask: 2,
      minLocalLights: 1,
      dimensions: { x: 4, y: 1, z: 4 },
      maxLightsPerCell: 8,
    });

    expect(firstView.enabled).toBe(true);
    expect(secondView.enabled).toBe(true);
    expect(firstView.viewId).toBe(1);
    expect(secondView.viewId).toBe(2);
    expect(firstView.layerMask).toBe(1);
    expect(secondView.layerMask).toBe(2);
    expect(firstView.totalLocalLights).toBe(8);
    expect(secondView.totalLocalLights).toBe(8);
    expect(firstView.lightSetKey).not.toBe(secondView.lightSetKey);
    expect(firstView.resourceKey).not.toBe(secondView.resourceKey);
    expect(firstView.occupancyHash).not.toBe(secondView.occupancyHash);
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

function snapshotWithPointLights(
  count: number,
  options: {
    readonly viewId?: number;
    readonly viewMatrix?: readonly number[];
    readonly projectionMatrix?: readonly number[];
  } = {},
): RenderSnapshot {
  const transforms = new Float32Array(count * 16);
  const lights: LightPacket[] = [];
  const width = Math.ceil(Math.sqrt(count));
  const viewMatrix = options.viewMatrix ?? null;
  const projectionMatrix = options.projectionMatrix ?? defaultProjectionMatrix();
  const viewMatrices =
    viewMatrix === null
      ? new Float32Array(0)
      : new Float32Array([...viewMatrix, ...projectionMatrix, ...projectionMatrix]);

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
    views:
      viewMatrix === null
        ? []
        : [
            {
              viewId: options.viewId ?? 1,
              camera: { index: 500, generation: 0 },
              priority: 0,
              layerMask: 1,
              viewMatrixOffset: 0,
              projectionMatrixOffset: 16,
              viewProjectionMatrixOffset: 32,
              viewport: [0, 0, 1, 1],
              scissor: [0, 0, 1, 1],
              clearColor: [0, 0, 0, 1],
              clearDepth: 1,
              clearStencil: 0,
              renderTarget: null,
            },
          ],
    meshDraws: [],
    lights,
    environments: [],
    shadowRequests: [],
    bounds: [],
    transforms,
    viewMatrices,
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

function snapshotWithTwoLayerViews(): RenderSnapshot {
  const firstViewMatrix = matrixWithTranslation(0, 0, -32);
  const secondViewMatrix = matrixWithTranslation(-8, 0, -32);
  const projectionMatrix = defaultProjectionMatrix();
  const snapshot = snapshotWithPointLights(16);

  return {
    ...snapshot,
    views: [
      viewPacket({
        viewId: 1,
        layerMask: 1,
        viewMatrixOffset: 0,
        projectionMatrixOffset: 16,
        viewProjectionMatrixOffset: 32,
      }),
      viewPacket({
        viewId: 2,
        layerMask: 2,
        viewMatrixOffset: 48,
        projectionMatrixOffset: 64,
        viewProjectionMatrixOffset: 80,
      }),
    ],
    viewMatrices: new Float32Array([
      ...firstViewMatrix,
      ...projectionMatrix,
      ...projectionMatrix,
      ...secondViewMatrix,
      ...projectionMatrix,
      ...projectionMatrix,
    ]),
    lights: snapshot.lights.map((light, index) => ({
      ...light,
      layerMask: index < 8 ? 1 : 2,
    })),
  };
}

function viewPacket(input: {
  readonly viewId: number;
  readonly layerMask: number;
  readonly viewMatrixOffset: number;
  readonly projectionMatrixOffset: number;
  readonly viewProjectionMatrixOffset: number;
}): RenderSnapshot["views"][number] {
  return {
    viewId: input.viewId,
    camera: { index: 500 + input.viewId, generation: 0 },
    priority: 0,
    layerMask: input.layerMask,
    viewMatrixOffset: input.viewMatrixOffset,
    projectionMatrixOffset: input.projectionMatrixOffset,
    viewProjectionMatrixOffset: input.viewProjectionMatrixOffset,
    viewport: [0, 0, 1, 1],
    scissor: [0, 0, 1, 1],
    clearColor: [0, 0, 0, 1],
    clearDepth: 1,
    clearStencil: 0,
    renderTarget: null,
  };
}

function matrixWithTranslation(
  x: number,
  y: number,
  z: number,
): readonly number[] {
  return [
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    x, y, z, 1,
  ];
}

function defaultProjectionMatrix(): readonly number[] {
  return [
    1.6, 0, 0, 0,
    0, 1.6, 0, 0,
    0, 0, -1, -1,
    0, 0, -0.2, 0,
  ];
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
