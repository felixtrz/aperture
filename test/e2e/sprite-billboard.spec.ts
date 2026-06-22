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

interface SpriteBillboardStatus extends ExampleStatusBase {
  readonly sprite?: {
    readonly textureKey: string;
    readonly samplerKey: string;
    readonly expectedDominantChannels: Record<string, string>;
    readonly proofs?: readonly unknown[];
  };
  readonly frames?: readonly SpriteBillboardFrameStatus[];
}

interface SpriteBillboardFrameStatus {
  readonly camera: "front" | "orbit";
  readonly snapshot?: {
    readonly views: number;
    readonly meshDraws: number;
    readonly spriteDraws: number;
    readonly quadInstances: number;
    readonly quadBatches: number;
    readonly diagnostics: number;
  };
  readonly counts?: {
    readonly spriteDraws: number;
    readonly quadInstances: number;
    readonly quadBatches: number;
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

test("browser renders ECS sprites as camera-facing billboards", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto("/examples/sprite-billboard.html");

  const status = await waitForExampleStatus<SpriteBillboardStatus>(page);

  await attachExampleStatus("sprite-billboard-status", status);
  expect(status, "sprite billboard status should publish").toBeDefined();

  if (status === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(status);
  expectStatusJsonSafeForGpu(status);
  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "sprite-billboard",
    ok: true,
    phase: "submit",
    renderingBackend: "webgpu-explicit",
    sprite: {
      textureKey: "texture:sprite-billboard-quadrants",
      samplerKey: "sampler:sprite-billboard-nearest",
    },
  });

  const front = frameStatus(status, "front");
  const orbit = frameStatus(status, "orbit");

  expect(front, JSON.stringify(status, null, 2)).toMatchObject({
    snapshot: {
      views: 1,
      meshDraws: 0,
      spriteDraws: 5,
      quadInstances: 5,
      quadBatches: 5,
      diagnostics: 0,
    },
    counts: {
      spriteDraws: 5,
      quadInstances: 5,
      quadBatches: 5,
      drawCalls: 5,
      diagnostics: 0,
    },
  });
  expect(orbit, JSON.stringify(status, null, 2)).toMatchObject({
    snapshot: {
      views: 1,
      meshDraws: 0,
      spriteDraws: 5,
      quadInstances: 5,
      quadBatches: 5,
      diagnostics: 0,
    },
    counts: {
      spriteDraws: 5,
      quadInstances: 5,
      quadBatches: 5,
      drawCalls: 5,
      diagnostics: 0,
    },
  });
  expect(status.sprite?.proofs).toHaveLength(5);

  if (front.readback?.ok !== true || orbit.readback?.ok !== true) {
    test.skip(
      true,
      `Sprite billboard pixel assertion requires readback: ${
        front.readback?.reason ?? orbit.readback?.reason ?? "unknown"
      }`,
    );
  }

  assertCentralAtlasSamples(front);
  assertCentralAtlasSamples(orbit);
  assertQuadFeatureSamples(front);
  assertStableSamples(front, orbit);
  webGpuValidation.expectNoWarnings();
});

function frameStatus(
  status: SpriteBillboardStatus,
  camera: "front" | "orbit",
): SpriteBillboardFrameStatus {
  const frame = status.frames?.find((entry) => entry.camera === camera);

  expect(frame, JSON.stringify(status, null, 2)).toBeDefined();

  return frame as SpriteBillboardFrameStatus;
}

function assertCentralAtlasSamples(frame: SpriteBillboardFrameStatus): void {
  const clear = rgbaColorToPixel({ r: 0.012, g: 0.018, b: 0.026, a: 1 });
  const samples = frame.readback?.samples ?? [];
  const upperLeft = requiredSample(samples, "upper-left");
  const upperRight = requiredSample(samples, "upper-right");
  const lowerLeft = requiredSample(samples, "lower-left");
  const lowerRight = requiredSample(samples, "lower-right");

  for (const sample of [upperLeft, upperRight, lowerLeft, lowerRight]) {
    expect(pixelDistance(sample.pixel, clear)).toBeGreaterThan(45);
  }

  // AI-17: the sprite family sRGB-encodes in-shader on the LDR path, which
  // lifts secondary channels more than saturated ones and compresses the
  // dominant-vs-secondary separation (observed margin shrank from ~100 to
  // ~79). 60 still proves the quadrant's channel is clearly dominant.
  expect(upperLeft.pixel.r).toBeGreaterThan(upperLeft.pixel.g + 60);
  expect(upperLeft.pixel.r).toBeGreaterThan(upperLeft.pixel.b + 60);
  expect(upperRight.pixel.g).toBeGreaterThan(upperRight.pixel.r + 60);
  expect(upperRight.pixel.g).toBeGreaterThan(upperRight.pixel.b + 60);
  expect(lowerLeft.pixel.b).toBeGreaterThan(lowerLeft.pixel.r + 60);
  expect(lowerLeft.pixel.b).toBeGreaterThan(lowerLeft.pixel.g + 60);
  expect(lowerRight.pixel.r).toBeGreaterThan(lowerRight.pixel.b + 60);
  expect(lowerRight.pixel.g).toBeGreaterThan(lowerRight.pixel.b + 60);
}

function assertQuadFeatureSamples(frame: SpriteBillboardFrameStatus): void {
  const clear = rgbaColorToPixel({ r: 0.012, g: 0.018, b: 0.026, a: 1 });
  const samples = frame.readback?.samples ?? [];
  const uvBlue = requiredSample(samples, "uv-blue-center");
  const rotationPivot = requiredSample(samples, "rotation-pivot-green");
  const screenSized = requiredSample(samples, "screen-size-yellow");
  const screenOutside = requiredSample(samples, "screen-size-clear");
  const cylindrical = requiredSample(samples, "cylindrical-red");

  // AI-17: sRGB encode compresses dominant-vs-secondary channel separation
  // (see assertCentralAtlasSamples); 60 still proves clear dominance.
  expect(uvBlue.pixel.b).toBeGreaterThan(uvBlue.pixel.r + 60);
  expect(uvBlue.pixel.b).toBeGreaterThan(uvBlue.pixel.g + 60);
  expect(rotationPivot.pixel.g).toBeGreaterThan(rotationPivot.pixel.r + 60);
  expect(rotationPivot.pixel.g).toBeGreaterThan(rotationPivot.pixel.b + 60);
  expect(screenSized.pixel.r).toBeGreaterThan(screenSized.pixel.b + 60);
  expect(screenSized.pixel.g).toBeGreaterThan(screenSized.pixel.b + 60);
  expect(pixelDistance(screenOutside.pixel, clear)).toBeLessThan(35);
  expect(cylindrical.pixel.r).toBeGreaterThan(cylindrical.pixel.g + 60);
  expect(cylindrical.pixel.r).toBeGreaterThan(cylindrical.pixel.b + 60);
}

function assertStableSamples(
  front: SpriteBillboardFrameStatus,
  orbit: SpriteBillboardFrameStatus,
): void {
  const frontSamples = front.readback?.samples ?? [];
  const orbitSamples = orbit.readback?.samples ?? [];

  for (const id of ["upper-left", "upper-right", "lower-left", "lower-right"]) {
    const before = requiredSample(frontSamples, id);
    const after = requiredSample(orbitSamples, id);

    expect(
      pixelDistance(before.pixel, after.pixel),
      `expected '${id}' to remain stable after camera orbit`,
    ).toBeLessThan(90);
  }
}

function requiredSample(
  samples: NonNullable<
    NonNullable<SpriteBillboardFrameStatus["readback"]>["samples"]
  >,
  id: string,
): NonNullable<
  NonNullable<SpriteBillboardFrameStatus["readback"]>["samples"]
>[number] {
  const sample = samples.find((entry) => entry.id === id);

  expect(sample, `missing readback sample '${id}'`).toBeDefined();

  return sample as NonNullable<
    NonNullable<SpriteBillboardFrameStatus["readback"]>["samples"]
  >[number];
}
