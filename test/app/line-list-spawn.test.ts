import { describe, expect, it } from "vitest";

import { createApertureApp, defineApertureConfig } from "@aperture-engine/app";
import { createSystem, material, mesh } from "@aperture-engine/app/systems";
import {
  assetHandleKey,
  createMaterialHandle,
  createMeshHandle,
  type Entity,
} from "@aperture-engine/simulation";
import type { MeshAsset, SourceMaterialAsset } from "@aperture-engine/render";

describe("app line-list spawning", () => {
  it("spawns native line-list meshes with unlit materials through the systems facade", async () => {
    const refs: { lines: Entity | null } = { lines: null };

    class LineSetupSystem extends createSystem({ priority: 0 }) {
      override init(): void {
        this.spawn.camera({
          key: "camera.lines",
          transform: { translation: [0, 0, 4], lookAt: [0, 0, 0] },
          camera: { layerMask: 1, frustumCulling: false },
        });
        refs.lines = this.spawn.mesh({
          key: "debug.lines",
          mesh: mesh.lineList({
            label: "Debug Cross Lines",
            positions: [
              [-1, 0, 0],
              [1, 0, 0],
              [0, -1, 0],
              [0, 1, 0],
            ],
            indices: [0, 1, 2, 3],
            materialSlots: ["cyan"],
          }),
          material: material.unlit({
            label: "Debug Lines Cyan",
            baseColor: [0.05, 0.85, 1, 1],
            renderState: {
              depth: { test: false, write: false, compare: "always" },
            },
          }),
        });
      }
    }

    const app = await createApertureApp({
      config: defineApertureConfig({
        mode: "headless",
        systems: [],
        render: { defaultCamera: false, defaultLight: false },
      }),
      systems: [{ default: LineSetupSystem }],
    });
    const snapshot = app.extract(1);
    const draw = snapshot.meshDraws.find(
      (candidate) => candidate.entity.index === refs.lines?.index,
    );
    const meshEntry = app.lowLevel.assets.get<"mesh", MeshAsset>(
      createMeshHandle("debug.lines.mesh"),
    );
    const materialEntry = app.lowLevel.assets.get<
      "material",
      SourceMaterialAsset
    >(createMaterialHandle("debug.lines.material"));

    expect(snapshot.diagnostics).toEqual([]);
    expect(draw).toMatchObject({
      mesh: createMeshHandle("debug.lines.mesh"),
      material: createMaterialHandle("debug.lines.material"),
      indexCount: 4,
      batchKey: { topology: "line-list" },
    });
    expect(meshEntry?.asset).toMatchObject({
      label: "Debug Cross Lines",
      submeshes: [{ topology: "line-list", indexCount: 4 }],
      materialSlots: [{ index: 0, label: "cyan" }],
    });
    expect(materialEntry?.asset).toMatchObject({
      kind: "unlit",
      label: "Debug Lines Cyan",
      renderState: {
        depth: { test: false, write: false, compare: "always" },
      },
    });
    expect(draw === undefined ? undefined : assetHandleKey(draw.mesh)).toBe(
      "mesh:debug.lines.mesh",
    );
  });

  it("rejects odd non-indexed line-list positions", async () => {
    class InvalidLineSetupSystem extends createSystem({ priority: 0 }) {
      override init(): void {
        this.spawn.mesh({
          key: "debug.bad-lines",
          mesh: mesh.lineList({
            positions: [[0, 0, 0]],
          }),
          material: material.unlit(),
        });
      }
    }

    await expect(
      createApertureApp({
        config: defineApertureConfig({
          mode: "headless",
          systems: [],
          render: { defaultCamera: false, defaultLight: false },
        }),
        systems: [{ default: InvalidLineSetupSystem }],
      }),
    ).rejects.toMatchObject({
      code: "aperture.spawn.invalidLineListMesh",
    });
  });
});
