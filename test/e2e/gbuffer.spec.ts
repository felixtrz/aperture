import { expect, test } from "@playwright/test";

import { readPngImage, readPngImagePixel } from "./png.js";
import {
  attachExampleStatus,
  attachWebGpuValidationConsoleGuard,
  expectStatusJsonSafeForGpu,
  skipIfUnsupportedWebGpu,
  waitForExampleStatus,
  waitForPresentedFrames,
} from "./webgpu-status.js";
import type { ExampleStatusBase } from "./example-status-types.js";

interface GBufferStatus extends ExampleStatusBase {
  readonly graph?: {
    readonly order: readonly string[];
    readonly userPasses: readonly {
      readonly name: string;
      readonly kind: "render" | "compute";
      readonly ran: boolean;
      readonly executedCommands: number;
    }[];
  };
  readonly renderTargets?: readonly {
    readonly renderTargetKey: string | null;
    readonly source: string;
    readonly ok: boolean;
    readonly drawCalls: number;
  }[];
  readonly samplePoints?: readonly {
    readonly id: string;
    readonly x: number;
    readonly y: number;
  }[];
  readonly encodeSkips?: number;
  readonly frames?: number;
}

// B3 (three.js parity plan, advanced-audit scenarios #11/#12): a custom
// G-buffer. ONE custom WGSL material declares THREE color targets
// (colorTargets — MRT): albedo into the camera-paired facade render target
// at @location(0), world normal and a quantized object-ID band into two more
// facade targets at @location(1..2). A user render pass (app.addRenderPass)
// reads all three targets and resolves them into scene color as three
// vertical bands, ordered after the G-buffer camera node inside the
// single-encoder forward FrameGraph.
test("browser renders a custom G-buffer (MRT material) resolved by a user pass into scene color", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.setViewportSize({ width: 1024, height: 720 });
  await page.goto("/examples/gbuffer.html");

  const status = await waitForExampleStatus<GBufferStatus>(page);
  await attachExampleStatus("gbuffer-status", status);
  expect(status, "status should publish").toBeDefined();

  if (status === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(status);
  expectStatusJsonSafeForGpu(status);
  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "gbuffer",
    ok: true,
    phase: "submit",
    renderingBackend: "webgpu-explicit",
    encodeSkips: 0,
  });

  // Graph-pass counts: the G-buffer camera node, the swapchain node, and the
  // resolve user pass — exactly three nodes, with the resolve ordered AFTER
  // the G-buffer camera node (read-after-write on the MRT target handles).
  const order = status.graph?.order ?? [];
  expect(order).toHaveLength(3);
  const gbufferIndex = order.findIndex((name) =>
    name.includes("render-target:gbuffer.albedo"),
  );
  const resolveIndex = order.indexOf("gbuffer-resolve");
  expect(gbufferIndex).toBeGreaterThanOrEqual(0);
  expect(resolveIndex).toBeGreaterThan(gbufferIndex);

  const resolvePass = status.graph?.userPasses.find(
    (pass) => pass.name === "gbuffer-resolve",
  );
  expect(resolvePass?.kind).toBe("render");
  expect(resolvePass?.ran).toBe(true);
  expect(resolvePass?.executedCommands ?? 0).toBeGreaterThan(0);

  // Both targets submitted OK: the offscreen G-buffer pass (the three boxes
  // batch into one instanced draw) and the swapchain pass the resolve draws
  // over.
  const targets = status.renderTargets ?? [];
  expect(targets).toHaveLength(2);
  const gbufferTarget = targets.find(
    (target) => target.renderTargetKey === "render-target:gbuffer.albedo",
  );
  const swapchainTarget = targets.find(
    (target) => target.source === "swapchain",
  );
  expect(gbufferTarget?.ok).toBe(true);
  expect(gbufferTarget?.drawCalls).toBeGreaterThan(0);
  expect(swapchainTarget?.ok).toBe(true);

  // Pixel assertions (canvas screenshot at the published sample points): the
  // three resolve bands carry the three G-buffer channels.
  await waitForPresentedFrames(page);
  const screenshot = await page.locator("#gbuffer-canvas").screenshot();
  await test.info().attach("gbuffer-canvas", {
    body: screenshot,
    contentType: "image/png",
  });
  const image = readPngImage(screenshot);
  const samplePoints = status.samplePoints ?? [];
  expect(samplePoints).toHaveLength(5);
  const pixels = new Map(
    samplePoints.map((point) => [
      point.id,
      readPngImagePixel(image, point.x, point.y),
    ]),
  );
  await test.info().attach("gbuffer-pixels", {
    body: JSON.stringify([...pixels.entries()], null, 2),
    contentType: "application/json",
  });

  // albedo band center: the middle box's orange albedo (0.9, 0.45, 0.1)
  const albedo = pixels.get("albedo-center");
  expect(albedo?.r ?? 0).toBeGreaterThan(200);
  expect(albedo?.g ?? 0).toBeGreaterThan(80);
  expect(albedo?.g ?? 255).toBeLessThan(160);
  expect(albedo?.b ?? 255).toBeLessThan(60);

  // normal band center: the middle box's +Z face encodes to (0.5, 0.5, 1)
  const normal = pixels.get("normal-center");
  expect(Math.abs((normal?.r ?? 0) - 128)).toBeLessThanOrEqual(8);
  expect(Math.abs((normal?.g ?? 0) - 128)).toBeLessThanOrEqual(8);
  expect(normal?.b ?? 0).toBeGreaterThan(240);

  // id band: quantized world-x bands — left box red, middle green, right blue
  const idLeft = pixels.get("id-left");
  expect(idLeft?.r ?? 0).toBeGreaterThan(200);
  expect(idLeft?.g ?? 255).toBeLessThan(50);
  expect(idLeft?.b ?? 255).toBeLessThan(50);

  const idCenter = pixels.get("id-center");
  expect(idCenter?.g ?? 0).toBeGreaterThan(200);
  expect(idCenter?.r ?? 255).toBeLessThan(50);
  expect(idCenter?.b ?? 255).toBeLessThan(50);

  const idRight = pixels.get("id-right");
  expect(idRight?.b ?? 0).toBeGreaterThan(200);
  expect(idRight?.r ?? 255).toBeLessThan(50);
  expect(idRight?.g ?? 255).toBeLessThan(50);

  await page.evaluate(() => {
    const stop = (
      globalThis as typeof globalThis & {
        readonly __APERTURE_GBUFFER_STOP__?: () => void;
      }
    ).__APERTURE_GBUFFER_STOP__;
    stop?.();
  });
  webGpuValidation.expectNoWarnings();
  await page.close({ runBeforeUnload: false });
});
