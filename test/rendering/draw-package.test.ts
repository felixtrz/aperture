import { describe, expect, it } from "vitest";

import {
  createBatchCompatibilityKey,
  createMaterialHandle,
  createMaterialPipelineKeyInput,
  createMeshHandle,
  createRenderWorldDrawPackageScratch,
  createRenderSortKey,
  createStableRenderId,
  createUnlitMaterialAsset,
  planRenderWorldDrawPackages,
  writeRenderWorldDrawPackages,
  type MeshDrawPacket,
  type PackedSnapshotTransforms,
  type RenderWorldDrawReadinessReport,
  type RenderWorldReadyDraw,
} from "@aperture-engine/core";

describe("render-world draw package planning", () => {
  it("creates packages for ready draws and preserves resource keys", () => {
    const first = readyDraw(1, { order: 2 });
    const second = readyDraw(2, { order: 1 });
    const result = planRenderWorldDrawPackages(
      readiness({ ready: [first, second] }),
      transforms([
        [first.renderId, 16],
        [second.renderId, 0],
      ]),
    );

    expect(result.diagnostics).toEqual([]);
    expect(result.packages.map((drawPackage) => drawPackage.renderId)).toEqual([
      second.renderId,
      first.renderId,
    ]);
    expect(result.packages[0]).toMatchObject({
      renderId: second.renderId,
      meshResourceKey: "mesh-resource:2",
      materialResourceKey: "material-resource:2",
      batchKey: second.batchKey,
      transformPackedOffset: 0,
    });
    expect(result.summary).toMatchObject({
      readyDrawCount: 2,
      blockedDrawCount: 0,
      packageCount: 2,
      packagePoolSizeBeforeWrite: 0,
      packagePoolSize: 2,
      packageSlotsReused: 0,
      packageSlotsCreated: 2,
      missingPackedTransformCount: 0,
      diagnostics: { total: 0, byCode: {} },
    });
  });

  it("summarizes empty draw package writes", () => {
    const scratch = createRenderWorldDrawPackageScratch();
    const result = writeRenderWorldDrawPackages(
      readiness({ ready: [] }),
      transforms([]),
      scratch,
    );

    expect(result.summary).toBe(scratch.summary);
    expect(result.summary).toEqual({
      readyDrawCount: 0,
      blockedDrawCount: 0,
      packageCount: 0,
      packagePoolSize: 0,
      packagePoolSizeBeforeWrite: 0,
      packageSlotsReused: 0,
      packageSlotsCreated: 0,
      missingPackedTransformCount: 0,
      stateSort: {
        phase: "opaque",
        policy: "opaque-state-resource-front-to-back-stable",
        recordCount: 0,
        stableOrder: {
          pipeline: 0,
          materialResource: 0,
          meshLayout: 0,
          meshResource: 0,
          total: 0,
        },
        stateAwareOrder: {
          pipeline: 0,
          materialResource: 0,
          meshLayout: 0,
          meshResource: 0,
          total: 0,
        },
        delta: {
          pipeline: 0,
          materialResource: 0,
          meshLayout: 0,
          meshResource: 0,
          total: 0,
        },
      },
      diagnostics: { total: 0, byCode: {} },
    });
  });

  it("groups opaque packages by prepared state inside authored render-order buckets", () => {
    const redA = readyDraw(1, {
      pipelineKey: "standard|opaque|back|less|none",
      materialResourceKey: "material-resource:red",
      meshResourceKey: "mesh-resource:a",
    });
    const cutout = readyDraw(2, {
      queue: "alpha-test",
      pipelineKey: "standard|mask|back|less|none",
      materialResourceKey: "material-resource:cutout",
      meshResourceKey: "mesh-resource:cutout",
    });
    const redB = readyDraw(3, {
      pipelineKey: "standard|opaque|back|less|none",
      materialResourceKey: "material-resource:red",
      meshResourceKey: "mesh-resource:b",
    });
    const laterCutout = readyDraw(4, {
      queue: "alpha-test",
      order: 1,
      pipelineKey: "standard|mask|back|less|none",
      materialResourceKey: "material-resource:cutout",
      meshResourceKey: "mesh-resource:later-cutout",
    });

    const result = planRenderWorldDrawPackages(
      readiness({ ready: [redA, cutout, redB, laterCutout] }),
      transforms([
        [redA.renderId, 0],
        [cutout.renderId, 16],
        [redB.renderId, 32],
        [laterCutout.renderId, 48],
      ]),
    );

    expect(result.packages.map((drawPackage) => drawPackage.renderId)).toEqual([
      redA.renderId,
      redB.renderId,
      cutout.renderId,
      laterCutout.renderId,
    ]);
    expect(result.summary.stateSort).toMatchObject({
      phase: "opaque",
      policy: "opaque-state-resource-front-to-back-stable",
      recordCount: 4,
      stableOrder: {
        pipeline: 4,
        materialResource: 4,
        meshLayout: 1,
        meshResource: 4,
        total: 13,
      },
      stateAwareOrder: {
        pipeline: 2,
        materialResource: 2,
        meshLayout: 1,
        meshResource: 4,
        total: 9,
      },
      delta: {
        pipeline: 2,
        materialResource: 2,
        meshLayout: 0,
        meshResource: 0,
        total: 4,
      },
    });
  });

  it("diagnoses ready draws missing packed transform offsets", () => {
    const draw = readyDraw(3);
    const result = planRenderWorldDrawPackages(
      readiness({ ready: [draw] }),
      transforms([]),
    );

    expect(result.packages).toEqual([]);
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "renderDrawPackage.missingPackedTransform",
    ]);
    expect(result.summary).toMatchObject({
      readyDrawCount: 1,
      blockedDrawCount: 0,
      packageCount: 0,
      missingPackedTransformCount: 1,
      diagnostics: {
        total: 1,
        byCode: { "renderDrawPackage.missingPackedTransform": 1 },
      },
    });
    expect(JSON.stringify(result.summary)).not.toContain("packet");
    expect(JSON.stringify(result.summary)).not.toContain("GPU");
  });

  it("diagnoses blocked draw inputs", () => {
    const draw = packet(4);
    const result = planRenderWorldDrawPackages(
      readiness({
        blocked: [
          {
            renderId: draw.renderId,
            packet: draw,
            missing: ["missing-mesh-resource"],
          },
        ],
      }),
      transforms([]),
    );

    expect(result.packages).toEqual([]);
    expect(result.diagnostics).toMatchObject([
      { code: "renderDrawPackage.blockedDraw" },
    ]);
    expect(result.summary).toMatchObject({
      readyDrawCount: 0,
      blockedDrawCount: 1,
      packageCount: 0,
      diagnostics: {
        total: 1,
        byCode: { "renderDrawPackage.blockedDraw": 1 },
      },
    });
  });

  it("preserves transform pack diagnostics", () => {
    const draw = readyDraw(5);
    const result = planRenderWorldDrawPackages(readiness({ ready: [draw] }), {
      data: new Float32Array(0),
      offsets: [],
      diagnostics: [
        {
          code: "renderTransformPack.missingTransform",
          message: "missing",
          severity: "warning",
        },
      ],
    });

    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "renderTransformPack.missingTransform",
      "renderDrawPackage.missingPackedTransform",
    ]);
  });

  it("can reuse caller-owned scratch packages on the frame hot path", () => {
    const scratch = createRenderWorldDrawPackageScratch(2);
    const first = writeRenderWorldDrawPackages(
      readiness({ ready: [readyDraw(1), readyDraw(2)] }),
      transforms([
        [readyDraw(1).renderId, 0],
        [readyDraw(2).renderId, 16],
      ]),
      scratch,
    );
    const firstPackages = [...first.packages];
    const second = writeRenderWorldDrawPackages(
      readiness({ ready: [readyDraw(2), readyDraw(1)] }),
      transforms([
        [readyDraw(1).renderId, 0],
        [readyDraw(2).renderId, 16],
      ]),
      scratch,
    );

    expect(second).toBe(first);
    expect(second.summary).toBe(first.summary);
    expect(second.summary).toMatchObject({
      readyDrawCount: 2,
      packageCount: 2,
      packagePoolSizeBeforeWrite: 2,
      packagePoolSize: 2,
      packageSlotsReused: 2,
      packageSlotsCreated: 0,
    });
    expect(new Set(second.packages)).toEqual(new Set(firstPackages));
    expect(second.packages.map((drawPackage) => drawPackage.renderId)).toEqual([
      readyDraw(1).renderId,
      readyDraw(2).renderId,
    ]);
  });

  it("summarizes package pool growth on caller-owned scratch", () => {
    const scratch = createRenderWorldDrawPackageScratch(1);
    const result = writeRenderWorldDrawPackages(
      readiness({ ready: [readyDraw(1), readyDraw(2), readyDraw(3)] }),
      transforms([
        [readyDraw(1).renderId, 0],
        [readyDraw(2).renderId, 16],
        [readyDraw(3).renderId, 32],
      ]),
      scratch,
    );

    expect(result.summary).toMatchObject({
      readyDrawCount: 3,
      packageCount: 3,
      packagePoolSizeBeforeWrite: 1,
      packagePoolSize: 3,
      packageSlotsReused: 1,
      packageSlotsCreated: 2,
    });
  });
});

function readyDraw(
  seed: number,
  sort: {
    readonly order?: number;
    readonly queue?: "opaque" | "alpha-test" | "transparent";
    readonly pipelineKey?: string;
    readonly materialResourceKey?: string;
    readonly meshResourceKey?: string;
    readonly meshLayoutKey?: string;
  } = {},
): RenderWorldReadyDraw {
  const packetValue = packet(seed, sort);

  return {
    renderId: packetValue.renderId,
    packet: packetValue,
    meshResourceKey: sort.meshResourceKey ?? `mesh-resource:${seed}`,
    materialResourceKey:
      sort.materialResourceKey ?? `material-resource:${seed}`,
    batchKey: packetValue.batchKey,
  };
}

function readiness(input: {
  readonly ready?: readonly RenderWorldReadyDraw[];
  readonly blocked?: RenderWorldDrawReadinessReport["blocked"];
}): RenderWorldDrawReadinessReport {
  return {
    ready: input.ready ?? [],
    blocked: input.blocked ?? [],
    diagnostics: [],
  };
}

function transforms(
  offsets: readonly (readonly [number, number])[],
): PackedSnapshotTransforms {
  return {
    data: new Float32Array(offsets.length * 16),
    offsets: offsets.map(([renderId, packedOffset]) => ({
      renderId,
      sourceOffset: packedOffset,
      packedOffset,
    })),
    diagnostics: [],
  };
}

function packet(
  seed: number,
  sort: {
    readonly order?: number;
    readonly queue?: "opaque" | "alpha-test" | "transparent";
    readonly pipelineKey?: string;
    readonly materialResourceKey?: string;
    readonly meshResourceKey?: string;
    readonly meshLayoutKey?: string;
  } = {},
): MeshDrawPacket {
  const entity = { index: seed, generation: 0 };
  const stableId = createStableRenderId(entity);
  const mesh = createMeshHandle(`mesh-${seed}`);
  const material = createMaterialHandle(`material-${seed}`);
  const materialAsset = createUnlitMaterialAsset();
  const materialPipeline = createMaterialPipelineKeyInput(materialAsset);

  const batchKey = createBatchCompatibilityKey({
    materialPipeline,
    materialKey: material.id,
    meshLayoutKey: sort.meshLayoutKey ?? "p3n3uv2",
    topology: "triangle-list",
  });

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
    sortKey: createRenderSortKey({
      stableId,
      order: sort.order ?? 0,
      pipelineKey: sort.pipelineKey ?? batchKey.pipelineKey,
      materialKey: material.id,
      meshKey: mesh.id,
      ...(sort.queue === undefined ? {} : { queue: sort.queue }),
    }),
    batchKey: {
      ...batchKey,
      pipelineKey: sort.pipelineKey ?? batchKey.pipelineKey,
      meshLayoutKey: sort.meshLayoutKey ?? batchKey.meshLayoutKey,
    },
  };
}
