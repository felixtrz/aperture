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
    readonly queryCandidateDraws: number;
    readonly queriedDraws: number;
    readonly resolvedQueryResults: number;
    readonly skippedFromQuery: number;
    readonly skippedRenderIds: readonly number[];
    readonly forcedProbeDraws: number;
    readonly forcedProbeRenderIds: readonly number[];
    readonly fallbackReason: string | null;
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
    readonly queryCandidateDraws: number;
    readonly queriedDraws: number;
    readonly resolvedQueryResults: number;
    readonly skippedFromQuery: number;
    readonly forcedProbeDraws: number;
    readonly fallbackReason: string | null;
    readonly visibleRenderId: number | null;
    readonly hiddenRenderId: number | null;
    readonly visibleReported: boolean;
    readonly hiddenReported: boolean;
    readonly hiddenSkipped: boolean;
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
      queryCandidateDraws: 2,
      queriedDraws: 1,
      resolvedQueryResults: 1,
      skippedFromQuery: 1,
      forcedProbeDraws: 0,
      fallbackReason: null,
      visibleReported: true,
      hiddenSkipped: true,
      hasNonZeroSample: true,
    },
    counts: {
      meshDraws: 3,
      drawCalls: 2,
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
    queryCount: 1,
    queryCandidateDraws: 2,
    queriedDraws: 1,
    resolvedQueryResults: 1,
    skippedFromQuery: 1,
    forcedProbeDraws: 0,
    fallbackReason: null,
    diagnostics: [],
  });
  expect(status.occlusionStatus?.hiddenRenderId).not.toBeNull();
  expect(status.occlusionQueries?.skippedRenderIds).toContain(
    status.occlusionStatus?.hiddenRenderId ?? -1,
  );
  expect(
    status.occlusionQueries?.sampleCounts.some((value) => Number(value) > 0),
  ).toBe(true);
  webGpuValidation.expectNoWarnings();
});
