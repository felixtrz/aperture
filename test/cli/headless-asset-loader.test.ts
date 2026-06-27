import { describe, expect, it } from "vitest";
import { createNodeApertureAssetLoader } from "@aperture-engine/cli";
import { createApertureHeadlessRunner } from "@aperture-engine/app/headless";
import { asset, defineApertureConfig } from "@aperture-engine/app/config";
import { createSystem, material, mesh } from "@aperture-engine/app/systems";
import type { ApertureSystemModule } from "@aperture-engine/app/advanced";

// A procedural cube system that does NOT depend on any external asset, so the
// snapshot is faithful regardless of asset placeholdering.
const cubeSystem: ApertureSystemModule = {
  default: class CubeScene extends createSystem({ priority: 0 }) {
    override init(): void {
      this.spawn.camera({
        key: "camera.main",
        transform: { translation: [0, 1, 6], lookAt: [0, 0, 0] },
        fovYDegrees: 60,
      });
      this.spawn.mesh({
        key: "cube",
        mesh: mesh.box({ size: [1, 1, 1] }),
        material: material.standard(),
        transform: { translation: [0, 0, 0] },
      });
    }
  },
};

describe("createNodeApertureAssetLoader (PD.4/PD.5)", () => {
  it("a procedural-only app records no placeholders and draws the cube", async () => {
    const runner = await createApertureHeadlessRunner({
      config: defineApertureConfig({
        mode: "headless",
        render: { defaultCamera: false, defaultLight: false },
      }),
      systems: [cubeSystem],
      assetLoader: createNodeApertureAssetLoader(),
    });

    const { snapshot } = runner.step(1 / 60, 0);
    const manifest = runner.app.lowLevel.assets.createManifestReport();

    expect(manifest.placeholders.count).toBe(0);
    expect(snapshot.meshDraws.length).toBe(1);
  });

  it("an external-asset app boots without invalidUrl and marks placeholders", async () => {
    const runner = await createApertureHeadlessRunner({
      config: defineApertureConfig({
        mode: "headless",
        render: { defaultCamera: false, defaultLight: false },
        assets: {
          robot: asset.gltf("/assets/cube.glb", { preload: "blocking" }),
          floorColor: asset.texture("/assets/checker.png", {
            preload: "blocking",
          }),
        },
      }),
      systems: [cubeSystem],
      assetLoader: createNodeApertureAssetLoader(),
    });

    expect(runner.app.context.assets.gltf("robot").ready.value).toBe(true);
    expect(runner.app.context.assets.texture("floorColor").ready.value).toBe(
      true,
    );

    const manifest = runner.app.lowLevel.assets.createManifestReport();
    expect(manifest.placeholders.count).toBeGreaterThanOrEqual(2);
    expect([...manifest.placeholders.ids].sort()).toEqual(
      expect.arrayContaining(["floorColor", "robot"]),
    );

    // The procedural cube still renders even though external assets are stubbed.
    expect(runner.step(1 / 60, 0).snapshot.meshDraws.length).toBe(1);
  });
});
