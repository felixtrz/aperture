import { expect, test } from "@playwright/test";

import { pixelDistance, rgbaColorToPixel } from "./png.js";
import {
  expectedDiagnosticCounts,
  loadMultiEntityScenarioStatus,
} from "./webgpu-status.js";

const primitiveCases = [
  {
    scenario: "capsule-primitive",
    primitive: "capsule",
    meshLabel: "CapsulePrimitive",
    vertexCount: 90,
    indexCount: 384,
    source: "aperture.createCapsuleMeshAsset",
    material: { r: 0.78, g: 0.86, b: 0.24, a: 1 },
  },
  {
    scenario: "torus-primitive",
    primitive: "torus",
    meshLabel: "TorusPrimitive",
    vertexCount: 45,
    indexCount: 192,
    source: "aperture.createTorusMeshAsset",
    material: { r: 0.36, g: 0.52, b: 1, a: 1 },
  },
] as const;

for (const primitiveCase of primitiveCases) {
  test(`ECS browser example renders built-in ${primitiveCase.primitive} primitive through readback`, async ({
    page,
  }) => {
    const status = await loadMultiEntityScenarioStatus(
      page,
      primitiveCase.scenario,
      `${primitiveCase.scenario}-status`,
    );

    if (status === undefined) {
      return;
    }

    expect(status, JSON.stringify(status, null, 2)).toMatchObject({
      example: "ecs-multi-entity",
      scenario: primitiveCase.scenario,
      ok: true,
      phase: "submit",
      renderingBackend: "webgpu",
      extraction: { views: 1, meshDraws: 1, diagnostics: 0 },
      resources: { materials: 1, bindGroups: 3 },
      binding: { planned: 1, applied: 1, ready: 1, diagnostics: 0 },
      renderWorld: { active: 1, ready: 1, blocked: 0 },
      draw: { packages: 1, descriptors: 1, drawList: 1, resolved: 1 },
      geometry: {
        primitive: primitiveCase.primitive,
        meshLabel: primitiveCase.meshLabel,
        vertexStreams: 1,
        vertexCount: primitiveCase.vertexCount,
        indexCount: primitiveCase.indexCount,
        topology: "triangle-list",
        source: primitiveCase.source,
      },
      command: { drawCount: 1, indexedDrawCount: 1 },
      submission: { commandBuffers: 1, drawCalls: 1, indexedDrawCalls: 1 },
      diagnosticCounts: expectedDiagnosticCounts({}),
    });
    expect(status.clearColor, JSON.stringify(status, null, 2)).toBeDefined();

    if (status.clearColor === undefined || !status.readback?.ok) {
      test.skip(
        true,
        `${primitiveCase.primitive} primitive pixel assertion requires readback.`,
      );
      return;
    }

    const centerSample = status.readback.samples.find(
      (sample) => sample.id === "center",
    );

    expect(
      centerSample,
      `expected center GPU readback sample; status=${JSON.stringify(
        status,
        null,
        2,
      )}`,
    ).toBeDefined();

    if (centerSample === undefined) {
      return;
    }

    expect(
      pixelDistance(
        centerSample.pixel,
        rgbaColorToPixel(primitiveCase.material),
      ),
      `center GPU readback sample should match ${primitiveCase.primitive} material; status=${JSON.stringify(
        status,
        null,
        2,
      )}`,
    ).toBeLessThan(90);
    expect(
      pixelDistance(centerSample.pixel, rgbaColorToPixel(status.clearColor)),
      `center GPU readback sample should differ from clear color; status=${JSON.stringify(
        status,
        null,
        2,
      )}`,
    ).toBeGreaterThan(40);
  });
}
