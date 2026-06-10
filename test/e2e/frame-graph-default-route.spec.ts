import { expect, test } from "@playwright/test";

import { pixelDistance, rgbaColorToPixel } from "./png.js";
import {
  attachExampleStatus,
  attachWebGpuValidationConsoleGuard,
  expectStatusJsonSafeForGpu,
  loadExampleStatus,
  skipIfUnsupportedWebGpu,
  waitForExampleStatus,
} from "./webgpu-status.js";
import type { ExampleStatusBase } from "./example-status-types.js";

// AI-25 gating spec — the single-encoder FrameGraph route is the DEFAULT.
//
// 1. An app created with NO explicit useFrameGraph option (depth-app-overlap
//    calls createWebGpuApp without it) renders through the graph route by
//    default and stays pixel-identical to the committed legacy-era
//    expectations (the same colors/thresholds depth-app-overlap.spec.ts has
//    asserted since the legacy default), with zero diagnostics.
// 2. The generated browser app's per-load `?graph=0` override forces the
//    legacy multi-submit route (resolveUseFrameGraph URL precedence) and that
//    route still renders correctly — the escape hatch works under the new
//    default. (render.frameGraph config behavior is unit-tested in
//    test/app/frame-graph-route.test.ts.)

interface FrameGraphDefaultRouteStatus extends ExampleStatusBase {
  readonly counts?: {
    readonly meshDraws?: number;
    readonly drawCalls?: number;
    readonly diagnostics?: number;
  };
  readonly overlap?: {
    readonly expectedTopColor?: {
      readonly r: number;
      readonly g: number;
      readonly b: number;
      readonly a: number;
    };
    readonly expectedRejectedColor?: {
      readonly r: number;
      readonly g: number;
      readonly b: number;
      readonly a: number;
    };
  };
  readonly readback?: {
    readonly ok: boolean;
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

interface GeneratedLegacyRouteStatus extends ExampleStatusBase {
  readonly route: "draco" | "ktx2";
  readonly meshDraws: number;
  readonly drawCalls: number;
}

test("default config renders through the FrameGraph route pixel-identically to the legacy-era baseline (AI-25)", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);
  // No query string and no useFrameGraph option in the example: this load runs
  // the NEW default — the single-encoder forward FrameGraph route.
  const status = await loadExampleStatus<FrameGraphDefaultRouteStatus>(
    page,
    "/examples/depth-app-overlap.html",
    "frame-graph-default-route-status",
  );

  if (status === undefined) {
    return;
  }

  expectStatusJsonSafeForGpu(status);
  // The committed expectations below were authored under the legacy default —
  // the graph-by-default frame must satisfy them unchanged (parity), with no
  // new diagnostics from the route change.
  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "depth-app-overlap",
    ok: true,
    phase: "submit",
    renderingBackend: "webgpu-explicit",
    counts: {
      meshDraws: 2,
      drawCalls: 2,
      diagnostics: 0,
    },
  });
  webGpuValidation.expectNoWarnings();

  if (!status.readback?.ok) {
    test.skip(true, "FrameGraph default-route pixel assertion needs readback.");
    return;
  }

  const centerSample = status.readback.samples?.find(
    (sample) => sample.id === "center",
  );
  expect(
    centerSample,
    `expected center GPU readback sample; status=${JSON.stringify(status, null, 2)}`,
  ).toBeDefined();

  if (centerSample === undefined) {
    return;
  }

  const expectedTop = rgbaColorToPixel(
    status.overlap?.expectedTopColor ?? { r: 0.16, g: 0.9, b: 0.32, a: 1 },
  );
  const expectedRejected = rgbaColorToPixel(
    status.overlap?.expectedRejectedColor ?? {
      r: 1,
      g: 0.08,
      b: 0.04,
      a: 1,
    },
  );

  // Same pixel contract the legacy default satisfied: the near unlit draw wins
  // the depth test at the overlap center; the far standard draw does not.
  expect(
    pixelDistance(centerSample.pixel, expectedTop),
    `graph-by-default frame should match the legacy-era near color; status=${JSON.stringify(status, null, 2)}`,
  ).toBeLessThan(100);
  expect(
    pixelDistance(centerSample.pixel, expectedRejected),
    `graph-by-default frame should still reject the far draw; status=${JSON.stringify(status, null, 2)}`,
  ).toBeGreaterThan(100);
});

test("?graph=0 forces the generated browser app back onto the legacy route and it still renders (AI-25)", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  // The generated browser app resolves the route via resolveUseFrameGraph:
  // the ?graph=0 per-load override wins over config/default and forces the
  // legacy multi-submit route.
  await page.goto("/examples/compressed-gltf.html?graph=0");
  const initialStatus =
    await waitForExampleStatus<GeneratedLegacyRouteStatus>(page);
  expect(
    initialStatus,
    "generated app status should publish under ?graph=0",
  ).toBeDefined();

  if (initialStatus === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(initialStatus);

  await page.waitForFunction(() => {
    const status = (
      globalThis as {
        readonly __APERTURE_EXAMPLE_STATUS__?: {
          readonly ok?: boolean;
          readonly meshDraws?: number;
          readonly drawCalls?: number;
        };
      }
    ).__APERTURE_EXAMPLE_STATUS__;

    return (
      status?.ok === true &&
      (status.meshDraws ?? 0) > 0 &&
      (status.drawCalls ?? 0) > 0
    );
  });

  const status = await page.evaluate(
    () =>
      (
        globalThis as {
          readonly __APERTURE_EXAMPLE_STATUS__?: GeneratedLegacyRouteStatus;
        }
      ).__APERTURE_EXAMPLE_STATUS__,
  );
  await attachExampleStatus("frame-graph-forced-legacy-status", status);
  expect(status).toBeDefined();

  if (status === undefined) {
    return;
  }

  expectStatusJsonSafeForGpu(status);
  expect(status).toMatchObject({
    example: "compressed-gltf",
    ok: true,
  });
  expect(status.meshDraws).toBeGreaterThan(0);
  expect(status.drawCalls).toBeGreaterThan(0);
  webGpuValidation.expectNoWarnings();
});
