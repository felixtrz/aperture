import { describe, expect, it } from "vitest";

import {
  AssetRegistry,
  createMaterialHandle,
  createMeshHandle,
  createWebGpuAppResourceCache,
  makePerspective,
  multiplyMat4,
  type MeshAsset,
  type RenderSnapshot,
  type RenderShadowFrameDeviceLike,
  type WebGpuApp,
} from "@aperture-engine/webgpu/test-support";

import {
  createWebGpuAppAutoShadowFrame,
  createWebGpuAppAutoShadowFrameInputKey,
} from "../../packages/webgpu/src/app/auto-shadow-frame.js";
import { createWebGpuAppResourceReuseReport } from "../../packages/webgpu/src/app/report.js";

describe("WebGPU app auto-shadow frame", () => {
  it("uses primary-camera receiver fit when a primary camera exists", () => {
    const calls = createDeviceCalls();
    const assets = new AssetRegistry();
    const opaqueMesh = createMeshHandle("opaque-caster");
    const alphaMesh = createMeshHandle("alpha-helper");

    assets.register(opaqueMesh, { label: "Opaque caster" });
    assets.markReady(opaqueMesh, triangleMesh("Opaque caster"));
    assets.register(alphaMesh, { label: "Alpha helper" });
    assets.markReady(alphaMesh, triangleMesh("Alpha helper"));

    const result = createWebGpuAppAutoShadowFrame({
      app: app(device(calls)),
      assets,
      cache: createWebGpuAppResourceCache(),
      reuse: createWebGpuAppResourceReuseReport(),
      snapshot: snapshot({ opaqueMesh, alphaMesh }),
    });

    expect(result).not.toBeNull();
    expect(result?.report.status).toBe("submitted");
    expect(result?.casterDrawList.includedDrawCount).toBe(1);
    expect(
      result?.casterDrawList.lists[0]?.draws.map((draw) => draw.renderId),
    ).toEqual([101]);
    expect(
      result?.casterDrawList.diagnostics.map((diagnostic) => diagnostic.code),
    ).toEqual(["shadowCasterDrawList.unsupportedAlphaBlendCaster"]);
    expect(
      result?.matrixComputation.matrices[0]?.orthographicSize,
    ).toBeGreaterThan(7);
    expect(
      result?.matrixComputation.matrices[0]?.orthographicSize,
    ).toBeLessThan(9);
  });

  it("uses light-space scene fit as the no-camera fallback", () => {
    const calls = createDeviceCalls();
    const assets = new AssetRegistry();
    const opaqueMesh = createMeshHandle("flat-caster");
    const alphaMesh = createMeshHandle("alpha-helper");

    assets.register(opaqueMesh, { label: "Flat caster" });
    assets.markReady(opaqueMesh, triangleMesh("Flat caster"));
    assets.register(alphaMesh, { label: "Alpha helper" });
    assets.markReady(alphaMesh, triangleMesh("Alpha helper"));

    const result = createWebGpuAppAutoShadowFrame({
      app: app(device(calls)),
      assets,
      cache: createWebGpuAppResourceCache(),
      reuse: createWebGpuAppResourceReuseReport(),
      snapshot: snapshot({
        opaqueMesh,
        alphaMesh,
        opaqueBounds: { min: [-10, 0, -10], max: [10, 1, 10] },
        receiverBounds: { min: [-12, 0, -12], max: [12, 0.1, 12] },
        transforms: directionalLightTransform([0, -1, 0]),
        includeView: false,
      }),
    });

    const orthographicSize =
      result?.matrixComputation.matrices[0]?.orthographicSize;
    const oldWorldDiagonalSize = Math.hypot(20, 1, 20) * 1.1;

    expect(result).not.toBeNull();
    expect(orthographicSize).toBeGreaterThan(21);
    expect(orthographicSize).toBeLessThan(23);
    expect(orthographicSize).toBeLessThan(oldWorldDiagonalSize);
  });

  it("keeps shadow casters that are absent from the visible mesh draw list", () => {
    const calls = createDeviceCalls();
    const assets = new AssetRegistry();
    const opaqueMesh = createMeshHandle("off-camera-caster");
    const alphaMesh = createMeshHandle("off-camera-alpha-helper");

    assets.register(opaqueMesh, { label: "Off-camera caster" });
    assets.markReady(opaqueMesh, triangleMesh("Off-camera caster"));
    assets.register(alphaMesh, { label: "Off-camera alpha helper" });
    assets.markReady(alphaMesh, triangleMesh("Off-camera alpha helper"));

    const source = snapshot({
      opaqueMesh,
      alphaMesh,
      opaqueBounds: { min: [10, 0, 0], max: [12, 2, 2] },
      receiverBounds: { min: [-4, 0, -4], max: [4, 0.1, 4] },
    });
    const visibleReceiver = source.meshDraws.filter(
      (draw) => draw.renderId === 103,
    );
    const shadowCasterDraws = source.meshDraws.filter(
      (draw) => draw.renderId === 101 || draw.renderId === 102,
    );

    const result = createWebGpuAppAutoShadowFrame({
      app: app(device(calls)),
      assets,
      cache: createWebGpuAppResourceCache(),
      reuse: createWebGpuAppResourceReuseReport(),
      snapshot: {
        ...source,
        meshDraws: visibleReceiver,
        shadowCasterDraws,
        transforms: directionalLightTransform([-3, -1, 0]),
        report: {
          ...source.report,
          meshDraws: visibleReceiver.length,
          shadowCasterDraws: shadowCasterDraws.length,
        },
      },
    });
    const receiverOnlyResult = createWebGpuAppAutoShadowFrame({
      app: app(device(createDeviceCalls())),
      assets,
      cache: createWebGpuAppResourceCache(),
      reuse: createWebGpuAppResourceReuseReport(),
      snapshot: {
        ...source,
        meshDraws: visibleReceiver,
        transforms: directionalLightTransform([-3, -1, 0]),
        report: {
          ...source.report,
          meshDraws: visibleReceiver.length,
          shadowCasterDraws: 0,
        },
      },
    });

    expect(visibleReceiver.map((draw) => draw.renderId)).toEqual([103]);
    expect(result).not.toBeNull();
    expect(result?.casterDrawList.meshDrawCount).toBe(2);
    expect(
      result?.casterDrawList.lists[0]?.draws.map((draw) => draw.renderId),
    ).toEqual([101]);
    expect(
      result?.casterDrawList.diagnostics.map((diagnostic) => diagnostic.code),
    ).toEqual(["shadowCasterDrawList.unsupportedAlphaBlendCaster"]);
    expect(result?.matrixComputation.matrices[0]?.center[0]).toBeGreaterThan(
      -1,
    );
    expect(result?.matrixComputation.matrices[0]?.center[0]).toBeLessThan(1);
    expect(
      result?.matrixComputation.matrices[0]?.orthographicSize,
    ).toBeGreaterThan(7);
    expect(
      result?.matrixComputation.matrices[0]?.orthographicSize,
    ).toBeLessThan(9);
    expect(result?.matrixComputation.matrices[0]?.far).toBeGreaterThan(
      receiverOnlyResult?.matrixComputation.matrices[0]?.far ?? Infinity,
    );
  });

  it("fits default shadows from the receiver camera instead of an overlay camera", () => {
    const calls = createDeviceCalls();
    const assets = new AssetRegistry();
    const opaqueMesh = createMeshHandle("receiver-camera-caster");
    const alphaMesh = createMeshHandle("receiver-camera-alpha-helper");

    assets.register(opaqueMesh, { label: "Receiver camera caster" });
    assets.markReady(opaqueMesh, triangleMesh("Receiver camera caster"));
    assets.register(alphaMesh, { label: "Receiver camera alpha helper" });
    assets.markReady(alphaMesh, triangleMesh("Receiver camera alpha helper"));

    const result = createWebGpuAppAutoShadowFrame({
      app: app(device(calls)),
      assets,
      cache: createWebGpuAppResourceCache(),
      reuse: createWebGpuAppResourceReuseReport(),
      snapshot: snapshot({
        opaqueMesh,
        alphaMesh,
        viewSetup: overlayThenWorldCameraView(),
      }),
    });

    expect(result).not.toBeNull();
    expect(result?.viewProjection.plans[0]?.cascadeFarDistance).toBeGreaterThan(
      199,
    );
    expect(result?.viewProjection.plans[0]?.cascadeFarDistance).toBeLessThan(
      201,
    );
    expect(
      result?.matrixComputation.matrices[0]?.orthographicSize,
    ).toBeGreaterThan(7);
    expect(
      result?.matrixComputation.matrices[0]?.orthographicSize,
    ).toBeLessThan(9);
  });

  it("bakes a six-face cube shadow for a point light with no directional", () => {
    const calls = createDeviceCalls();
    const assets = new AssetRegistry();
    const opaqueMesh = createMeshHandle("point-caster");

    assets.register(opaqueMesh, { label: "Point caster" });
    assets.markReady(opaqueMesh, triangleMesh("Point caster"));

    const result = createWebGpuAppAutoShadowFrame({
      app: app(device(calls)),
      assets,
      cache: createWebGpuAppResourceCache(),
      reuse: createWebGpuAppResourceReuseReport(),
      snapshot: pointShadowSnapshot(opaqueMesh),
    });

    expect(result).not.toBeNull();
    expect(result?.report.status).toBe("submitted");
    // Point shadows use the self-consistent 2d-array receiver path.
    expect(result?.receiverResources?.shadowKind).toBe("point-array");
    expect(result?.descriptor.descriptors[0]).toMatchObject({
      lightKind: "point",
      faceCount: 6,
      viewDimension: "2d-array",
    });
    // Six cube faces -> six bake passes, six per-face draws of the one caster.
    expect(result?.passPlan.passCount).toBe(6);
    expect(result?.casterDrawList.includedDrawCount).toBe(6);
    expect(result?.report.drawCalls).toBe(6);
  });

  it("invalidates the cached point-shadow frame when the light moves", () => {
    const opaqueMesh = createMeshHandle("point-cache-caster");
    const source = pointShadowSnapshot(opaqueMesh);
    const movedLight = pointShadowSnapshot(opaqueMesh, [4, 6, 2]);

    expect(createWebGpuAppAutoShadowFrameInputKey(source)).not.toBe(
      createWebGpuAppAutoShadowFrameInputKey(movedLight),
    );
  });

  it("keys cached auto-shadow frames by actual shadow bounds inputs", () => {
    const opaqueMesh = createMeshHandle("keyed-caster");
    const alphaMesh = createMeshHandle("keyed-alpha-helper");
    const source = snapshot({ opaqueMesh, alphaMesh });
    const fixedCameraSource: RenderSnapshot = {
      ...source,
      shadowRequests: source.shadowRequests.map((request) => ({
        ...request,
        orthographicSize: 40,
      })),
    };

    expect(
      createWebGpuAppAutoShadowFrameInputKey(
        replaceSnapshotBounds(fixedCameraSource, 0, {
          min: [-100, -100, -100],
          max: [100, 100, 100],
        }),
      ),
    ).toBe(createWebGpuAppAutoShadowFrameInputKey(fixedCameraSource));
    const movedFixedCamera = cameraView(20, 10, 40);
    expect(
      createWebGpuAppAutoShadowFrameInputKey({
        ...fixedCameraSource,
        views: movedFixedCamera.views,
        viewMatrices: movedFixedCamera.viewMatrices,
      }),
    ).toBe(createWebGpuAppAutoShadowFrameInputKey(fixedCameraSource));

    const autoFitKey = createWebGpuAppAutoShadowFrameInputKey(source);
    const movedAutoFitCamera = cameraView(20, 10, 40);

    expect(
      createWebGpuAppAutoShadowFrameInputKey({
        ...source,
        views: movedAutoFitCamera.views,
        viewMatrices: movedAutoFitCamera.viewMatrices,
      }),
    ).not.toBe(autoFitKey);

    expect(
      createWebGpuAppAutoShadowFrameInputKey(
        replaceSnapshotBounds(source, 1, {
          min: [-100, -100, -100],
          max: [100, 100, 100],
        }),
      ),
    ).toBe(autoFitKey);
    expect(
      createWebGpuAppAutoShadowFrameInputKey(
        replaceSnapshotBounds(source, 0, {
          min: [-10, 0, -10],
          max: [10, 10, 10],
        }),
      ),
    ).not.toBe(autoFitKey);
    expect(
      createWebGpuAppAutoShadowFrameInputKey(
        replaceSnapshotBounds(source, 2, {
          min: [-20, 0, -20],
          max: [20, 0.1, 20],
        }),
      ),
    ).not.toBe(autoFitKey);
  });
});

function app(device: RenderShadowFrameDeviceLike): WebGpuApp {
  return { initialization: { device } } as WebGpuApp;
}

function snapshot(input: {
  readonly opaqueMesh: ReturnType<typeof createMeshHandle>;
  readonly alphaMesh: ReturnType<typeof createMeshHandle>;
  readonly opaqueBounds?: {
    readonly min: readonly [number, number, number];
    readonly max: readonly [number, number, number];
  };
  readonly receiverBounds?: {
    readonly min: readonly [number, number, number];
    readonly max: readonly [number, number, number];
  };
  readonly transforms?: Float32Array;
  readonly includeView?: boolean;
  readonly viewSetup?: Pick<RenderSnapshot, "views" | "viewMatrices">;
}): RenderSnapshot {
  const view = input.viewSetup ?? primaryCameraView();
  return {
    frame: 1,
    views: input.includeView === false ? [] : view.views,
    meshDraws: [
      meshDraw({
        renderId: 101,
        mesh: input.opaqueMesh,
        material: createMaterialHandle("opaque-caster"),
        boundsIndex: 0,
        pipelineKey: "standard|opaque|back|less|none",
        castsShadow: true,
        receivesShadow: true,
      }),
      meshDraw({
        renderId: 102,
        mesh: input.alphaMesh,
        material: createMaterialHandle("alpha-helper"),
        boundsIndex: 1,
        pipelineKey: "unlit|blend|none|less|alpha",
        castsShadow: true,
        receivesShadow: false,
      }),
      meshDraw({
        renderId: 103,
        mesh: input.opaqueMesh,
        material: createMaterialHandle("receiver"),
        boundsIndex: 2,
        pipelineKey: "standard|opaque|back|less|none",
        castsShadow: false,
        receivesShadow: true,
      }),
    ],
    lights: [
      {
        lightId: 11,
        entity: { index: 1, generation: 0 },
        kind: "directional",
        color: [1, 1, 1, 1],
        intensity: 1,
        range: 0,
        innerConeAngle: 0,
        outerConeAngle: 0,
        worldTransformOffset: 0,
        layerMask: 1,
      },
    ],
    environments: [],
    shadowRequests: [
      {
        shadowId: 7,
        lightId: 11,
        lightKind: "directional",
        cascadeCount: 1,
        casterLayerMask: 1,
        receiverLayerMask: 1,
      },
    ],
    bounds: [
      boundsPacket(
        0,
        input.opaqueBounds ?? {
          min: [-1, 0, -1],
          max: [1, 2, 1],
        },
      ),
      boundsPacket(1, {
        min: [-1000, -1000, -1000],
        max: [1000, 1000, 1000],
      }),
      boundsPacket(
        2,
        input.receiverBounds ?? {
          min: [-4, 0, -4],
          max: [4, 0.1, 4],
        },
      ),
    ],
    transforms: input.transforms ?? identityTransform(),
    viewMatrices:
      input.includeView === false ? new Float32Array(0) : view.viewMatrices,
    diagnostics: [],
    report: {
      views: input.includeView === false ? 0 : view.views.length,
      meshDraws: 3,
      lights: 1,
      environments: 0,
      shadowRequests: 1,
      bounds: 3,
      diagnostics: 0,
    },
  };
}

function pointShadowSnapshot(
  caster: ReturnType<typeof createMeshHandle>,
  lightPosition: readonly [number, number, number] = [0, 6, 0],
): RenderSnapshot {
  // Light transform at slot 0 (caster uses identity at the same slot — only its
  // translation matters to the point matrix computation, which reads columns
  // 12..14). A point shadow has no primary-camera fit, so no view is needed.
  const transforms = identityTransform();
  transforms[12] = lightPosition[0];
  transforms[13] = lightPosition[1];
  transforms[14] = lightPosition[2];

  return {
    frame: 1,
    views: [],
    meshDraws: [
      meshDraw({
        renderId: 201,
        mesh: caster,
        material: createMaterialHandle("point-caster"),
        boundsIndex: 0,
        pipelineKey: "standard|opaque|back|less|none",
        castsShadow: true,
        receivesShadow: true,
      }),
      meshDraw({
        renderId: 202,
        mesh: caster,
        material: createMaterialHandle("point-receiver"),
        boundsIndex: 1,
        pipelineKey: "standard|opaque|back|less|none",
        castsShadow: false,
        receivesShadow: true,
      }),
    ],
    lights: [
      {
        lightId: 11,
        entity: { index: 1, generation: 0 },
        kind: "point",
        color: [1, 1, 1, 1],
        intensity: 12,
        range: 40,
        innerConeAngle: 0,
        outerConeAngle: 0,
        worldTransformOffset: 0,
        layerMask: 1,
      },
    ],
    environments: [],
    shadowRequests: [
      {
        shadowId: 7,
        lightId: 11,
        lightKind: "point",
        casterLayerMask: 1,
        receiverLayerMask: 1,
      },
    ],
    bounds: [
      boundsPacket(0, { min: [-1, 0, -1], max: [1, 2, 1] }),
      boundsPacket(1, { min: [-8, 0, -8], max: [8, 0.1, 8] }),
    ],
    transforms,
    viewMatrices: new Float32Array(0),
    diagnostics: [],
    report: {
      views: 0,
      meshDraws: 2,
      lights: 1,
      environments: 0,
      shadowRequests: 1,
      bounds: 2,
      diagnostics: 0,
    },
  };
}

function boundsPacket(
  boundsId: number,
  worldAabb: RenderSnapshot["bounds"][number]["worldAabb"],
): RenderSnapshot["bounds"][number] {
  const center: readonly [number, number, number] = [
    (worldAabb.min[0] + worldAabb.max[0]) * 0.5,
    (worldAabb.min[1] + worldAabb.max[1]) * 0.5,
    (worldAabb.min[2] + worldAabb.max[2]) * 0.5,
  ];
  const radius = Math.hypot(
    worldAabb.max[0] - center[0],
    worldAabb.max[1] - center[1],
    worldAabb.max[2] - center[2],
  );

  return {
    boundsId,
    entity: { index: boundsId, generation: 0 },
    localAabb: worldAabb,
    worldAabb,
    localSphere: { center, radius },
    worldSphere: { center, radius },
  };
}

function replaceSnapshotBounds(
  source: RenderSnapshot,
  index: number,
  worldAabb: RenderSnapshot["bounds"][number]["worldAabb"],
): RenderSnapshot {
  return {
    ...source,
    bounds: source.bounds.map((bounds, boundsIndex) =>
      boundsIndex === index ? boundsPacket(bounds.boundsId, worldAabb) : bounds,
    ),
  };
}

function meshDraw(input: {
  readonly renderId: number;
  readonly mesh: ReturnType<typeof createMeshHandle>;
  readonly material: ReturnType<typeof createMaterialHandle>;
  readonly boundsIndex: number;
  readonly pipelineKey: string;
  readonly castsShadow: boolean;
  readonly receivesShadow: boolean;
}): RenderSnapshot["meshDraws"][number] {
  return {
    renderId: input.renderId,
    entity: { index: input.renderId, generation: 0 },
    mesh: input.mesh,
    material: input.material,
    submesh: 0,
    materialSlot: 0,
    worldTransformOffset: 0,
    boundsIndex: input.boundsIndex,
    layerMask: 1,
    castsShadow: input.castsShadow,
    receivesShadow: input.receivesShadow,
    sortKey: {
      queue: input.pipelineKey.includes("|blend|") ? "transparent" : "opaque",
      viewId: 0,
      layer: 0,
      order: 0,
      pipelineKey: input.pipelineKey,
      materialKey: `material:${input.material.id}`,
      meshKey: `mesh:${input.mesh.id}`,
      depth: 0,
      stableId: input.renderId,
    },
    batchKey: {
      pipelineKey: input.pipelineKey,
      materialKey: `material:${input.material.id}`,
      meshLayoutKey: "POSITION",
      topology: "triangle-list",
      instanced: false,
      skinned: false,
      morphed: false,
    },
  };
}

function primaryCameraView(): Pick<RenderSnapshot, "views" | "viewMatrices"> {
  return cameraView(80, 40, 120);
}

function cameraView(
  x: number,
  y: number,
  z: number,
): Pick<RenderSnapshot, "views" | "viewMatrices"> {
  const viewMatrix = translationView(x, y, z);
  const projectionMatrix = makePerspective(1, 1.5, 0.1, 200);
  const viewProjectionMatrix = multiplyMat4(projectionMatrix, viewMatrix);
  const viewMatrices = new Float32Array(48);

  viewMatrices.set(viewMatrix, 0);
  viewMatrices.set(projectionMatrix, 16);
  viewMatrices.set(viewProjectionMatrix, 32);

  return {
    views: [
      {
        viewId: 0,
        camera: { index: 99, generation: 0 },
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
    viewMatrices,
  };
}

function overlayThenWorldCameraView(): Pick<
  RenderSnapshot,
  "views" | "viewMatrices"
> {
  const overlayViewMatrix = translationView(0, 0, 0);
  const overlayProjectionMatrix = makePerspective(0.5, 1, 0.1, 2);
  const overlayViewProjectionMatrix = multiplyMat4(
    overlayProjectionMatrix,
    overlayViewMatrix,
  );
  const worldViewMatrix = translationView(80, 40, 120);
  const worldProjectionMatrix = makePerspective(1, 1.5, 0.1, 200);
  const worldViewProjectionMatrix = multiplyMat4(
    worldProjectionMatrix,
    worldViewMatrix,
  );
  const viewMatrices = new Float32Array(96);

  viewMatrices.set(overlayViewMatrix, 0);
  viewMatrices.set(overlayProjectionMatrix, 16);
  viewMatrices.set(overlayViewProjectionMatrix, 32);
  viewMatrices.set(worldViewMatrix, 48);
  viewMatrices.set(worldProjectionMatrix, 64);
  viewMatrices.set(worldViewProjectionMatrix, 80);

  return {
    views: [
      {
        viewId: 2,
        camera: { index: 102, generation: 0 },
        priority: -1,
        layerMask: 2,
        viewMatrixOffset: 0,
        projectionMatrixOffset: 16,
        viewProjectionMatrixOffset: 32,
        viewport: [0, 0, 1, 1],
        scissor: [0, 0, 1, 1],
        clearColor: [0, 0, 0, 0],
        clearDepth: 1,
        clearStencil: 0,
        renderTarget: null,
      },
      {
        viewId: 1,
        camera: { index: 101, generation: 0 },
        priority: 0,
        layerMask: 1,
        viewMatrixOffset: 48,
        projectionMatrixOffset: 64,
        viewProjectionMatrixOffset: 80,
        viewport: [0, 0, 1, 1],
        scissor: [0, 0, 1, 1],
        clearColor: [0, 0, 0, 1],
        clearDepth: 1,
        clearStencil: 0,
        renderTarget: null,
      },
    ],
    viewMatrices,
  };
}

function translationView(x: number, y: number, z: number): Float32Array {
  return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -x, -y, -z, 1]);
}

function triangleMesh(label: string): MeshAsset {
  return {
    kind: "mesh",
    label,
    vertexStreams: [
      {
        id: "POSITION",
        arrayStride: 12,
        vertexCount: 3,
        attributes: [{ semantic: "POSITION", format: "float32x3", offset: 0 }],
        data: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
      },
    ],
    indexBuffer: { format: "uint32", data: new Uint32Array([0, 1, 2]) },
    submeshes: [
      {
        label: "default",
        topology: "triangle-list",
        materialSlot: 0,
        vertexStart: 0,
        vertexCount: 3,
        indexStart: 0,
        indexCount: 3,
      },
    ],
    materialSlots: [{ index: 0, label: "default" }],
  };
}

function identityTransform(): Float32Array {
  return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
}

function directionalLightTransform(
  direction: readonly [number, number, number],
): Float32Array {
  const length = Math.hypot(direction[0], direction[1], direction[2]);
  const dx = direction[0] / length;
  const dy = direction[1] / length;
  const dz = direction[2] / length;
  const transform = identityTransform();
  transform[8] = -dx;
  transform[9] = -dy;
  transform[10] = -dz;
  return transform;
}

interface DeviceCalls {
  readonly textures: unknown[];
  readonly textureViews: unknown[];
  readonly samplers: unknown[];
  readonly buffers: unknown[];
  readonly bufferWrites: unknown[];
  readonly shaderModules: unknown[];
  readonly bindGroupLayouts: unknown[];
  readonly pipelineLayouts: unknown[];
  readonly pipelines: unknown[];
  readonly bindGroups: unknown[];
  readonly renderPasses: unknown[];
  readonly submissions: unknown[];
}

function createDeviceCalls(): DeviceCalls {
  return {
    textures: [],
    textureViews: [],
    samplers: [],
    buffers: [],
    bufferWrites: [],
    shaderModules: [],
    bindGroupLayouts: [],
    pipelineLayouts: [],
    pipelines: [],
    bindGroups: [],
    renderPasses: [],
    submissions: [],
  };
}

function device(calls: DeviceCalls): RenderShadowFrameDeviceLike {
  return {
    createTexture(descriptor) {
      calls.textures.push(descriptor);
      return {
        createView(viewDescriptor) {
          calls.textureViews.push(viewDescriptor ?? {});
          return { viewDescriptor: viewDescriptor ?? {} };
        },
      };
    },
    createSampler(descriptor) {
      calls.samplers.push(descriptor);
      return { descriptor };
    },
    createBuffer(descriptor) {
      calls.buffers.push(descriptor);
      return { descriptor };
    },
    createShaderModule(descriptor) {
      calls.shaderModules.push(descriptor);
      return { compilationInfo: async () => ({ messages: [] }) };
    },
    createBindGroupLayout(descriptor) {
      calls.bindGroupLayouts.push(descriptor);
      return { descriptor };
    },
    createPipelineLayout(descriptor) {
      calls.pipelineLayouts.push(descriptor);
      return { descriptor };
    },
    createRenderPipeline(descriptor) {
      calls.pipelines.push(descriptor);
      return { descriptor };
    },
    createBindGroup(descriptor) {
      calls.bindGroups.push(descriptor);
      return { descriptor };
    },
    createCommandEncoder() {
      return {
        beginRenderPass(descriptor: unknown) {
          calls.renderPasses.push(descriptor);
          return renderPassEncoder();
        },
        finish() {
          return { kind: "command-buffer" };
        },
      };
    },
    queue: {
      writeBuffer(...args) {
        calls.bufferWrites.push(args);
      },
      submit(commandBuffers) {
        calls.submissions.push(commandBuffers);
      },
    },
  };
}

function renderPassEncoder() {
  return {
    setPipeline: () => undefined,
    setBindGroup: () => undefined,
    setVertexBuffer: () => undefined,
    setIndexBuffer: () => undefined,
    drawIndexed: () => undefined,
    end: () => undefined,
  };
}
