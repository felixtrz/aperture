import { expect, type Page } from "@playwright/test";

import type { MultiEntityExampleStatus } from "./example-status-types.js";
import {
  attachExampleStatus,
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
    draw: { packages: 0, descriptors: 0, drawList: 0, resolved: 0 },
    command: { commands: 0, drawCount: 0, indexedDrawCount: 0 },
    submission: { commandBuffers: 0, commands: 0, drawCalls: 0 },
    diagnosticCounts: {
      extraction: fixture.diagnostics,
      resources: 0,
      binding: 0,
      draw: 0,
      submission: 0,
      readback: 0,
    },
  });
}
