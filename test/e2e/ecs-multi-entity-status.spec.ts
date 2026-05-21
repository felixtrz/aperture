import { expect, test } from "@playwright/test";

import { expectSceneReadbackStatus } from "./readback-status.js";
import {
  expectedDiagnosticCounts,
  loadMultiEntityScenarioStatus,
} from "./webgpu-status.js";

test("ECS multi-entity example publishes three-draw frame status", async ({
  page,
}) => {
  const status = await loadMultiEntityScenarioStatus(
    page,
    undefined,
    "ecs-multi-entity-status",
  );

  if (status === undefined) {
    return;
  }

  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "ecs-multi-entity",
    ok: true,
    phase: "submit",
    renderingBackend: "webgpu-explicit",
    worker: { running: false, scenario: "default", frame: 1 },
    transport: {
      mode: "structured-clone-postMessage",
      snapshotsReceived: 1,
      typedArraysPreserved: {
        transforms: true,
        viewMatrices: true,
        viewsArray: true,
        meshDrawsArray: true,
        diagnosticsArray: true,
      },
    },
    extraction: { views: 1, meshDraws: 3, diagnostics: 1 },
    resources: { materials: 3, bindGroups: 5 },
    binding: { planned: 3, applied: 3, ready: 3, diagnostics: 0 },
    renderWorld: { active: 3, ready: 3, blocked: 0 },
    draw: { packages: 3, descriptors: 3, drawList: 3, resolved: 3 },
    geometry: {
      primitive: "plane",
      meshLabel: "SharedPrimitivePlane",
      vertexStreams: 1,
      vertexCount: 4,
      indexCount: 6,
      topology: "triangle-list",
      source: "aperture.createPlaneMeshAsset",
    },
    visibility: {
      authored: 4,
      extracted: 3,
      skipped: 1,
      hiddenMaterialKey: "material:hidden-magenta-plane",
      hiddenMaterialColor: [1, 0, 1, 1],
      diagnostics: ["render.invisible"],
    },
    command: { drawCount: 3, indexedDrawCount: 3 },
    submission: { commandBuffers: 1, drawCalls: 3, indexedDrawCalls: 3 },
    diagnosticCounts: expectedDiagnosticCounts({ extraction: 1 }),
  });
  expect(
    status.command?.commands,
    JSON.stringify(status, null, 2),
  ).toBeGreaterThan(0);
  expect(status.submission?.commands, JSON.stringify(status, null, 2)).toBe(
    status.command?.commands,
  );
  expect(status.draw?.renderIds, JSON.stringify(status, null, 2)).toHaveLength(
    3,
  );
  expect(
    [...(status.command?.firstInstances ?? [])].sort(),
    JSON.stringify(status, null, 2),
  ).toEqual([0, 1, 2]);
  expectSceneReadbackStatus(
    status.readback,
    9,
    JSON.stringify(status, null, 2),
  );
});
