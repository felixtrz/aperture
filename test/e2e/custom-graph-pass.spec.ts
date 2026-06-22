import { expect, test } from "@playwright/test";

import { readPngImage, type PngImage } from "./png.js";
import {
  attachExampleStatus,
  attachWebGpuValidationConsoleGuard,
  expectStatusJsonSafeForGpu,
  skipIfUnsupportedWebGpu,
  waitForExampleStatus,
} from "./webgpu-status.js";
import type { ExampleStatusBase } from "./example-status-types.js";

interface CustomGraphPassStatus extends ExampleStatusBase {
  readonly graph?: {
    readonly order: readonly string[];
    readonly userPasses: readonly {
      readonly name: string;
      readonly kind: "render" | "compute";
      readonly ran: boolean;
      readonly executedCommands: number;
    }[];
  };
  readonly histogram?: {
    readonly bins: readonly number[];
    readonly sum: number;
  };
}

// M3-T7 Done-when #1 + #2: a user depth-tested render overlay inserted AFTER
// 'opaque' draws over the scene (overlay pixels where expected, scene elsewhere)
// and a user compute pass reads scene-color + writes a histogram buffer in-frame
// — both run through the single-encoder graph post path and are reported in
// status.graph.order (the custom nodes between the scene node and the present
// post node), with the compute's executedCommands > 0.
test("browser runs custom render + compute graph passes (addRenderPass/addComputePass)", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.setViewportSize({ width: 1024, height: 720 });
  await page.goto("/examples/custom-graph-pass.html");

  const status = await waitForExampleStatus<CustomGraphPassStatus>(page);
  await attachExampleStatus("custom-graph-pass-status", status);
  expect(status, "status should publish").toBeDefined();

  if (status === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(status);
  expectStatusJsonSafeForGpu(status);
  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "custom-graph-pass",
    ok: true,
    phase: "submit",
    renderingBackend: "webgpu-explicit",
  });

  // Done-when #2: the compute node ran in-frame.
  const compute = status.graph?.userPasses.find(
    (pass) => pass.name === "luminance-histogram",
  );
  expect(compute?.kind).toBe("compute");
  expect(compute?.ran).toBe(true);
  expect(compute?.executedCommands ?? 0).toBeGreaterThan(0);
  expect(status.histogram?.sum ?? 0).toBeGreaterThan(0);

  // Done-when #1 (ordering): the custom nodes appear between the scene ('opaque')
  // node and the first post ('present') node.
  const order = status.graph?.order ?? [];
  const sceneIndex = order.findIndex((name) => name.endsWith(":scene"));
  const overlayIndex = order.indexOf("wireframe-overlay");
  const presentIndex = order.findIndex((name) => name.includes(":present"));
  expect(sceneIndex).toBeGreaterThanOrEqual(0);
  expect(overlayIndex).toBeGreaterThan(sceneIndex);
  expect(presentIndex).toBeGreaterThan(overlayIndex);

  await page.waitForTimeout(100);
  const screenshot = await page
    .locator("#custom-graph-pass-canvas")
    .screenshot();
  const image = readPngImage(screenshot);
  await test.info().attach("custom-graph-pass-canvas", {
    body: screenshot,
    contentType: "image/png",
  });

  expect(image.width).toBe(512);
  expect(image.height).toBe(512);

  // Done-when #1 (pixels): the magenta overlay (high R + high B, low G) is drawn
  // over the scene, and the scene (the yellow unlit cube: high R + high G, low B)
  // is visible elsewhere. Count both across the frame so the proof is robust to
  // exact placement (the overlay is depth-tested, so it draws over background +
  // wherever it is in front, and the cube shows through where it is not).
  const counts = countSignatureColors(image);
  await test.info().attach("custom-graph-pass-pixels", {
    body: JSON.stringify(counts, null, 2),
    contentType: "application/json",
  });

  // a substantial magenta overlay region is present...
  expect(
    counts.magenta,
    `magenta overlay pixels ${JSON.stringify(counts)}`,
  ).toBeGreaterThan(2000);
  // ...and a substantial yellow scene (cube) region is present.
  expect(
    counts.yellow,
    `yellow scene pixels ${JSON.stringify(counts)}`,
  ).toBeGreaterThan(2000);

  await page.evaluate(() => {
    const stop = (
      globalThis as typeof globalThis & {
        readonly __APERTURE_CUSTOM_GRAPH_PASS_STOP__?: () => void;
      }
    ).__APERTURE_CUSTOM_GRAPH_PASS_STOP__;
    stop?.();
  });
  webGpuValidation.expectNoWarnings();
  await page.close({ runBeforeUnload: false });
});

function countSignatureColors(image: PngImage): {
  readonly magenta: number;
  readonly yellow: number;
} {
  let magenta = 0;
  let yellow = 0;
  for (
    let offset = 0;
    offset + 2 < image.pixels.length;
    offset += image.bytesPerPixel
  ) {
    const r = image.pixels[offset] ?? 0;
    const g = image.pixels[offset + 1] ?? 0;
    const b = image.pixels[offset + 2] ?? 0;
    // magenta overlay: strong red + blue, weak green
    if (r > 150 && b > 150 && g < 110) {
      magenta += 1;
    }
    // yellow unlit cube: strong red + green, weak blue
    if (r > 150 && g > 120 && b < 120) {
      yellow += 1;
    }
  }
  return { magenta, yellow };
}
