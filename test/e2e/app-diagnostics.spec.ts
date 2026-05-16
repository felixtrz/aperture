import { expect, test } from "@playwright/test";

import {
  attachExampleStatus,
  expectStatusJsonSafeForGpu,
  skipIfUnsupportedWebGpu,
  waitForExampleStatus,
} from "./webgpu-status.js";
import type { ExampleStatusBase } from "./example-status-types.js";

interface AppDiagnosticsStatus extends ExampleStatusBase {
  readonly diagnosticOnly?: boolean;
  readonly diagnosticCodes?: readonly string[];
  readonly scenarios?: {
    readonly mixedMaterials?: AppDiagnosticScenarioStatus;
    readonly materialDependencies?: AppDiagnosticScenarioStatus;
  };
}

interface AppDiagnosticScenarioStatus {
  readonly caseId: string;
  readonly ok: boolean;
  readonly expectedFailure: boolean;
  readonly expectedDiagnostic: string;
  readonly diagnosticCodes: readonly string[];
  readonly message: string;
  readonly report: {
    readonly ok: boolean;
    readonly counts: {
      readonly meshDraws: number;
      readonly drawCalls: number;
      readonly diagnostics: number;
    };
    readonly diagnostics: readonly {
      readonly code?: string;
      readonly message?: string;
    }[];
    readonly materialDependencyReadiness?: readonly unknown[];
  };
}

test("app diagnostics example exposes app-facade failure reports", async ({
  page,
}) => {
  await page.goto("/examples/app-diagnostics.html");

  const status = await waitForExampleStatus<AppDiagnosticsStatus>(page);

  await attachExampleStatus("app-diagnostics-status", status);
  expect(status, "app diagnostics status should publish").toBeDefined();

  if (status === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(status);
  expectStatusJsonSafeForGpu(status);

  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "app-diagnostics",
    diagnosticOnly: true,
    ok: true,
    phase: "diagnostics-ready",
    renderingBackend: "webgpu-explicit",
  });

  const mixed = status.scenarios?.mixedMaterials;
  const dependencies = status.scenarios?.materialDependencies;

  expect(mixed, JSON.stringify(status, null, 2)).toMatchObject({
    caseId: "mixed-materials",
    ok: false,
    expectedFailure: true,
    expectedDiagnostic: "webGpuApp.additionalDrawResourceUnsupported",
    report: {
      ok: false,
      counts: { meshDraws: 2, drawCalls: 0, diagnostics: 1 },
    },
  });
  expect(mixed?.diagnosticCodes).toContain(
    "webGpuApp.additionalDrawResourceUnsupported",
  );
  expect(mixed?.message).toContain("one source mesh/material resource set");

  expect(dependencies, JSON.stringify(status, null, 2)).toMatchObject({
    caseId: "material-dependencies",
    ok: false,
    expectedFailure: true,
    expectedDiagnostic: "webGpuApp.materialDependenciesNotReady",
    report: {
      ok: false,
      counts: { meshDraws: 0, drawCalls: 0 },
    },
  });
  expect(dependencies?.diagnosticCodes).toEqual(
    expect.arrayContaining([
      "render.texture.missing",
      "render.sampler.loading",
      "webGpuApp.materialDependenciesNotReady",
      "webGpuApp.emptySnapshot",
    ]),
  );
  expect(dependencies?.message).toContain("source asset dependencies");
  expect(dependencies?.report.materialDependencyReadiness).toHaveLength(1);
});
