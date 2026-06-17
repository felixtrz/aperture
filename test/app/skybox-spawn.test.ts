import { describe, expect, it } from "vitest";

import { createApertureApp } from "@aperture-engine/app";
import { asset, defineApertureConfig } from "@aperture-engine/app/config";
import { createSystem } from "@aperture-engine/app/systems";
import {
  createSamplerHandle,
  createTextureHandle,
  type Entity,
} from "@aperture-engine/simulation";
import {
  createSamplerAsset,
  createTextureAsset,
} from "@aperture-engine/render";

describe("app skybox spawning", () => {
  it("spawns ECS skyboxes from config texture handles", async () => {
    const refs: { skybox: Entity | null } = { skybox: null };
    const sampler = createSamplerHandle("app-skybox-sampler");

    class SkyboxSetupSystem extends createSystem({ priority: 0 }) {
      override init(): void {
        const sky = this.assets.texture("sky");

        this.assetsRegistry.markReady(
          sky.renderHandle,
          createTextureAsset({
            label: "App Skybox",
            dimension: "cube",
            width: 1,
            height: 1,
            depthOrLayers: 6,
            format: "rgba8unorm-srgb",
            colorSpace: "srgb",
            semantic: "base-color",
          }),
        );
        this.assetsRegistry.register(sampler, {
          label: "App Skybox Sampler",
        });
        this.assetsRegistry.markReady(
          sampler,
          createSamplerAsset({ label: "App Skybox Sampler" }),
        );
        this.spawn.camera({
          key: "camera.skybox",
          camera: { layerMask: 1, frustumCulling: false },
        });
        refs.skybox = this.spawn.skybox({
          key: "skybox.app",
          texture: sky,
          sampler,
          intensity: 0.5,
        });
      }
    }

    const app = await createApertureApp({
      config: defineApertureConfig({
        mode: "headless",
        assets: {
          sky: asset.texture("/sky.png", {
            preload: "manual",
            colorSpace: "srgb",
            semantic: "base-color",
          }),
        },
      }),
      systems: [{ default: SkyboxSetupSystem }],
    });

    const snapshot = app.extract(12);

    expect(refs.skybox).not.toBeNull();
    expect(snapshot.skyboxes).toHaveLength(1);
    expect(snapshot.skyboxes?.[0]).toMatchObject({
      entity: {
        index: refs.skybox?.index,
        generation: refs.skybox?.generation,
      },
      texture: createTextureHandle("sky"),
      sampler,
      intensity: 0.5,
      layerMask: 1,
    });
    expect(snapshot.report).toMatchObject({
      views: 1,
      skyboxes: 1,
      diagnostics: 0,
    });
    expect(snapshot.diagnostics).toEqual([]);
  });
});
