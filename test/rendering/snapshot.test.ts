import { describe, expect, it } from "vitest";
import {
  compareRenderSortKeys,
  createBatchCompatibilityKey,
  createMaterialPipelineKeyInput,
  createRenderSortKey,
  createStableRenderId,
  createUnlitMaterialAsset,
  type RenderSnapshot,
} from "@aperture-engine/render";

type HasNoGpuKeys<T> =
  Extract<
    keyof T,
    "gpu" | "device" | "buffer" | "texture" | "pipeline"
  > extends never
    ? true
    : false;

const snapshotHasNoGpuKeys: HasNoGpuKeys<RenderSnapshot> = true;

describe("render snapshot packet helpers", () => {
  it("creates deterministic stable render ids from entity index and generation", () => {
    expect(createStableRenderId({ index: 42, generation: 7 })).toBe(
      (7 << 24) | 42,
    );
    expect(createStableRenderId({ index: 42, generation: 8 })).not.toBe(
      createStableRenderId({ index: 42, generation: 7 }),
    );
  });

  it("sorts render keys deterministically by queue and depth policy", () => {
    const opaqueFar = createRenderSortKey({
      queue: "opaque",
      depth: 10,
      stableId: 2,
    });
    const opaqueNear = createRenderSortKey({
      queue: "opaque",
      depth: 1,
      stableId: 1,
    });
    const transparentNear = createRenderSortKey({
      queue: "transparent",
      depth: 1,
      stableId: 3,
    });
    const transparentFar = createRenderSortKey({
      queue: "transparent",
      depth: 10,
      stableId: 4,
    });

    expect(
      [transparentNear, opaqueFar, transparentFar, opaqueNear].sort(
        compareRenderSortKeys,
      ),
    ).toEqual([opaqueNear, opaqueFar, transparentFar, transparentNear]);
  });

  it("sorts transparent depth before pipeline and material grouping", () => {
    const transparentNearMaterialA = createRenderSortKey({
      queue: "transparent",
      depth: 1,
      pipelineKey: "standard|blend|back|less|alpha",
      materialKey: "material:a",
      meshKey: "mesh:a",
      stableId: 1,
    });
    const transparentFarMaterialZ = createRenderSortKey({
      queue: "transparent",
      depth: 10,
      pipelineKey: "standard|normalTexture|blend|back|less|alpha",
      materialKey: "material:z",
      meshKey: "mesh:z",
      stableId: 2,
    });
    const transparentFarTie = createRenderSortKey({
      queue: "transparent",
      depth: 10,
      pipelineKey: "standard|blend|back|less|alpha",
      materialKey: "material:a",
      meshKey: "mesh:a",
      stableId: 3,
    });

    expect(
      [
        transparentNearMaterialA,
        transparentFarTie,
        transparentFarMaterialZ,
      ].sort(compareRenderSortKeys),
    ).toEqual([
      transparentFarMaterialZ,
      transparentFarTie,
      transparentNearMaterialA,
    ]);
  });

  it("creates batch compatibility keys from material pipeline inputs without GPU objects", () => {
    const material = createUnlitMaterialAsset({
      renderState: { alphaMode: "mask" },
    });

    expect(
      createBatchCompatibilityKey({
        materialPipeline: createMaterialPipelineKeyInput(material),
        materialKey: "material:debug",
        meshLayoutKey: "p3n3uv2",
        topology: "triangle-list",
      }),
    ).toMatchObject({
      pipelineKey: "unlit|mask|back|less|none",
      materialKey: "material:debug",
      meshLayoutKey: "p3n3uv2",
      topology: "triangle-list",
      instanced: false,
      skinned: false,
      morphed: false,
    });
  });

  it("keeps snapshot data structured-clone friendly without GPU-shaped fields", () => {
    const snapshot: RenderSnapshot = {
      frame: 1,
      views: [],
      meshDraws: [],
      lights: [],
      environments: [],
      shadowRequests: [],
      bounds: [],
      transforms: new Float32Array(0),
      viewMatrices: new Float32Array(0),
      diagnostics: [],
      report: {
        views: 0,
        meshDraws: 0,
        lights: 0,
        environments: 0,
        shadowRequests: 0,
        bounds: 0,
        diagnostics: 0,
      },
    };

    expect(snapshotHasNoGpuKeys).toBe(true);
    expect(structuredClone(snapshot)).toEqual(snapshot);
  });
});
