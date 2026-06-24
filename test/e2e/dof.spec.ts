import { expect, test, type Page } from "@playwright/test";

import { readPngImage } from "./png.js";
import { startBrowser } from "./render-control/controller.js";
import {
  attachExampleStatus,
  attachWebGpuValidationConsoleGuard,
  expectStatusJsonSafeForGpu,
  skipIfUnsupportedWebGpu,
  waitForExampleStatus,
} from "./webgpu-status.js";
import type { ExampleStatusBase } from "./example-status-types.js";

interface DofStatus extends ExampleStatusBase {
  readonly canvas?: {
    readonly raw: { readonly width: number; readonly height: number };
    readonly dof: { readonly width: number; readonly height: number };
  };
  readonly raw?: DofFrameStatus;
  readonly dof?: DofFrameStatus;
  readonly extraction?: {
    readonly views: number;
    readonly meshDraws: number;
    readonly diagnostics: number;
  };
  readonly worker?: {
    readonly snapshotsReceived: number;
  };
}

interface DofFrameStatus {
  readonly ok: boolean;
  readonly renderTarget: {
    readonly width: number;
    readonly height: number;
    readonly drawCalls: number;
  };
  readonly postEffects: readonly {
    readonly effectId: string;
    readonly output: string;
    readonly ok: boolean;
  }[];
  readonly boundaries: number;
}

test("browser submits depth of field post effect with focused output", async () => {
  const browserSession = await startBrowser();
  const { page } = browserSession;
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);
  let stopped = false;

  try {
    await page.setViewportSize({ width: 1440, height: 780 });
    await page.goto("/examples/dof.html");

    const status = await waitForExampleStatus<DofStatus>(page);

    await attachExampleStatus("dof-status", status);
    expect(status, "DOF status should publish").toBeDefined();

    if (status === undefined) {
      return;
    }

    skipIfUnsupportedWebGpu(status);
    expectStatusJsonSafeForGpu(status);
    expect(status, JSON.stringify(status, null, 2)).toMatchObject({
      example: "dof",
      ok: true,
      phase: "submit",
      renderingBackend: "webgpu-explicit",
      canvas: {
        raw: { width: 512, height: 512 },
        dof: { width: 512, height: 512 },
      },
      extraction: {
        views: 1,
        meshDraws: 32,
        diagnostics: 0,
      },
      dof: {
        ok: true,
        postEffects: [{ effectId: "dof", output: "swapchain", ok: true }],
        boundaries: 2,
      },
      worker: {
        snapshotsReceived: 1,
      },
    });

    await page.bringToFront().catch(() => undefined);
    await page.waitForTimeout(1000);

    const dofScreenshot = await page.locator("#dof-canvas-dof").screenshot();
    const dofImage = readPngImage(dofScreenshot);

    await test.info().attach("dof-blur-metrics", {
      body: JSON.stringify(status.dof?.postEffects ?? [], null, 2),
      contentType: "application/json",
    });
    await test.info().attach("dof-canvas", {
      body: dofScreenshot,
      contentType: "image/png",
    });

    // The status assertion above checks the WebGPU backing size exactly.
    // Element screenshots can round a fractional CSS layout pixel.
    expect(Math.abs(dofImage.width - 512)).toBeLessThanOrEqual(1);
    expect(Math.abs(dofImage.height - 512)).toBeLessThanOrEqual(1);

    await stopDofExample(page);
    stopped = true;
    webGpuValidation.expectNoWarnings();
  } finally {
    if (!stopped) {
      await stopDofExample(page).catch(() => undefined);
    }

    await page.goto("about:blank").catch(() => undefined);
    await browserSession.stopBrowser();
  }
});

async function stopDofExample(page: Page): Promise<void> {
  await Promise.race([
    page.evaluate(() => {
      const stop = (
        globalThis as typeof globalThis & {
          readonly __APERTURE_DOF_STOP__?: () => void;
        }
      ).__APERTURE_DOF_STOP__;

      stop?.();
    }),
    delay(2_000),
  ]);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
