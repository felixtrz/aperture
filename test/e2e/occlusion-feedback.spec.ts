import { expect, test } from "@playwright/test";

import {
  attachExampleStatus,
  attachWebGpuValidationConsoleGuard,
  expectStatusJsonSafeForGpu,
  skipIfUnsupportedWebGpu,
  waitForExampleStatus,
} from "./webgpu-status.js";
import type { ExampleStatusBase } from "./example-status-types.js";

interface OcclusionFeedbackStatus extends ExampleStatusBase {
  readonly occlusionQueries?: {
    readonly status: "inactive" | "ready" | "unsupported";
    readonly queryCount: number;
    readonly testedRenderIds: readonly number[];
    readonly visibleRenderIds: readonly number[];
    readonly occludedRenderIds: readonly number[];
    readonly sampleCounts: readonly string[];
    readonly diagnostics: readonly unknown[];
  } | null;
  readonly occlusionStatus?: {
    readonly ok: boolean;
    readonly status: string;
    readonly queryCount: number;
    readonly visibleRenderId: number | null;
    readonly hiddenRenderId: number | null;
    readonly visibleReported: boolean;
    readonly hiddenReported: boolean;
    readonly hasZeroSample: boolean;
    readonly hasNonZeroSample: boolean;
  };
  readonly counts?: {
    readonly meshDraws: number;
    readonly drawCalls: number;
    readonly diagnostics: number;
  };
  readonly worker?: {
    readonly step?: {
      readonly meshDraws: number;
      readonly queryDraws: number;
      readonly diagnostics: number;
    };
  };
}

test("browser publishes GPU occlusion-query visibility feedback", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto("/examples/occlusion-feedback.html");

  const status = await waitForExampleStatus<OcclusionFeedbackStatus>(page);

  await attachExampleStatus("occlusion-feedback-status", status);
  expect(status, "occlusion feedback status should publish").toBeDefined();

  if (status === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(status);
  expectStatusJsonSafeForGpu(status);
  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "occlusion-feedback",
    ok: true,
    phase: "submit",
    renderingBackend: "webgpu-explicit",
    occlusionStatus: {
      ok: true,
      status: "ready",
      queryCount: 2,
      visibleReported: true,
      hiddenReported: true,
      hasZeroSample: true,
      hasNonZeroSample: true,
    },
    counts: {
      meshDraws: 3,
      diagnostics: 0,
    },
    worker: {
      step: {
        meshDraws: 3,
        queryDraws: 2,
        diagnostics: 0,
      },
    },
  });
  expect(status.occlusionQueries).toMatchObject({
    status: "ready",
    queryCount: 2,
    diagnostics: [],
  });
  expect(status.occlusionQueries?.sampleCounts).toContain("0");
  expect(
    status.occlusionQueries?.sampleCounts.some((value) => Number(value) > 0),
  ).toBe(true);
  webGpuValidation.expectNoWarnings();
});
