import { expect, type Page } from "@playwright/test";

import {
  expectedDiagnosticCounts,
  expectNoDrawSubmissionStatus,
  expectStatusJsonSafeForGpu,
  loadMultiEntityScenarioStatus,
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
  const status = await loadMultiEntityScenarioStatus(
    page,
    fixture.scenario,
    `${fixture.scenario}-routing-status`,
  );

  if (status === undefined) {
    return;
  }

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
