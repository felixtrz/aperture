import { describe, expect, it } from "vitest";

import {
  RenderWorld,
  createBatchCompatibilityKey,
  createMaterialHandle,
  createMaterialPipelineKeyInput,
  createMeshHandle,
  createRenderSortKey,
  createStableRenderId,
  createUnlitMaterialAsset,
  type MeshDrawPacket,
  type RenderSnapshot,
} from "@aperture-engine/core";

describe("render world lifecycle", () => {
  it("creates, updates, and removes render objects by stable render id", () => {
    const world = new RenderWorld();
    const first = packet(1);
    const second = packet(2);

    expect(world.applySnapshot(snapshot([first]))).toMatchObject({
      created: 1,
      updated: 0,
      removed: 0,
      active: 1,
    });
    expect(world.getObject(first.renderId)?.packet).toEqual(first);

    expect(world.applySnapshot(snapshot([first, second]))).toMatchObject({
      created: 1,
      updated: 1,
      removed: 0,
      active: 2,
    });

    expect(world.applySnapshot(snapshot([second]))).toMatchObject({
      created: 0,
      updated: 1,
      removed: 1,
      active: 1,
    });
    expect(world.getObject(first.renderId)).toBeUndefined();
    expect(world.getObject(second.renderId)?.packet).toEqual(second);
  });

  it("is idempotent for repeated snapshots", () => {
    const world = new RenderWorld();
    const draw = packet(3);

    world.applySnapshot(snapshot([draw]));
    world.applySnapshot(snapshot([draw]));

    expect(world.size).toBe(1);
    expect(world.listObjects().map((object) => object.renderId)).toEqual([
      draw.renderId,
    ]);
  });

  it("reports duplicate render ids and keeps the first packet", () => {
    const world = new RenderWorld();
    const first = packet(4);
    const duplicate = { ...packet(5), renderId: first.renderId };
    const report = world.applySnapshot(snapshot([first, duplicate]));

    expect(report.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "renderWorld.duplicateRenderId",
    ]);
    expect(world.size).toBe(1);
    expect(world.getObject(first.renderId)?.packet).toEqual(first);
  });

  it("attaches, replaces, and clears renderer resource bindings", () => {
    const world = new RenderWorld();
    const draw = packet(6);

    world.applySnapshot(snapshot([draw]));

    expect(
      world.updateResourceBindings(draw.renderId, {
        meshResourceKey: "mesh-buffer:a",
        materialResourceKey: "material-bind-group:a",
      }),
    ).toMatchObject({ ok: true });
    expect(world.getObject(draw.renderId)?.gpu).toEqual({
      meshResourceKey: "mesh-buffer:a",
      materialResourceKey: "material-bind-group:a",
    });

    world.updateResourceBindings(draw.renderId, {
      meshResourceKey: "mesh-buffer:b",
    });
    expect(world.getObject(draw.renderId)?.gpu).toEqual({
      meshResourceKey: "mesh-buffer:b",
      materialResourceKey: "material-bind-group:a",
    });

    world.updateResourceBindings(draw.renderId, {
      meshResourceKey: null,
      materialResourceKey: null,
    });
    expect(world.getObject(draw.renderId)?.gpu).toEqual({
      meshResourceKey: null,
      materialResourceKey: null,
    });
  });

  it("reports missing render ids for resource binding updates", () => {
    const world = new RenderWorld();
    const result = world.updateResourceBindings(123, {
      meshResourceKey: "mesh-buffer:missing",
    });

    expect(result).toMatchObject({
      ok: false,
      reason: "missing-render-id",
    });

    if (!result.ok) {
      expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
        "renderWorld.missingRenderId",
      ]);
    }
  });

  it("preserves bindings across matching snapshots and drops removed objects", () => {
    const world = new RenderWorld();
    const first = packet(7);
    const second = packet(8);

    world.applySnapshot(snapshot([first, second]));
    world.updateResourceBindings(first.renderId, {
      meshResourceKey: "mesh-buffer:first",
      materialResourceKey: "material-bind-group:first",
    });

    world.applySnapshot(
      snapshot([
        { ...first, worldTransformOffset: first.worldTransformOffset + 16 },
        second,
      ]),
    );

    expect(world.getObject(first.renderId)?.gpu).toEqual({
      meshResourceKey: "mesh-buffer:first",
      materialResourceKey: "material-bind-group:first",
    });

    world.applySnapshot(snapshot([second]));

    expect(world.getObject(first.renderId)).toBeUndefined();
    expect(world.getObject(second.renderId)?.gpu).toEqual({
      meshResourceKey: null,
      materialResourceKey: null,
    });
  });

  it("reports draw readiness when all render objects have resource bindings", () => {
    const world = new RenderWorld();
    const first = packet(9);
    const second = packet(10);

    world.applySnapshot(snapshot([first, second]));
    world.updateResourceBindings(first.renderId, {
      meshResourceKey: "mesh:first",
      materialResourceKey: "material:first",
    });
    world.updateResourceBindings(second.renderId, {
      meshResourceKey: "mesh:second",
      materialResourceKey: "material:second",
    });

    expect(world.createDrawReadinessReport()).toMatchObject({
      ready: [
        {
          renderId: first.renderId,
          meshResourceKey: "mesh:first",
          materialResourceKey: "material:first",
          batchKey: first.batchKey,
        },
        {
          renderId: second.renderId,
          meshResourceKey: "mesh:second",
          materialResourceKey: "material:second",
          batchKey: second.batchKey,
        },
      ],
      blocked: [],
      diagnostics: [],
    });
  });

  it("reports partially blocked render objects", () => {
    const world = new RenderWorld();
    const ready = packet(11);
    const blocked = packet(12);

    world.applySnapshot(snapshot([ready, blocked]));
    world.updateResourceBindings(ready.renderId, {
      meshResourceKey: "mesh:ready",
      materialResourceKey: "material:ready",
    });
    world.updateResourceBindings(blocked.renderId, {
      meshResourceKey: "mesh:blocked",
    });

    const report = world.createDrawReadinessReport();

    expect(report.ready.map((draw) => draw.renderId)).toEqual([ready.renderId]);
    expect(report.blocked).toMatchObject([
      {
        renderId: blocked.renderId,
        missing: ["missing-material-resource"],
      },
    ]);
    expect(report.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "renderWorld.missingMaterialResource",
    ]);
  });

  it("reports all-blocked and empty render worlds", () => {
    const world = new RenderWorld();
    const first = packet(13);
    const second = packet(14);

    expect(world.createDrawReadinessReport()).toMatchObject({
      ready: [],
      blocked: [],
      diagnostics: [{ code: "renderWorld.empty" }],
    });

    world.applySnapshot(snapshot([first, second]));
    world.updateResourceBindings(second.renderId, {
      materialResourceKey: "material:second",
    });

    const report = world.createDrawReadinessReport();

    expect(report.ready).toEqual([]);
    expect(report.blocked).toMatchObject([
      {
        renderId: first.renderId,
        missing: ["missing-mesh-resource", "missing-material-resource"],
      },
      {
        renderId: second.renderId,
        missing: ["missing-mesh-resource"],
      },
    ]);
    expect(report.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "renderWorld.missingMeshResource",
      "renderWorld.missingMaterialResource",
      "renderWorld.missingMeshResource",
    ]);
  });
});

function packet(seed: number): MeshDrawPacket {
  const entity = { index: seed, generation: 0 };
  const stableId = createStableRenderId(entity);
  const mesh = createMeshHandle(`mesh-${seed}`);
  const material = createMaterialHandle(`material-${seed}`);
  const materialAsset = createUnlitMaterialAsset();
  const materialPipeline = createMaterialPipelineKeyInput(materialAsset);

  return {
    renderId: stableId,
    entity,
    mesh,
    material,
    submesh: 0,
    materialSlot: 0,
    worldTransformOffset: seed * 16,
    boundsIndex: seed,
    layerMask: 1,
    sortKey: createRenderSortKey({ stableId }),
    batchKey: createBatchCompatibilityKey({
      materialPipeline,
      materialKey: material.id,
      meshLayoutKey: "p3n3uv2",
      topology: "triangle-list",
    }),
  };
}

function snapshot(meshDraws: readonly MeshDrawPacket[]): RenderSnapshot {
  return {
    frame: 1,
    views: [],
    meshDraws,
    lights: [],
    environments: [],
    shadowRequests: [],
    bounds: [],
    transforms: new Float32Array(0),
    viewMatrices: new Float32Array(0),
    diagnostics: [],
    report: {
      views: 0,
      meshDraws: meshDraws.length,
      lights: 0,
      environments: 0,
      shadowRequests: 0,
      bounds: 0,
      diagnostics: 0,
    },
  };
}
