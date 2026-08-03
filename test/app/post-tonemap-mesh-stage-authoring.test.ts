import { describe, expect, it } from "vitest";

import { createApertureApp, defineApertureConfig } from "@aperture-engine/app";
import { createSystem, material, mesh } from "@aperture-engine/app/systems";
import { createMaterialHandle, type Entity } from "@aperture-engine/simulation";
import {
  MATERIAL_POST_TONEMAP_STAGE_FEATURE,
  MATERIAL_UNTONEMAPPED_FEATURE,
  decodeSnapshotPackets,
  encodeSnapshotPackets,
  type MeshDrawPacket,
  type RenderSnapshot,
  type SourceMaterialAsset,
} from "@aperture-engine/render";

// The parity case this exists for: a translucent board overlay authored as a
// three.js `MeshBasicMaterial({ toneMapped: false })` blends in DISPLAY space,
// after tonemapping. An unlit Aperture material writes its authored color into
// the HDR scene buffer instead, so the blend happens in linear space and ACES
// then washes the overlay out. `renderStage: "post-tonemap"` is the supported
// route for those draws — the mesh sibling of the particle renderer's option.
describe("post-tonemap mesh render stage authoring", () => {
  it("carries renderStage and toneMapped from material.unlit() into the material asset", async () => {
    const app = await createApp();

    expect(
      app.lowLevel.assets.get<"material", SourceMaterialAsset>(
        createMaterialHandle("overlay.pad.material"),
      )?.asset,
    ).toMatchObject({
      kind: "unlit",
      label: "Tether Pad",
      renderStage: "post-tonemap",
      toneMapped: false,
    });

    expect(
      app.lowLevel.assets.get<"material", SourceMaterialAsset>(
        createMaterialHandle("overlay.board.material"),
      )?.asset,
    ).toMatchObject({
      kind: "unlit",
      renderStage: "scene",
      toneMapped: true,
    });
  });

  it("extracts the stage onto the mesh draw packet and separates its pipeline key", async () => {
    const app = await createApp();
    const snapshot = app.extract(1);

    expect(snapshot.diagnostics).toEqual([]);

    const pad = requireDraw(snapshot, "overlay.pad.material");
    const board = requireDraw(snapshot, "overlay.board.material");

    expect(pad.renderStage).toBe("post-tonemap");
    expect(board.renderStage).toBeUndefined();

    // The stage changes the color target, sample count, depth state and output
    // transform, so it must split pipelines (and therefore draw batches) the
    // way a shader feature does.
    expect(pad.batchKey.pipelineKey.split("|")).toEqual(
      expect.arrayContaining([
        MATERIAL_POST_TONEMAP_STAGE_FEATURE,
        MATERIAL_UNTONEMAPPED_FEATURE,
      ]),
    );
    expect(board.batchKey.pipelineKey.split("|")).not.toEqual(
      expect.arrayContaining([MATERIAL_POST_TONEMAP_STAGE_FEATURE]),
    );
    expect(pad.batchKey.pipelineKey).not.toBe(board.batchKey.pipelineKey);
  });

  it("round-trips the stage through the packed snapshot transport", async () => {
    const app = await createApp();
    const snapshot = app.extract(1);
    const bundle = {
      views: [],
      meshDraws: snapshot.meshDraws,
      lights: [],
      environments: [],
      shadowRequests: [],
      bounds: [],
      fogs: [],
    };
    const encoded = encodeSnapshotPackets(bundle);
    const decoded = decodeSnapshotPackets(encoded.words, encoded.registry);

    expect(decoded.meshDraws).toEqual(snapshot.meshDraws);
    expect(
      findDraw(decoded.meshDraws, "overlay.pad.material")?.renderStage,
    ).toBe("post-tonemap");
    expect(
      findDraw(decoded.meshDraws, "overlay.board.material")?.renderStage,
    ).toBeUndefined();
  });
});

function requireDraw(
  snapshot: RenderSnapshot,
  materialId: string,
): MeshDrawPacket {
  const draw = findDraw(snapshot.meshDraws, materialId);

  if (draw === undefined) {
    throw new Error(`No mesh draw for material '${materialId}'.`);
  }

  return draw;
}

function findDraw(
  draws: readonly MeshDrawPacket[],
  materialId: string,
): MeshDrawPacket | undefined {
  const handle = createMaterialHandle(materialId);

  return draws.find((candidate) => candidate.material.id === handle.id);
}

async function createApp(): Promise<
  Awaited<ReturnType<typeof createApertureApp>>
> {
  const refs: { pad: Entity | null } = { pad: null };

  class OverlaySetupSystem extends createSystem({ priority: 0 }) {
    override init(): void {
      this.spawn.camera({
        key: "camera.overlay",
        transform: { translation: [0, 2, 4], lookAt: [0, 0, 0] },
        camera: { layerMask: 1, frustumCulling: false },
      });
      this.spawn.mesh({
        key: "overlay.board",
        mesh: mesh.plane({ size: 4 }),
        material: material.unlit({
          label: "Board",
          baseColor: [0.13, 0.13, 0.14, 1],
        }),
      });
      refs.pad = this.spawn.mesh({
        key: "overlay.pad",
        mesh: mesh.plane({ size: 1 }),
        material: material.unlit({
          label: "Tether Pad",
          baseColor: [0.4941, 0.9647, 0.8627, 0.2056],
          renderStage: "post-tonemap",
          toneMapped: false,
          renderState: {
            alphaMode: "blend",
            blend: { preset: "alpha" },
            depth: { test: true, write: false, compare: "less" },
          },
        }),
      });
    }
  }

  return createApertureApp({
    config: defineApertureConfig({
      mode: "headless",
      systems: [],
      render: { defaultCamera: false, defaultLight: false },
    }),
    systems: [{ default: OverlaySetupSystem }],
  });
}
