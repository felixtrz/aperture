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
    expect(new Set(second.packages)).toEqual(new Set(firstPackages));
    expect(second.packages.map((drawPackage) => drawPackage.renderId)).toEqual([
      readyDraw(1).renderId,
      readyDraw(2).renderId,
    ]);
  });
});

function readyDraw(
  seed: number,
  sort: { readonly order?: number } = {},
): RenderWorldReadyDraw {
  const packetValue = packet(seed, sort);

  return {
    renderId: packetValue.renderId,
    packet: packetValue,
    meshResourceKey: `mesh-resource:${seed}`,
    materialResourceKey: `material-resource:${seed}`,
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
  sort: { readonly order?: number } = {},
): MeshDrawPacket {
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
    sortKey: createRenderSortKey({ stableId, order: sort.order ?? 0 }),
    batchKey: createBatchCompatibilityKey({
      materialPipeline,
      materialKey: material.id,
      meshLayoutKey: "p3n3uv2",
      topology: "triangle-list",
    }),
  };
}
