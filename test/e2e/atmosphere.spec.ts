import { expect, test } from "@playwright/test";

import { pixelDistance, rgbaColorToPixel } from "./png.js";
import {
  attachExampleStatus,
  attachWebGpuValidationConsoleGuard,
  expectStatusJsonSafeForGpu,
  skipIfUnsupportedWebGpu,
  waitForExampleStatus,
} from "./webgpu-status.js";
import type { ExampleStatusBase } from "./example-status-types.js";

interface AtmosphereStatus extends ExampleStatusBase {
  readonly atmosphere?: {
    readonly fogColor: readonly [number, number, number, number];
    readonly skyboxTextureKey: string;
    readonly skyboxSamplerKey: string;
    readonly spriteTextureKey: string;
    readonly spriteSamplerKey: string;
    readonly markerMeshKey: string;
    readonly markerMaterialKey: string;
  };
  readonly frame?: AtmosphereFrameStatus;
}

interface AtmosphereFrameStatus {
  readonly snapshot?: {
    readonly views: number;
    readonly meshDraws: number;
    readonly spriteDraws: number;
    readonly skyboxes: number;
    readonly fogs: number;
    readonly diagnostics: number;
  };
  readonly counts?: {
    readonly meshDraws: number;
    readonly spriteDraws: number;
    readonly skyboxes: number;
    readonly fogs: number;
    readonly drawCalls: number;
    readonly diagnostics: number;
  };
  readonly readback?: {
    readonly ok: boolean;
    readonly reason?: string;
    readonly message?: string;
    readonly samples?: readonly {
      readonly id: string;
      readonly pixel: {
        readonly r: number;
        readonly g: number;
        readonly b: number;
        readonly a: number;
      };
    }[];
  };
}

test("browser renders skybox, fog, and sprite billboards in one square scene", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto("/examples/atmosphere.html");

  const status = await waitForExampleStatus<AtmosphereStatus>(page);

  await attachExampleStatus("atmosphere-status", status);
  expect(status, "atmosphere status should publish").toBeDefined();

  if (status === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(status);
  expectStatusJsonSafeForGpu(status);
  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "atmosphere",
    ok: true,
    phase: "submit",
    renderingBackend: "webgpu-explicit",
    canvas: {
      width: 960,
      height: 960,
    },
    atmosphere: {
      fogColor: [0.46, 0.62, 0.82, 1],
      skyboxTextureKey: "texture:atmosphere-skybox-cube",
      skyboxSamplerKey: "sampler:atmosphere-skybox-linear",
      spriteTextureKey: "texture:atmosphere-marker-quadrants",
      spriteSamplerKey: "sampler:atmosphere-marker-nearest",
      markerMeshKey: "mesh:atmosphere-marker-cube-mesh",
      markerMaterialKey: "material:atmosphere-marker-standard-material",
    },
    frame: {
      snapshot: {
        views: 1,
        meshDraws: 2,
        spriteDraws: 1,
        skyboxes: 1,
        fogs: 1,
        diagnostics: 0,
      },
      counts: {
        meshDraws: 2,
        spriteDraws: 1,
        skyboxes: 1,
        fogs: 1,
        diagnostics: 0,
      },
    },
  });

  const frame = status.frame;

  expect(frame, JSON.stringify(status, null, 2)).toBeDefined();

  if (frame === undefined) {
    return;
  }

  expect(frame.counts?.drawCalls).toBeGreaterThanOrEqual(3);

  if (frame.readback?.ok !== true) {
    test.skip(
      true,
      `Atmosphere pixel assertion requires readback: ${
        frame.readback?.reason ?? "unknown"
      }`,
    );
  }

  assertAtmosphereSamples(frame);
  webGpuValidation.expectNoWarnings();
});

function assertAtmosphereSamples(frame: AtmosphereFrameStatus): void {
  const clear = rgbaColorToPixel({ r: 0.014, g: 0.018, b: 0.026, a: 1 });
  const expectedFog = rgbaColorToPixel({ r: 0.46, g: 0.62, b: 0.82, a: 1 });
  const samples = frame.readback?.samples ?? [];
  const skyUpperLeft = requiredSample(samples, "sky-upper-left");
  const skyUpperRight = requiredSample(samples, "sky-upper-right");
  const spriteUpperLeft = requiredSample(samples, "sprite-upper-left");
  const spriteUpperRight = requiredSample(samples, "sprite-upper-right");
  const spriteLowerLeft = requiredSample(samples, "sprite-lower-left");
  const spriteLowerRight = requiredSample(samples, "sprite-lower-right");
  const nearCube = requiredSample(samples, "near-cube");
  const farCube = requiredSample(samples, "far-cube");

  for (const sky of [skyUpperLeft, skyUpperRight]) {
    expect(pixelDistance(sky.pixel, clear)).toBeGreaterThan(45);
    expect(sky.pixel.b).toBeGreaterThan(120);
    expect(sky.pixel.g).toBeGreaterThan(70);
  }

  expect(spriteUpperLeft.pixel.r).toBeGreaterThan(spriteUpperLeft.pixel.g + 80);
  expect(spriteUpperLeft.pixel.r).toBeGreaterThan(spriteUpperLeft.pixel.b + 80);
  expect(spriteUpperRight.pixel.g).toBeGreaterThan(
    spriteUpperRight.pixel.r + 80,
  );
  expect(spriteUpperRight.pixel.g).toBeGreaterThan(
    spriteUpperRight.pixel.b + 80,
  );
  expect(spriteLowerLeft.pixel.b).toBeGreaterThan(spriteLowerLeft.pixel.r + 80);
  expect(spriteLowerLeft.pixel.b).toBeGreaterThan(spriteLowerLeft.pixel.g + 80);
  expect(spriteLowerRight.pixel.r).toBeGreaterThan(
    spriteLowerRight.pixel.b + 80,
  );
  expect(spriteLowerRight.pixel.g).toBeGreaterThan(
    spriteLowerRight.pixel.b + 80,
  );

  expect(pixelDistance(farCube.pixel, expectedFog)).toBeLessThan(
    pixelDistance(nearCube.pixel, expectedFog),
  );
  expect(farCube.pixel.b).toBeGreaterThan(nearCube.pixel.b + 12);
  expect(nearCube.pixel.r).toBeGreaterThan(farCube.pixel.r + 12);
}

function requiredSample(
  samples: NonNullable<
    NonNullable<AtmosphereFrameStatus["readback"]>["samples"]
  >,
  id: string,
): NonNullable<
  NonNullable<AtmosphereFrameStatus["readback"]>["samples"]
>[number] {
  const sample = samples.find((entry) => entry.id === id);

  expect(sample, `missing readback sample '${id}'`).toBeDefined();

  return sample as NonNullable<
    NonNullable<AtmosphereFrameStatus["readback"]>["samples"]
  >[number];
}
