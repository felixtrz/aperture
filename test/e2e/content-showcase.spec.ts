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

interface EntityRef {
  readonly index: number;
  readonly generation: number;
}

interface ContentShowcaseStatus extends ExampleStatusBase {
  readonly content?: {
    readonly expected: {
      readonly meshDraws: number;
      readonly spriteDraws: number;
      readonly uiNodes: number;
      readonly uiHitRegions: number;
      readonly textGlyphs: number;
      readonly textBatches: number;
      readonly particleEmitters: number;
      readonly liveParticles: number;
    };
  };
  readonly worker?: {
    readonly scene?: {
      readonly blockedDraw?: EntityRef;
      readonly uiTarget?: EntityRef;
    };
  };
  readonly frame?: {
    readonly counts?: {
      readonly meshDraws: number;
      readonly spriteDraws: number;
      readonly quadInstances: number;
      readonly quadBatches: number;
      readonly uiNodes: number;
      readonly uiHitRegions: number;
      readonly particleEmitters: number;
      readonly diagnostics: number;
    };
    readonly particles?: {
      readonly liveParticles: number;
      readonly dispatches: number;
    };
    readonly interaction?: {
      readonly target: EntityRef | null;
      readonly blocksInput: boolean;
      readonly blockedDraw: EntityRef | null;
      readonly blocks3dPick: boolean;
    };
    readonly readback?: {
      readonly ok: boolean;
      readonly reason?: string;
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
  };
}

test("browser route combines sprites, text, UI, interaction, and particles", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto("/examples/content-showcase.html");

  const status = await waitForExampleStatus<ContentShowcaseStatus>(page);

  await attachExampleStatus("content-showcase-status", status);
  expect(status, "content showcase status should publish").toBeDefined();

  if (status === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(status);
  expectStatusJsonSafeForGpu(status);
  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "content-showcase",
    ok: true,
    phase: "submit",
    renderingBackend: "webgpu-explicit",
    content: {
      expected: {
        meshDraws: 1,
        spriteDraws: 2,
        uiNodes: 4,
        uiHitRegions: 1,
        textGlyphs: 6,
        textBatches: 2,
        particleEmitters: 1,
        liveParticles: 384,
      },
    },
    frame: {
      counts: {
        meshDraws: 1,
        spriteDraws: 2,
        quadInstances: 6,
        quadBatches: 2,
        uiNodes: 4,
        uiHitRegions: 1,
        particleEmitters: 1,
        diagnostics: 0,
      },
      particles: {
        liveParticles: 384,
        dispatches: 1,
      },
      interaction: {
        blocksInput: true,
        blocks3dPick: true,
      },
    },
  });
  expect(status.frame?.interaction?.target).toEqual(
    status.worker?.scene?.uiTarget,
  );
  expect(status.frame?.interaction?.blockedDraw).toEqual(
    status.worker?.scene?.blockedDraw,
  );

  const readback = status.frame?.readback;

  if (readback?.ok !== true) {
    test.skip(
      true,
      `Content showcase pixel assertion requires readback: ${readback?.reason ?? "unknown"}`,
    );
  }

  webGpuValidation.expectNoWarnings();
  assertContentPixels(status);
});

function assertContentPixels(status: ContentShowcaseStatus): void {
  const clear = rgbaColorToPixel({ r: 0.012, g: 0.016, b: 0.028, a: 1 });
  const samples = status.frame?.readback?.samples ?? [];
  const sprite = requiredSample(samples, "sprite-atlas");
  const text = requiredSample(samples, "msdf-text");
  const particle = requiredSample(samples, "particle-center");
  const panel = requiredSample(samples, "ui-panel");
  const uiText = requiredSample(samples, "ui-text");
  const background = requiredSample(samples, "background");

  expect(pixelDistance(background.pixel, clear)).toBeLessThan(35);
  expect(pixelDistance(sprite.pixel, clear)).toBeGreaterThan(45);
  expect(
    Math.max(sprite.pixel.r, sprite.pixel.g, sprite.pixel.b),
  ).toBeGreaterThan(140);
  expect(pixelDistance(text.pixel, clear)).toBeGreaterThan(45);
  expect(pixelDistance(particle.pixel, clear)).toBeGreaterThan(45);
  expect(pixelDistance(panel.pixel, clear)).toBeGreaterThan(25);
  expect(uiText.pixel.r).toBeGreaterThan(150);
  expect(uiText.pixel.g).toBeGreaterThan(150);
  expect(uiText.pixel.b).toBeGreaterThan(150);
}

function requiredSample(
  samples: NonNullable<
    NonNullable<ContentShowcaseStatus["frame"]>["readback"]
  >["samples"],
  id: string,
): NonNullable<
  NonNullable<
    NonNullable<ContentShowcaseStatus["frame"]>["readback"]
  >["samples"]
>[number] {
  const sample = samples?.find((entry) => entry.id === id);

  expect(sample, `missing readback sample '${id}'`).toBeDefined();

  return sample as NonNullable<
    NonNullable<
      NonNullable<ContentShowcaseStatus["frame"]>["readback"]
    >["samples"]
  >[number];
}
