import { expect, test } from "@playwright/test";

import type { ClearExampleStatus } from "./example-status-types.js";
import { colorChannelToByte, expectChannelClose } from "./png.js";
import { sampleCanvasCenterPresentation } from "./webgpu-presentation.js";
import {
  attachExampleStatus,
  skipIfUnsupportedWebGpu,
  waitForExampleStatus,
} from "./webgpu-status.js";

test("browser WebGPU clear example reports readiness and changes pixels", async ({
  page,
}) => {
  await page.goto("/");
  const status = await waitForExampleStatus<ClearExampleStatus>(page);

  await attachExampleStatus("webgpu-clear-status", status);

  expect(status, "example status should be published").toBeDefined();

  if (status === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(status);

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

  const presentation = await sampleCanvasCenterPresentation(
    page.locator("#aperture-canvas"),
  );
  await attachExampleStatus("webgpu-clear-presentation", presentation);
  test.skip(presentation.samplesCssBackground, presentation.diagnostic);
  const centerPixel = presentation.centerPixel;

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
