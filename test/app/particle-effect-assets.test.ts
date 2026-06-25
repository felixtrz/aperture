import { describe, expect, it } from "vitest";

import { createApertureApp } from "@aperture-engine/app";
import { asset, defineApertureConfig } from "@aperture-engine/app/config";
import {
  assetHandleKey,
  createParticleEffectHandle,
  createTextureHandle,
} from "@aperture-engine/simulation";
import type { ParticleEffectAsset } from "@aperture-engine/render";

describe("app particle effect asset config", () => {
  it("preloads particle-effect source assets with texture dependencies", async () => {
    const app = await createApertureApp({
      config: defineApertureConfig({
        mode: "headless",
        assets: {
          smoke: asset.texture("https://example.test/smoke.png", {
            preload: "manual",
          }),
          smokeEffect: asset.particleEffect({
            preload: "blocking",
            label: "Smoke effect",
            main: {
              maxParticles: 1280,
              duration: 2.5,
              startLifetime: { min: 2.5, max: 2.5 },
              startSize: { min: 0.5, max: 1 },
            },
            emission: {
              rateOverTime: 0,
            },
            renderer: {
              texture: "smoke",
              blendMode: "alpha",
            },
            sizeOverLifetime: {
              enabled: true,
              size: {
                mode: "curve",
                curve: [
                  { t: 0, value: 0.5 },
                  { t: 1, value: 3 },
                ],
              },
            },
            colorOverLifetime: {
              enabled: true,
              color: {
                mode: "gradient",
                gradient: [
                  { t: 0, color: [0.37, 0.37, 0.42, 0.25] },
                  { t: 1, color: [0.37, 0.37, 0.42, 0] },
                ],
              },
            },
          }),
        },
      }),
    });

    const textureHandle = createTextureHandle("smoke");
    const handle = app.context.assets.particleEffect("smokeEffect");
    expect(handle.ready.value).toBe(true);
    expect(handle.renderHandle).toEqual(
      createParticleEffectHandle("smokeEffect"),
    );
    expect(handle.texture).toEqual(textureHandle);

    const entry = app.context.assetsRegistry.get<
      "particle-effect",
      ParticleEffectAsset
    >(handle.renderHandle);
    expect(entry?.status).toBe("ready");
    expect(entry?.asset?.kind).toBe("particle-effect");
    expect(entry?.asset?.label).toBe("Smoke effect");
    expect(entry?.asset?.renderer.texture).toEqual(textureHandle);
    expect(entry?.asset?.runtime.texture).toEqual(textureHandle);
    expect(entry?.asset?.runtime.capacity).toBe(1280);
    expect(entry?.asset?.runtime.blendMode).toBe("alpha");
    expect(entry?.dependencies.map(assetHandleKey)).toEqual(["texture:smoke"]);
  });
});
