import { describe, expect, it } from "vitest";

import { createApertureApp, defineApertureConfig } from "@aperture-engine/app";
import { createSystem, material, mesh } from "@aperture-engine/app/systems";
import { createMaterialHandle } from "@aperture-engine/simulation";
import {
  createMaterialPipelineKeyInput,
  type StandardMaterialAsset,
} from "@aperture-engine/render";

// A3 (three.js parity plan): the app-facade standard material builder exposes
// the full factor set the renderer already ships (KHR clearcoat, transmission,
// volume/IOR, sheen, iridescence, occlusion strength, normal scale) plus
// render-state control, so PBR extension authoring no longer requires glTF
// import or low-level asset construction.

describe("material.standard() PBR extension options", () => {
  it("passes every extension factor and renderState through to the material asset", async () => {
    class GlassSetupSystem extends createSystem({ priority: 0 }) {
      override init(): void {
        this.spawn.camera({
          key: "camera.main",
          transform: { translation: [0, 0, 4], lookAt: [0, 0, 0] },
        });
        this.spawn.mesh({
          key: "glass.sphere",
          mesh: mesh.sphere({ radius: 0.5 }),
          material: material.standard({
            label: "FullExtensionGlass",
            baseColor: [0.42, 0.72, 1, 1],
            metallic: 0,
            roughness: 0.02,
            emissiveFactor: [0.05, 0.1, 0.15],
            normalScale: 0.8,
            occlusionStrength: 0.9,
            clearcoatFactor: 0.6,
            clearcoatRoughnessFactor: 0.25,
            transmissionFactor: 0.9,
            ior: 1.31,
            thickness: 0.4,
            attenuationColor: [0.9, 0.95, 1],
            attenuationDistance: 2.5,
            sheenColorFactor: [0.2, 0.1, 0.05],
            sheenRoughnessFactor: 0.35,
            iridescenceFactor: 0.5,
            iridescenceIor: 1.8,
            iridescenceThicknessMinimum: 200,
            iridescenceThicknessMaximum: 600,
            renderState: {
              alphaMode: "blend",
              depth: { test: true, write: false, compare: "less" },
              blend: { preset: "alpha" },
              cullMode: "none",
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
      systems: [{ default: GlassSetupSystem }],
    });

    const entry = app.lowLevel.assets.get<"material", StandardMaterialAsset>(
      createMaterialHandle("glass.sphere.material"),
    );
    const asset = entry?.asset ?? null;
    expect(asset).not.toBeNull();
    expect(asset).toMatchObject({
      kind: "standard",
      label: "FullExtensionGlass",
      metallicFactor: 0,
      roughnessFactor: 0.02,
      emissiveFactor: [0.05, 0.1, 0.15],
      normalScale: 0.8,
      occlusionStrength: 0.9,
      clearcoatFactor: 0.6,
      clearcoatRoughnessFactor: 0.25,
      transmissionFactor: 0.9,
      ior: 1.31,
      thickness: 0.4,
      attenuationColor: [0.9, 0.95, 1],
      attenuationDistance: 2.5,
      sheenColorFactor: [0.2, 0.1, 0.05],
      sheenRoughnessFactor: 0.35,
      iridescenceFactor: 0.5,
      iridescenceIor: 1.8,
      iridescenceThicknessMinimum: 200,
      iridescenceThicknessMaximum: 600,
      renderState: {
        alphaMode: "blend",
        depth: { test: true, write: false, compare: "less" },
        blend: { preset: "alpha" },
        cullMode: "none",
      },
    });
    expect(Array.from(asset?.baseColorFactor ?? [])).toEqual([
      expect.closeTo(0.42, 5),
      expect.closeTo(0.72, 5),
      1,
      1,
    ]);

    // Non-zero extension factors enable their shader variants in the
    // pipeline key, matching the glTF-imported behavior.
    const keyInput = createMaterialPipelineKeyInput(
      asset as StandardMaterialAsset,
    );
    expect(keyInput.features).toEqual(
      expect.arrayContaining([
        "clearcoat",
        "transmission",
        "sheen",
        "iridescence",
      ]),
    );
  });

  it("keeps renderer defaults when extension options are omitted", async () => {
    class DefaultSetupSystem extends createSystem({ priority: 0 }) {
      override init(): void {
        this.spawn.mesh({
          key: "default.box",
          mesh: mesh.box({}),
          material: material.standard({ baseColor: [1, 1, 1, 1] }),
        });
      }
    }

    const app = await createApertureApp({
      config: defineApertureConfig({
        mode: "headless",
        systems: [],
        render: { defaultCamera: false, defaultLight: false },
      }),
      systems: [{ default: DefaultSetupSystem }],
    });

    const entry = app.lowLevel.assets.get<"material", StandardMaterialAsset>(
      createMaterialHandle("default.box.material"),
    );
    expect(entry?.asset).toMatchObject({
      kind: "standard",
      clearcoatFactor: 0,
      transmissionFactor: 0,
      ior: 1.5,
      thickness: 0,
      attenuationDistance: 0,
      sheenRoughnessFactor: 0,
      iridescenceFactor: 0,
      iridescenceIor: 1.3,
      iridescenceThicknessMinimum: 100,
      iridescenceThicknessMaximum: 400,
      normalScale: 1,
      occlusionStrength: 1,
      renderState: { alphaMode: "opaque" },
    });

    const keyInput = createMaterialPipelineKeyInput(
      entry?.asset as StandardMaterialAsset,
    );
    expect(keyInput.features).not.toEqual(
      expect.arrayContaining(["clearcoat"]),
    );
    expect(keyInput.features).not.toEqual(
      expect.arrayContaining(["transmission"]),
    );
  });
});
