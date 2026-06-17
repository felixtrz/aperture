import { describe, expect, it } from "vitest";

import { createApertureApp } from "@aperture-engine/app";
import { asset, defineApertureConfig } from "@aperture-engine/app/config";
import { createSystem } from "@aperture-engine/app/systems";
import { VehicleResource } from "../../src/lib/vehicle-resource.js";
import ParticlesSystem from "../../src/systems/particles.system.js";

describe("racing smoke particles", () => {
  it("emits renderable smoke bursts when vehicle drift exceeds the reference threshold", async () => {
    const restoreImageDecoder = installFakeImageDecoder();

    class DriftSetupSystem extends createSystem({ priority: 0 }) {
      override init(): void {
        this.spawn.camera({
          key: "camera.particles",
          transform: { translation: [0, 4, 8], lookAt: [0, 0, 0] },
          camera: { frustumCulling: false },
        });
      }

      override update(): void {
        this.resources.write(VehicleResource, (vehicle) => {
          vehicle.ready = true;
          vehicle.container = [0, 0, 0];
          vehicle.driftIntensity = 0.8;
          vehicle.wheelBL = [-1, 0, 0];
          vehicle.wheelBR = [1, 0, 0];
        });
      }
    }

    try {
      const app = await createApertureApp({
        config: defineApertureConfig({
          mode: "headless",
          assets: {
            smoke: asset.texture("data:image/png;base64,AQIDBA==", {
              preload: "blocking",
              colorSpace: "srgb",
              mimeType: "image/png",
            }),
            "smoke-effect": asset.particleEffect({
              preload: "blocking",
              texture: "smoke",
              capacity: 1280,
              emissionRate: 0,
              lifetime: { min: 2.5, max: 2.5 },
              startSize: { min: 0.5, max: 1 },
              blendMode: "alpha",
            }),
          },
        }),
        systems: [{ default: DriftSetupSystem }, { default: ParticlesSystem }],
      });

      const snapshot = app.stepAndExtract(1 / 60, 0, 1);

      expect(snapshot.diagnostics).toEqual([]);
      expect(snapshot.report.particleEmitters).toBe(2);
      expect(
        snapshot.particleEmitters?.map((packet) => packet.burst?.count),
      ).toEqual([3, 3]);
      expect(app.context.particles.summary()).toMatchObject({
        active: 2,
        dropped: 0,
      });
    } finally {
      restoreImageDecoder();
    }
  });
});

function installFakeImageDecoder(): () => void {
  const globals = globalThis as unknown as Record<string, unknown>;
  const previousCreateImageBitmap = globals.createImageBitmap;
  const previousOffscreenCanvas = globals.OffscreenCanvas;
  const decodedPixels = new Uint8ClampedArray([255, 255, 255, 255]);

  class FakeOffscreenCanvas {
    constructor(
      readonly width: number,
      readonly height: number,
    ) {}

    getContext(type: string): unknown {
      expect(type).toBe("2d");
      return {
        drawImage: () => {},
        getImageData: () => ({ data: decodedPixels }),
      };
    }
  }

  globals.createImageBitmap = async (blob: Blob) => {
    expect(blob.type).toBe("image/png");
    return {
      width: 1,
      height: 1,
      close: () => {},
    };
  };
  globals.OffscreenCanvas = FakeOffscreenCanvas;

  return () => {
    if (previousCreateImageBitmap === undefined) {
      Reflect.deleteProperty(globals, "createImageBitmap");
    } else {
      globals.createImageBitmap = previousCreateImageBitmap;
    }

    if (previousOffscreenCanvas === undefined) {
      Reflect.deleteProperty(globals, "OffscreenCanvas");
    } else {
      globals.OffscreenCanvas = previousOffscreenCanvas;
    }
  };
}
