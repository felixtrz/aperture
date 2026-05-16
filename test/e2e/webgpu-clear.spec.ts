import { expect, test } from "@playwright/test";

import type { ClearExampleStatus } from "./example-status-types.js";
import { colorChannelToByte, expectChannelClose } from "./png.js";
import { sampleCanvasCenterPresentation } from "./webgpu-presentation.js";
import { attachExampleStatus, loadExampleStatus } from "./webgpu-status.js";

test("browser WebGPU clear example reports readiness and changes pixels", async ({
  page,
}) => {
  const status = await loadExampleStatus<ClearExampleStatus>(
    page,
    "/",
    "webgpu-clear-status",
  );

  if (status === undefined) {
    return;
  }

  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "webgpu-clear",
    ok: true,
    phase: "clear",
    renderingBackend: "webgpu-explicit",
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

  if (status.readback?.ok) {
    expectChannelClose(
      "readback red",
      status.readback.pixel.r,
      colorChannelToByte(status.clearColor.r),
    );
    expectChannelClose(
      "readback green",
      status.readback.pixel.g,
      colorChannelToByte(status.clearColor.g),
    );
    expectChannelClose(
      "readback blue",
      status.readback.pixel.b,
      colorChannelToByte(status.clearColor.b),
    );
    expectChannelClose(
      "readback alpha",
      status.readback.pixel.a,
      colorChannelToByte(status.clearColor.a),
    );
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
