import { expect, test } from "@playwright/test";

import {
  attachExampleStatus,
  attachWebGpuValidationConsoleGuard,
  expectStatusJsonSafeForGpu,
  skipIfUnsupportedWebGpu,
  waitForExampleStatus,
} from "./webgpu-status.js";
import type { ExampleStatusBase } from "./example-status-types.js";

type ExampleGlobal = typeof globalThis & {
  readonly __APERTURE_EXAMPLE_STATUS__?: unknown;
};

interface GpuProfilerStatus extends ExampleStatusBase {
  readonly frame?: number;
  readonly phase?: string;
  readonly counts?: {
    readonly views?: number;
    readonly meshDraws?: number;
    readonly drawCalls?: number;
    readonly diagnostics?: number;
    readonly transformDiagnostics?: number;
  };
  readonly scene?: {
    readonly cubeCount?: number;
    readonly materialCount?: number;
    readonly renderTargetKey?: string;
  };
  readonly gpuTimings?: {
    readonly ready: boolean;
    readonly supported: boolean;
    readonly passes: readonly {
      readonly pass: string;
      readonly microseconds: number;
    }[];
  } | null;
  readonly overlay?: {
    readonly ready: boolean;
    readonly supported: boolean;
    readonly passCount: number;
    readonly changedPassValueCount: number;
    readonly rows: readonly {
      readonly pass: string;
      readonly microseconds: number;
      readonly sampleCount: number;
      readonly changeCount: number;
    }[];
  };
  readonly renderTargets?: readonly {
    readonly source: string;
    readonly renderTargetKey: string | null;
    readonly ok: boolean;
    readonly drawCalls: number;
  }[];
}

test("gpu profiler example shows live per-pass GPU timings", async ({
  page,
}) => {
  const guard = attachWebGpuValidationConsoleGuard(page);

  await page.goto("/examples/gpu-profiler.html");

  const firstStatus = await waitForExampleStatus<GpuProfilerStatus>(page);

  if (firstStatus === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(firstStatus);

  const status = await page.waitForFunction(() => {
    const current = (globalThis as ExampleGlobal)
      .__APERTURE_EXAMPLE_STATUS__ as GpuProfilerStatus | undefined;

    if (current === undefined) {
      return false;
    }

    const rows = current.overlay?.rows ?? [];

    return current.ok &&
      current.frame !== undefined &&
      current.frame >= 2 &&
      current.overlay?.ready === true &&
      current.overlay.changedPassValueCount > 0 &&
      rows.length >= 2 &&
      rows.every((row) => row.microseconds > 0 && row.sampleCount >= 2)
      ? current
      : current.frame !== undefined &&
          current.frame >= 2 &&
          current.overlay?.supported === false
        ? current
        : false;
  });
  const currentStatus = (await status.jsonValue()) as GpuProfilerStatus;

  await attachExampleStatus("gpu-profiler-status", currentStatus);
  test.skip(
    currentStatus.overlay?.supported === false,
    "GPU timestamp queries are unavailable in this browser.",
  );
  expectStatusJsonSafeForGpu(currentStatus);

  expect(currentStatus, JSON.stringify(currentStatus, null, 2)).toMatchObject({
    example: "gpu-profiler",
    ok: true,
    phase: "profiling",
    renderingBackend: "webgpu-explicit",
    counts: {
      views: 2,
      meshDraws: 25,
      drawCalls: 50,
      diagnostics: 0,
    },
    scene: {
      cubeCount: 25,
      materialCount: 5,
    },
    overlay: {
      ready: true,
      supported: true,
      passCount: 2,
    },
  });
  expect(currentStatus.renderTargets).toMatchObject([
    {
      source: "swapchain",
      renderTargetKey: null,
      ok: true,
      drawCalls: 25,
    },
    {
      source: "offscreen",
      renderTargetKey: currentStatus.scene?.renderTargetKey,
      ok: true,
      drawCalls: 25,
    },
  ]);

  const passNames = new Set(
    currentStatus.overlay?.rows.map((row) => row.pass) ?? [],
  );

  expect(passNames).toContain("main");
  expect(passNames).toContain(
    `main:${currentStatus.scene?.renderTargetKey ?? ""}`,
  );
  expect(currentStatus.overlay?.rows.every((row) => row.microseconds > 0)).toBe(
    true,
  );
  expect(currentStatus.overlay?.rows.every((row) => row.sampleCount >= 2)).toBe(
    true,
  );
  expect(currentStatus.overlay?.changedPassValueCount).toBeGreaterThan(0);

  const overlayRows = page.locator("#gpu-profiler-pass-list li");

  await expect(overlayRows).toHaveCount(2);
  await expect(overlayRows.first()).toContainText("main");
  guard.expectNoWarnings();
});
