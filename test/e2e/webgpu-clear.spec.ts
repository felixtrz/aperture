import { expect, test } from "@playwright/test";

import { colorChannelToByte, expectChannelClose, readPngPixel } from "./png.js";

interface ExampleStatus {
  readonly example: string;
  readonly ok: boolean;
  readonly phase?: string;
  readonly reason?: string;
  readonly message?: string;
  readonly renderingBackend?: string;
  readonly format?: string;
  readonly clearColor?: ClearColor;
}

interface ClearColor {
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly a: number;
}

type ExampleGlobal = typeof globalThis & {
  readonly __APERTURE_EXAMPLE_STATUS__?: ExampleStatus;
};

const unsupportedWebGpuReasons = new Set<string>([
  "navigator-gpu-unavailable",
  "adapter-unavailable",
  "device-request-failed",
  "context-unavailable",
  "device-lost",
]);

test("browser WebGPU clear example reports readiness and changes pixels", async ({
  page,
}) => {
  await page.goto("/");
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
    example: "webgpu-clear",
    ok: true,
    phase: "clear",
    renderingBackend: "webgpu",
  });
  expect(status.clearColor, JSON.stringify(status, null, 2)).toEqual({
    r: 0.08,
    g: 0.28,
    b: 0.64,
    a: 1,
  });

  if (status.clearColor === undefined) {
    return;
  }

  const canvasScreenshot = await page.locator("#aperture-canvas").screenshot();
  const centerPixel = readPngPixel(canvasScreenshot, 0.5, 0.5);

  expectChannelClose(
    "red",
    centerPixel.r,
    colorChannelToByte(status.clearColor.r),
  );
  expectChannelClose(
    "green",
    centerPixel.g,
    colorChannelToByte(status.clearColor.g),
  );
  expectChannelClose(
    "blue",
    centerPixel.b,
    colorChannelToByte(status.clearColor.b),
  );
  expectChannelClose(
    "alpha",
    centerPixel.a,
    colorChannelToByte(status.clearColor.a),
  );
});
