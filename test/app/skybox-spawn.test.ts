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

  it("spawns ECS procedural skies from app systems", async () => {
    const refs: { sky: Entity | null } = { sky: null };

    class ProceduralSkySetupSystem extends createSystem({ priority: 0 }) {
      override init(): void {
        this.spawn.camera({
          key: "camera.procedural-sky",
          camera: { layerMask: 1, frustumCulling: false },
        });
        refs.sky = this.spawn.proceduralSky({
          key: "procedural-sky.app",
          topColor: [0.04, 0.08, 0.2],
          horizonColor: [0.46, 0.24, 0.1],
          bottomColor: [0.01, 0.012, 0.03],
          horizonPosition: 0.38,
          horizonSoftness: 0.22,
          intensity: 1.15,
          ditherStrength: 0.002,
        });
      }
    }

    const app = await createApertureApp({
      config: defineApertureConfig({ mode: "headless" }),
      systems: [{ default: ProceduralSkySetupSystem }],
    });

    const snapshot = app.extract(13);

    expect(refs.sky).not.toBeNull();
    expect(snapshot.proceduralSkies).toHaveLength(1);
    const sky = snapshot.proceduralSkies?.[0];

    expect(sky).toMatchObject({
      entity: {
        index: refs.sky?.index,
        generation: refs.sky?.generation,
      },
      layerMask: 1,
    });
    expect(sky?.topColor[0]).toBeCloseTo(0.04, 6);
    expect(sky?.topColor[1]).toBeCloseTo(0.08, 6);
    expect(sky?.topColor[2]).toBeCloseTo(0.2, 6);
    expect(sky?.horizonColor[0]).toBeCloseTo(0.46, 6);
    expect(sky?.horizonColor[1]).toBeCloseTo(0.24, 6);
    expect(sky?.horizonColor[2]).toBeCloseTo(0.1, 6);
    expect(sky?.bottomColor[0]).toBeCloseTo(0.01, 6);
    expect(sky?.bottomColor[1]).toBeCloseTo(0.012, 6);
    expect(sky?.bottomColor[2]).toBeCloseTo(0.03, 6);
    expect(sky?.horizonPosition).toBeCloseTo(0.38, 6);
    expect(sky?.horizonSoftness).toBeCloseTo(0.22, 6);
    expect(sky?.intensity).toBeCloseTo(1.15, 6);
    expect(sky?.ditherStrength).toBeCloseTo(0.002, 6);
    expect(snapshot.report).toMatchObject({
      views: 1,
      proceduralSkies: 1,
      diagnostics: 0,
    });
    expect(snapshot.diagnostics).toEqual([]);
  });

  it("spawns keyed runtime uniforms from app systems", async () => {
    const refs: { uniform: Entity | null } = { uniform: null };

    class RuntimeUniformSetupSystem extends createSystem({ priority: 0 }) {
      override init(): void {
        refs.uniform = this.spawn.runtimeUniform({
          key: "entity.runtime-uniform",
          uniformKey: "water.params",
          values: { water: [0.2, 0.4, 0.8, 1] },
          version: 3,
        });
      }
    }

    const app = await createApertureApp({
      config: defineApertureConfig({ mode: "headless" }),
      systems: [{ default: RuntimeUniformSetupSystem }],
    });

    const snapshot = app.extract(14);

    expect(refs.uniform).not.toBeNull();
    expect(snapshot.runtimeUniforms).toHaveLength(1);
    expect(snapshot.runtimeUniforms?.[0]).toMatchObject({
      entity: {
        index: refs.uniform?.index,
        generation: refs.uniform?.generation,
      },
      key: "water.params",
      values: { water: [0.2, 0.4, 0.8, 1] },
      version: 3,
    });
    expect(snapshot.report).toMatchObject({
      runtimeUniforms: 1,
      diagnostics: 0,
    });
    expect(snapshot.diagnostics).toEqual([]);
  });
});
