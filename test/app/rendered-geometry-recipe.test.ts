import { describe, expect, it, vi } from "vitest";
import { defineApertureConfig } from "@aperture-engine/app/config";
import type {
  GeneratedBrowserApp,
  RenderedGeometryDraw,
  RenderedGeometryInspection,
  RenderedGeometryMesh,
} from "@aperture-engine/app/browser";

// These public-only recipes are also checked by tsconfig.test.json. Keep the
// configuration and request bounds aligned with the inspection guide.
const config = defineApertureConfig({
  mode: "browser",
  canvas: "#aperture",
  render: {
    cadence: "manual",
    geometryInspection: { maxRetainedBytes: 32 * 1024 * 1024 },
  },
});

function inspectWithExplicitRequestBounds(
  app: Pick<GeneratedBrowserApp, "inspectRenderedGeometry">,
): RenderedGeometryInspection {
  let geometry = app.inspectRenderedGeometry();
  if (
    geometry.status === "partial" &&
    geometry.omissions.some((entry) => entry.reason === "request-budget")
  ) {
    geometry = app.inspectRenderedGeometry({
      maxBytes: 128 * 1024 * 1024,
      maxVertices: 2_000_000,
      maxIndices: 6_000_000,
      maxMeshes: 4_096,
      maxDraws: 10_000,
      maxInstances: 100_000,
    });
  }
  return geometry;
}

function* drawTriangles(
  mesh: RenderedGeometryMesh,
  draw: RenderedGeometryDraw,
) {
  const count = draw.indexed ? draw.indexCount : draw.vertexCount;
  const vertexAt = (element: number) =>
    draw.indexed
      ? mesh.indices![draw.firstIndex + element]! + draw.baseVertex
      : draw.firstVertex + element;
  for (let element = 0; element + 2 < count; element += 3) {
    yield [vertexAt(element), vertexAt(element + 1), vertexAt(element + 2)];
  }
}

function result(
  status: RenderedGeometryInspection["status"],
  omissions: RenderedGeometryInspection["omissions"] = [],
): RenderedGeometryInspection {
  return {
    status,
    scope: "submitted-static-triangle-meshes",
    submissionSerial: 1,
    frame: 1,
    meshes: [],
    draws: [],
    omissions,
    copiedBytes: 0,
    retainedBytes: 0,
    excludedScopes: [
      "shadow-only-draws",
      "sky-and-fullscreen",
      "sprites-ui-text-particles",
      "shader-displacement-and-fragment-visibility",
    ],
  };
}

describe("public rendered geometry recipes", () => {
  it("uses the exported configuration helper and browser mode", () => {
    expect(config.mode).toBe("browser");
    expect(config.render.geometryInspection.maxRetainedBytes).toBe(33_554_432);
  });

  it("retries request omissions with explicit bounds and preserves the resulting status", () => {
    const partial = result("partial", [
      { reason: "request-budget", message: "Increase the request bounds." },
    ]);
    const stillPartial = result("partial", [
      { reason: "skinned", message: "Static inspection excludes this draw." },
    ]);
    const inspectRenderedGeometry = vi
      .fn<GeneratedBrowserApp["inspectRenderedGeometry"]>()
      .mockReturnValueOnce(partial)
      .mockReturnValueOnce(stillPartial);
    expect(inspectWithExplicitRequestBounds({ inspectRenderedGeometry })).toBe(
      stillPartial,
    );
    expect(inspectRenderedGeometry).toHaveBeenNthCalledWith(2, {
      maxBytes: 134_217_728,
      maxVertices: 2_000_000,
      maxIndices: 6_000_000,
      maxMeshes: 4_096,
      maxDraws: 10_000,
      maxInstances: 100_000,
    });
    const unavailable = result("unavailable", [
      { reason: "capture-budget", message: "Missing retained upload bytes." },
    ]);
    inspectRenderedGeometry.mockReset().mockReturnValue(unavailable);
    expect(inspectWithExplicitRequestBounds({ inspectRenderedGeometry })).toBe(
      unavailable,
    );
    expect(inspectRenderedGeometry).toHaveBeenCalledTimes(1);
  });

  it("uses actual draw ranges, base vertices and instance multiplicity without counting unused source vertices", () => {
    const mesh: RenderedGeometryMesh = {
      key: "shared",
      sourceKey: "mesh:0:1",
      sourceVersion: 1,
      label: "shared source with unused geometry",
      positions: new Float32Array(30),
      normals: null,
      indices: new Uint16Array([7, 8, 9, 0, 1, 2, 7, 8, 9]),
    };
    const draw: RenderedGeometryDraw = {
      renderId: 1,
      viewId: 0,
      targetKey: "canvas",
      meshKey: mesh.key,
      submesh: 1,
      materialSlot: 1,
      indexed: true,
      firstIndex: 3,
      indexCount: 3,
      baseVertex: 2,
      firstVertex: 0,
      vertexCount: 0,
      firstInstance: 4,
      instances: [
        { renderId: 1, entity: { index: 1, generation: 1 } },
        { renderId: 2, entity: { index: 2, generation: 1 } },
      ],
      worldMatrices: new Float32Array(32),
    };
    const other = {
      ...draw,
      renderId: 3,
      indexed: false,
      firstVertex: 3,
      vertexCount: 3,
      instances: draw.instances.slice(0, 1),
      worldMatrices: new Float32Array(16),
    };
    expect([...drawTriangles(mesh, draw)]).toEqual([[2, 3, 4]]);
    expect([...drawTriangles(mesh, other)]).toEqual([[3, 4, 5]]);
    const referencedSourceVertices = new Set<string>();
    let submittedTriangleInstances = 0;
    for (const entry of [draw, other]) {
      for (const triangle of drawTriangles(mesh, entry)) {
        for (const vertex of triangle) {
          referencedSourceVertices.add(`${mesh.key}:${vertex}`);
        }
        submittedTriangleInstances += entry.instances.length;
      }
    }
    expect(referencedSourceVertices.size).toBe(4);
    expect(submittedTriangleInstances).toBe(3);
  });
});
