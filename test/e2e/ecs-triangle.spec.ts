import { expect, test } from "@playwright/test";

import {
  pixelDistance,
  readPngPixel,
  rgbaColorToPixel,
  type RgbaColor,
} from "./png.js";

interface TriangleStatus {
  readonly example: string;
  readonly ok: boolean;
  readonly phase?: string;
  readonly reason?: string;
  readonly message?: string;
  readonly renderingBackend?: string;
  readonly clearColor?: RgbaColor;
  readonly extraction?: {
    readonly views: number;
    readonly meshDraws: number;
    readonly diagnostics: number;
  };
  readonly binding?: {
    readonly planned: number;
    readonly applied: number;
    readonly diagnostics: number;
  };
  readonly renderWorld?: {
    readonly active: number;
    readonly ready: number;
    readonly blocked: number;
  };
  readonly draw?: {
    readonly packages: number;
    readonly descriptors: number;
    readonly drawList: number;
    readonly resolved: number;
  };
  readonly command?: {
    readonly commands: number;
    readonly drawCount: number;
    readonly indexedDrawCount: number;
  };
  readonly submission?: {
    readonly commandBuffers: number;
    readonly drawCalls: number;
    readonly indexedDrawCalls: number;
  };
}

type ExampleGlobal = typeof globalThis & {
  readonly __APERTURE_EXAMPLE_STATUS__?: TriangleStatus;
};

const unsupportedWebGpuReasons = new Set<string>([
  "navigator-gpu-unavailable",
  "adapter-unavailable",
  "device-request-failed",
  "context-unavailable",
  "device-lost",
]);

test("ECS triangle example extracts, submits, and renders non-background pixels", async ({
  page,
}) => {
  await page.goto("/examples/triangle.html");
  await page.waitForFunction(
    () =>
      (globalThis as ExampleGlobal).__APERTURE_EXAMPLE_STATUS__ !== undefined,
  );

  const status = await page.evaluate(
    () => (globalThis as ExampleGlobal).__APERTURE_EXAMPLE_STATUS__,
  );

  expect(status, "example status should be published").toBeDefined();

  if (status === undefined) {
    return;
  }

  if (
    !status.ok &&
    status.reason !== undefined &&
    unsupportedWebGpuReasons.has(status.reason)
  ) {
    test.skip(
      true,
      `WebGPU unsupported in this browser: ${status.reason} - ${
        status.message ?? "no message"
      }`,
    );
    return;
  }

  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "ecs-triangle",
    ok: true,
    phase: "submit",
    renderingBackend: "webgpu",
    extraction: { views: 1, meshDraws: 1, diagnostics: 0 },
    binding: { planned: 1, applied: 1, diagnostics: 0 },
    renderWorld: { active: 1, ready: 1, blocked: 0 },
    draw: { packages: 1, descriptors: 1, drawList: 1, resolved: 1 },
    command: { drawCount: 1, indexedDrawCount: 1 },
    submission: { commandBuffers: 1, drawCalls: 1, indexedDrawCalls: 1 },
  });
  expect(
    status.command?.commands,
    JSON.stringify(status, null, 2),
  ).toBeGreaterThan(0);
  expect(status.clearColor, JSON.stringify(status, null, 2)).toBeDefined();

  if (status.clearColor === undefined) {
    return;
  }

  const canvasScreenshot = await page.locator("#aperture-canvas").screenshot();
  const centerPixel = readPngPixel(canvasScreenshot, 0.5, 0.5);
  const clearPixel = rgbaColorToPixel(status.clearColor);

  expect(
    pixelDistance(centerPixel, clearPixel),
    `center pixel should differ from clear color; status=${JSON.stringify(
      status,
      null,
      2,
    )}`,
  ).toBeGreaterThan(40);
});
