import { expect, type Page } from "@playwright/test";

import type { MultiEntityExampleStatus } from "./example-status-types.js";
import {
  attachExampleStatus,
  expectedDiagnosticCounts,
  expectNoDrawSubmissionStatus,
  expectStatusJsonSafeForGpu,
  skipIfUnsupportedWebGpu,
  waitForExampleStatus,
} from "./webgpu-status.js";

export interface TextureAssetRouteFixture {
  readonly scenario: string;
  readonly missing: string;
  readonly diagnostics: number;
  readonly meshDraws: number;
  readonly active: number;
  readonly blocked: number;
  readonly renderWorldDiagnostics: readonly string[];
}

export async function expectTextureAssetRouteStatus(
  page: Page,
  fixture: TextureAssetRouteFixture,
): Promise<void> {
  await page.goto(`/examples/multi-entity.html?scenario=${fixture.scenario}`);
  const status = await waitForExampleStatus<MultiEntityExampleStatus>(page);

  await attachExampleStatus(`${fixture.scenario}-routing-status`, status);

  expect(status, "example status should be published").toBeDefined();

  if (status === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(status);

  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "ecs-multi-entity",
    scenario: fixture.scenario,
    ok: false,
    phase: "extract",
    reason: fixture.scenario,
    renderingBackend: "webgpu",
    extraction: {
      views: 1,
      meshDraws: fixture.meshDraws,
      diagnostics: fixture.diagnostics,
    },
    resources: { materials: 0, bindGroups: 0, missing: fixture.missing },
    binding: { planned: 0, applied: 0, ready: 0, diagnostics: 0 },
    renderWorld: {
      active: fixture.active,
      ready: 0,
      blocked: fixture.blocked,
      diagnostics: fixture.renderWorldDiagnostics,
    },
    diagnosticCounts: expectedDiagnosticCounts({
      extraction: fixture.diagnostics,
    }),
  });
  expectNoDrawSubmissionStatus(status);
  expectStatusJsonSafeForGpu(status);
}
