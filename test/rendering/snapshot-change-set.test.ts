import { describe, expect, it } from "vitest";
import {
  createEnvironmentMapHandle,
  createMaterialHandle,
  createMeshHandle,
} from "@aperture-engine/simulation";
import {
  createRenderSnapshotChangeSet,
  createRenderSortKey,
  createStableRenderId,
  createRenderSnapshotUpdateSchedule,
  type BatchCompatibilityKey,
  type BoundsPacket,
  type EnvironmentPacket,
  type LightPacket,
  type MeshDrawPacket,
  type RenderQueue,
  type RenderSnapshot,
  type ShadowRequestPacket,
  type ViewPacket,
} from "@aperture-engine/render";

describe("render snapshot change set", () => {
  it("reports unchanged packet families for repeated snapshots", () => {
    const previous = snapshot({ frame: 1 });
    const next = snapshot({ frame: 2 });
    const changeSet = createRenderSnapshotChangeSet(previous, next);

    expect(changeSet).toMatchObject({
      previousFrame: 1,
      frame: 2,
      views: { changed: 0, unchanged: 1, removed: 0 },
      meshDraws: { changed: 0, unchanged: 1, removed: 0 },
      shadowCasterDraws: { changed: 0, unchanged: 1, removed: 0 },
      lights: { changed: 0, unchanged: 1, removed: 0 },
      environments: { changed: 0, unchanged: 1, removed: 0 },
      shadowRequests: { changed: 0, unchanged: 1, removed: 0 },
      bounds: { changed: 0, unchanged: 1, removed: 0 },
      total: { changed: 0, unchanged: 7, removed: 0 },
    });
    expect(changeSet.keys?.meshDraws).toEqual({
      changed: [],
      unchanged: [`mesh-draw:${meshDrawPacket().renderId}`],
      removed: [],
    });
    expect(changeSet.keys?.shadowCasterDraws).toEqual({
      changed: [],
      unchanged: [`shadow-caster-draw:${meshDrawPacket().renderId}`],
      removed: [],
    });
  });

  it("counts packet changes and removals by family", () => {
    const previous = snapshot({ frame: 3 });
    const next = snapshot({
      frame: 4,
      meshTransformSeed: 4,
      lightTransformSeed: 7,
      environment: false,
      shadowRequest: false,
      bounds: false,
    });
    const changeSet = createRenderSnapshotChangeSet(previous, next);

    expect(changeSet.views).toEqual({ changed: 0, unchanged: 1, removed: 0 });
    expect(changeSet.meshDraws).toEqual({
      changed: 1,
      unchanged: 0,
      removed: 0,
    });
    expect(changeSet.shadowCasterDraws).toEqual({
      changed: 1,
      unchanged: 0,
      removed: 0,
    });
    expect(changeSet.lights).toEqual({
      changed: 1,
      unchanged: 0,
      removed: 0,
    });
    expect(changeSet.environments).toEqual({
      changed: 0,
      unchanged: 0,
      removed: 1,
    });
    expect(changeSet.shadowRequests).toEqual({
      changed: 0,
      unchanged: 0,
      removed: 1,
    });
    expect(changeSet.bounds).toEqual({
      changed: 0,
      unchanged: 0,
      removed: 1,
    });
    expect(changeSet.total).toEqual({
      changed: 3,
      unchanged: 1,
      removed: 3,
    });
  });

  it("treats the first snapshot as changed", () => {
    const changeSet = createRenderSnapshotChangeSet(
      null,
      snapshot({ frame: 9 }),
    );

    expect(changeSet.previousFrame).toBeNull();
    expect(changeSet.total).toEqual({
      changed: 7,
      unchanged: 0,
      removed: 0,
    });
    expect(changeSet.shadowCasterDraws).toEqual({
      changed: 1,
      unchanged: 0,
      removed: 0,
    });
  });

  it("does not collapse duplicate entity bounds packets", () => {
    const previous = snapshotWithBounds(11, [
      boundsPacket({ boundsId: 0 }),
      boundsPacket({ boundsId: 1 }),
    ]);
    const next = snapshotWithBounds(12, [
      boundsPacket({ boundsId: 0 }),
      boundsPacket({ boundsId: 1 }),
    ]);
    const changeSet = createRenderSnapshotChangeSet(previous, next);

    expect(changeSet.bounds).toEqual({
      changed: 0,
      unchanged: 2,
      removed: 0,
    });
    expect(changeSet.keys?.bounds).toEqual({
      changed: [],
      unchanged: ["bounds:20:0", "bounds:20:0"],
      removed: [],
    });
  });

  it("treats entity bounds slot changes as unchanged resource identity", () => {
    const previous = snapshotWithBounds(13, [boundsPacket({ boundsId: 4 })]);
    const next = snapshotWithBounds(14, [boundsPacket({ boundsId: 9 })]);
    const changeSet = createRenderSnapshotChangeSet(previous, next);

    expect(changeSet.bounds).toEqual({
      changed: 0,
      unchanged: 1,
      removed: 0,
    });
    expect(changeSet.keys?.bounds).toEqual({
      changed: [],
      unchanged: ["bounds:20:0"],
      removed: [],
    });
  });

  it("treats non-transparent depth-only mesh sort changes as unchanged resource identity", () => {
    const previous = snapshot({ frame: 15, meshDepth: 4 });
    const next = snapshot({ frame: 16, meshDepth: 9 });
    const changeSet = createRenderSnapshotChangeSet(previous, next);
    const schedule = createRenderSnapshotUpdateSchedule(changeSet);

    expect(changeSet.meshDraws).toEqual({
      changed: 0,
      unchanged: 1,
      removed: 0,
    });
    expect(changeSet.keys?.meshDraws).toEqual({
      changed: [],
      unchanged: [`mesh-draw:${meshDrawPacket().renderId}`],
      removed: [],
    });
    expect(schedule.byFamily.meshDraws.action).toBe("reuse");
  });

  it("keeps transparent depth-only mesh sort changes invalidating order-dependent draws", () => {
    const previous = snapshot({
      frame: 17,
      meshQueue: "transparent",
      meshDepth: 4,
    });
    const next = snapshot({
      frame: 18,
      meshQueue: "transparent",
      meshDepth: 9,
    });
    const changeSet = createRenderSnapshotChangeSet(previous, next);
    const schedule = createRenderSnapshotUpdateSchedule(changeSet);

    expect(changeSet.meshDraws).toEqual({
      changed: 1,
      unchanged: 0,
      removed: 0,
    });
    expect(schedule.byFamily.meshDraws.action).toBe("refresh");
  });
});

function snapshot(input: {
  readonly frame: number;
  readonly meshTransformSeed?: number;
  readonly lightTransformSeed?: number;
  readonly meshQueue?: RenderQueue;
  readonly meshDepth?: number;
  readonly environment?: boolean;
  readonly shadowRequest?: boolean;
  readonly bounds?: boolean;
}): RenderSnapshot {
  const transforms = new Float32Array(32);
  writeMatrix(transforms, 0, input.meshTransformSeed ?? 1);
  writeMatrix(transforms, 16, input.lightTransformSeed ?? 2);

  const viewMatrices = new Float32Array(48);
  writeMatrix(viewMatrices, 0, 3);
  writeMatrix(viewMatrices, 16, 4);
  writeMatrix(viewMatrices, 32, 5);

  const meshDraw = meshDrawPacket({
    queue: input.meshQueue,
    depth: input.meshDepth,
  });
  const light = lightPacket();
  const environments = input.environment === false ? [] : [environmentPacket()];
  const shadowRequests =
    input.shadowRequest === false ? [] : [shadowRequestPacket()];
  const bounds = input.bounds === false ? [] : [boundsPacket()];

  return {
    frame: input.frame,
    views: [viewPacket()],
    meshDraws: [meshDraw],
    shadowCasterDraws: [meshDraw],
    lights: [light],
    environments,
    shadowRequests,
    bounds,
    transforms,
    instanceTints: new Float32Array([1, 0.5, 0.25, 1]),
    viewMatrices,
    diagnostics: [],
    report: {
      views: 1,
      meshDraws: 1,
      shadowCasterDraws: 1,
      lights: 1,
      environments: environments.length,
      shadowRequests: shadowRequests.length,
      bounds: bounds.length,
      diagnostics: 0,
    },
  };
}

function viewPacket(): ViewPacket {
  const camera = { index: 10, generation: 0 };

  return {
    viewId: createStableRenderId(camera),
    camera,
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
  };
}

function meshDrawPacket(
  input: {
    readonly queue?: RenderQueue;
    readonly depth?: number;
  } = {},
): MeshDrawPacket {
  const entity = { index: 20, generation: 0 };
  const stableId = createStableRenderId(entity);

  return {
    renderId: stableId,
    entity,
    mesh: createMeshHandle("cube"),
    material: createMaterialHandle("white"),
    submesh: 0,
    materialSlot: 0,
    worldTransformOffset: 0,
    instanceTintOffset: 0,
    boundsIndex: 0,
    layerMask: 1,
    castsShadow: true,
    receivesShadow: true,
    sortKey: createRenderSortKey({
      stableId,
      ...(input.queue === undefined ? {} : { queue: input.queue }),
      ...(input.depth === undefined ? {} : { depth: input.depth }),
    }),
    batchKey: batchKey(),
  };
}

function lightPacket(): LightPacket {
  const entity = { index: 30, generation: 0 };

  return {
    lightId: createStableRenderId(entity),
    entity,
    kind: "directional",
    color: [1, 1, 1, 1],
    intensity: 2,
    range: 10,
    innerConeAngle: Math.PI / 8,
    outerConeAngle: Math.PI / 6,
    worldTransformOffset: 16,
    layerMask: 1,
  };
}

function environmentPacket(): EnvironmentPacket {
  return {
    environmentId: 40,
    handle: createEnvironmentMapHandle("studio"),
    color: [1, 1, 1, 1],
    intensity: 1,
    layerMask: 1,
  };
}

function shadowRequestPacket(): ShadowRequestPacket {
  return {
    shadowId: 30,
    lightId: 30,
    lightKind: "directional",
    casterLayerMask: 1,
    receiverLayerMask: 1,
  };
}

function snapshotWithBounds(
  frame: number,
  bounds: readonly BoundsPacket[],
): RenderSnapshot {
  const base = snapshot({ frame });

  return {
    ...base,
    bounds,
    report: {
      ...base.report,
      bounds: bounds.length,
    },
  };
}

function boundsPacket(
  input: {
    readonly boundsId?: number;
  } = {},
): BoundsPacket {
  const entity = { index: 20, generation: 0 };

  return {
    boundsId: input.boundsId ?? 0,
    entity,
    localAabb: {
      min: [-0.5, -0.5, -0.5],
      max: [0.5, 0.5, 0.5],
    },
    worldAabb: {
      min: [-0.5, -0.5, -0.5],
      max: [0.5, 0.5, 0.5],
    },
    localSphere: { center: [0, 0, 0], radius: 0.866 },
    worldSphere: { center: [0, 0, 0], radius: 0.866 },
  };
}

function batchKey(): BatchCompatibilityKey {
  return {
    pipelineKey: "unlit|opaque|back|less|none",
    materialKey: "material:white",
    meshLayoutKey: "POSITION,NORMAL,TEXCOORD_0",
    topology: "triangle-list",
    instanced: false,
    skinned: false,
    morphed: false,
  };
}

function writeMatrix(values: Float32Array, offset: number, seed: number): void {
  for (let index = 0; index < 16; index += 1) {
    values[offset + index] = index % 5 === 0 ? 1 : seed + index / 100;
  }
}
