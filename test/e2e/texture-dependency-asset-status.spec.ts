import { expect, test } from "@playwright/test";

import type { MultiEntityExampleStatus } from "./example-status-types.js";
import {
  attachExampleStatus,
  skipIfUnsupportedWebGpu,
  waitForExampleStatus,
} from "./webgpu-status.js";

for (const fixture of [
  {
    scenario: "missing-texture-asset",
    dependencyKind: "texture",
    status: "missing",
    reason: "texture-asset-missing",
    diagnostic: "render.texture.missing",
    registryDiagnostic: null,
  },
  {
    scenario: "missing-sampler-asset",
    dependencyKind: "sampler",
    status: "missing",
    reason: "sampler-asset-missing",
    diagnostic: "render.sampler.missing",
    registryDiagnostic: null,
  },
  {
    scenario: "loading-texture-asset",
    dependencyKind: "texture",
    status: "loading",
    reason: "texture-asset-loading",
    diagnostic: "render.texture.loading",
    registryDiagnostic: null,
  },
  {
    scenario: "failed-texture-asset",
    dependencyKind: "texture",
    status: "failed",
    reason: "texture-asset-failed",
    diagnostic: "render.texture.failed",
    registryDiagnostic: {
      code: "browser.fixture.failedTexture",
      message: "Intentional browser fixture failed texture asset.",
      severity: "error",
    },
  },
  {
    scenario: "loading-sampler-asset",
    dependencyKind: "sampler",
    status: "loading",
    reason: "sampler-asset-loading",
    diagnostic: "render.sampler.loading",
    registryDiagnostic: null,
  },
  {
    scenario: "failed-sampler-asset",
    dependencyKind: "sampler",
    status: "failed",
    reason: "sampler-asset-failed",
    diagnostic: "render.sampler.failed",
    registryDiagnostic: {
      code: "browser.fixture.failedSampler",
      message: "Intentional browser fixture failed sampler asset.",
      severity: "error",
    },
  },
] as const) {
  test(`ECS browser example reports ${fixture.status} ${fixture.dependencyKind} dependency without submitting draws`, async ({
    page,
  }) => {
    await page.goto(`/examples/multi-entity.html?scenario=${fixture.scenario}`);
    const status = await waitForExampleStatus<MultiEntityExampleStatus>(page);

    await attachExampleStatus(`${fixture.scenario}-status`, status);

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
      reason: fixture.reason,
      renderingBackend: "webgpu",
      extraction: { views: 1, meshDraws: 0, diagnostics: 1 },
      assetStatus: {
        [fixture.dependencyKind]: fixture.status,
        diagnostics: [fixture.diagnostic],
        registryDiagnostics:
          fixture.registryDiagnostic === null
            ? []
            : [fixture.registryDiagnostic],
      },
      textureDependency: {
        dependencyKind: fixture.dependencyKind,
        assetStatus: fixture.status,
      },
      resources: {
        materials: 0,
        bindGroups: 0,
        missing: fixture.dependencyKind,
      },
      binding: { planned: 0, applied: 0, ready: 0, diagnostics: 0 },
      renderWorld: {
        active: 0,
        ready: 0,
        blocked: 0,
        diagnostics: ["renderWorld.empty"],
      },
      draw: { packages: 0, descriptors: 0, drawList: 0, resolved: 0 },
      command: { commands: 0, drawCount: 0, indexedDrawCount: 0 },
      submission: { commandBuffers: 0, commands: 0, drawCalls: 0 },
    });
    expect(status.diagnostics, JSON.stringify(status, null, 2)).toEqual([
      expect.objectContaining({
        code: fixture.diagnostic,
        assetKey: expect.stringMatching(
          fixture.dependencyKind === "texture" ? /^texture:/ : /^sampler:/,
        ),
      }),
    ]);
    expect(
      status.textureDependency?.textureKey,
      JSON.stringify(status, null, 2),
    ).toMatch(/^texture:/);
    expect(
      status.textureDependency?.samplerKey,
      JSON.stringify(status, null, 2),
    ).toMatch(/^sampler:/);
  });
}
