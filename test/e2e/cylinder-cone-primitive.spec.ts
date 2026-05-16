import { expect, test } from "@playwright/test";

import type { MultiEntityExampleStatus } from "./example-status-types.js";
import { pixelDistance, rgbaColorToPixel } from "./png.js";
import {
  attachExampleStatus,
  expectedDiagnosticCounts,
  skipIfUnsupportedWebGpu,
  waitForExampleStatus,
} from "./webgpu-status.js";

const primitiveCases = [
  {
    scenario: "cylinder-primitive",
    primitive: "cylinder",
    meshLabel: "CylinderPrimitive",
    vertexCount: 47,
    indexCount: 144,
    source: "aperture.createCylinderMeshAsset",
    material: { r: 0.12, g: 0.72, b: 0.9, a: 1 },
  },
  {
    scenario: "cone-primitive",
    primitive: "cone",
    meshLabel: "ConePrimitive",
    vertexCount: 37,
    indexCount: 96,
    source: "aperture.createConeMeshAsset",
    material: { r: 0.94, g: 0.42, b: 0.22, a: 1 },
  },
] as const;

for (const primitiveCase of primitiveCases) {
  test(`ECS browser example renders built-in ${primitiveCase.primitive} primitive through readback`, async ({
    page,
  }) => {
    await page.goto(
      `/examples/multi-entity.html?scenario=${primitiveCase.scenario}`,
    );
    const status = await waitForExampleStatus<MultiEntityExampleStatus>(page);

    await attachExampleStatus(`${primitiveCase.scenario}-status`, status);

    expect(status, "example status should be published").toBeDefined();

    if (status === undefined) {
      return;
    }

    skipIfUnsupportedWebGpu(status);

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
