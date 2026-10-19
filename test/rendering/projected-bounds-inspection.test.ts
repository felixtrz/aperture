import { describe, expect, it } from "vitest";
import { compileShader } from "@aperture-engine/shader/compiler";
import { createRenderTargetHandle } from "@aperture-engine/simulation";
import {
  inspectProjectedMeshBounds,
  createStableRenderId,
  createStandardMaterialAsset,
  STANDARD_MATERIAL_EXTENSION_WGSL,
  inspectCoplanarMeshOverlaps,
  type ProjectedBoundsInput,
  type ProjectedBoundsReport,
} from "@aperture-engine/render";
import {
  projectedBoundsFixture,
  probePoints,
} from "../helpers/projected-bounds-fixture.js";
import {
  identityMatrix,
  inspectionMesh,
  type Position,
} from "../helpers/coplanar-overlap-fixture.js";

function allFinite(value: unknown): boolean {
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(allFinite);
  return value !== null && typeof value === "object"
    ? Object.values(value).every(allFinite)
    : true;
}
function partial(report: ProjectedBoundsReport) {
  expect(report.coverage).toBe("partial");
  expect(report.bounds).toBeNull();
  expect(report.diagnostics.length).toBeGreaterThan(0);
  expect(allFinite(report)).toBe(true);
}
function replacedMesh(
  input: ProjectedBoundsInput,
  points: Position[],
): ProjectedBoundsInput {
  return {
    ...input,
    resolveMesh: () => inspectionMesh(points),
    snapshot: {
      ...input.snapshot,
      transforms: new Float32Array(identityMatrix),
      meshDraws: input.snapshot.meshDraws.map((d) => ({
        ...d,
        vertexStart: 0,
        vertexCount: points.length,
      })),
    },
  };
}

describe("saved static vertex projection", () => {
  it("preserves the first active reference for each aggregate extremum tie", () => {
    const { input } = projectedBoundsFixture();
    const mesh = inspectionMesh(
      [
        [-1, -1, 0],
        [1, -1, 0],
        [1, 1, 0],
        [-1, 1, 0],
      ],
      [0, 1, 2, 0, 2, 3],
    );
    const first = input.snapshot.meshDraws[0]!;
    const second = {
      ...first,
      entity: { index: 5, generation: 0 },
      renderId: 5,
      worldTransformOffset: 16,
    };
    const translated = [...identityMatrix];
    translated[12] = 0.5;
    const report = inspectProjectedMeshBounds({
      ...input,
      scope: { all: true },
      resolveMesh: () => mesh,
      snapshot: {
        ...input.snapshot,
        meshDraws: [second, first],
        transforms: new Float32Array([...identityMatrix, ...translated]),
      },
    });
    expect(report.coverage).toBe("complete");
    expect(report.counts.projectedReferences).toBe(12);
    // Orthographic height 12 in 600 pixels gives 50 pixels per world unit.
    expect(report.bounds!.min[0]).toBeCloseTo(350, 4);
    expect(report.bounds!.min[1]).toBeCloseTo(250, 4);
    expect(report.bounds!.max[0]).toBeCloseTo(475, 4);
    expect(report.bounds!.max[1]).toBeCloseTo(350, 4);
    for (const [axis, offset] of [
      ["minX", 0],
      ["minY", 2],
      ["maxX", 1],
      ["maxY", 0],
    ] as const) {
      for (const draw of report.draws)
        expect(draw.bounds!.witnesses[axis]).toMatchObject({
          renderId: draw.renderId,
          offset,
          vertexIndex: offset,
        });
      expect(report.bounds!.witnesses[axis]).toMatchObject({
        renderId: axis === "maxX" ? second.renderId : first.renderId,
        offset,
        vertexIndex: offset,
      });
    }
  });
  it("preserves coplanar accounting for the largest existing triangle budget", () => {
    const { input } = projectedBoundsFixture();
    const report = inspectCoplanarMeshOverlaps({
      ...input,
      limits: { maxTriangles: Number.MAX_SAFE_INTEGER },
    });
    expect(report.counts.triangles).toBe(1);
  });
  it("keeps static surface/opacity hooks inspectable while rejecting a deformation hook", () => {
    const { input } = projectedBoundsFixture();
    const shader = compileShader({
      entry: "surface.wgsl",
      modules: {
        "surface.wgsl": `${STANDARD_MATERIAL_EXTENSION_WGSL}
fn shade(s: ApertureSurface, uv: vec2f, world: vec3f, p: vec4f) -> ApertureSurface { return s; }
fn opacity(uv: vec2f, p: vec4f) -> f32 { return 1.0; }
fn deform(v: ApertureVertex, uv: vec2f, p: vec4f) -> ApertureVertex { return v; }`,
      },
    });
    const extension = {
      shader,
      surface: "shade",
      opacity: "opacity",
      parameters: [0, 0, 0, 0] as const,
    };
    const material = createStandardMaterialAsset({
      extension,
      renderState: { alphaMode: "mask", alphaCutoff: 0.5 },
    });
    const staticReport = inspectProjectedMeshBounds({
      ...input,
      resolveMaterial: () => material,
    });
    expect(staticReport.coverage).toBe("complete");
    expect(staticReport.visibility).toBe("unknown");
    partial(
      inspectProjectedMeshBounds({
        ...input,
        resolveMaterial: () =>
          createStandardMaterialAsset({
            extension: { ...extension, deform: "deform" },
            renderState: { alphaMode: "mask", alphaCutoff: 0.5 },
          }),
      }),
    );
  });
  it("keeps the fixed sensitivity guard distinct from a visual or fit tolerance", () => {
    const { input } = projectedBoundsFixture();
    const ordinary = inspectProjectedMeshBounds(input);
    expect(ordinary.coverage).toBe("complete");
    expect(ordinary.precisionTolerancePixels).toBe(0.05);
    const oversized = inspectProjectedMeshBounds({
      ...input,
      target: { width: 1_000_000, height: 750_000 },
    });
    partial(oversized);
    expect(
      oversized.diagnostics.some((d) => d.message.includes("uncertainty")),
    ).toBe(true);
    expect(() =>
      inspectProjectedMeshBounds({
        ...input,
        precisionTolerancePixels: 100,
      } as ProjectedBoundsInput),
    ).toThrow(/Unknown inspection/);
  });
  it("rejects subnormal positions, possible Float32 model overflow and nonaffine transforms explicitly", () => {
    const { input } = projectedBoundsFixture();
    const subnormal = replacedMesh(input, [
      [1e-40, 0, 0],
      [1, 0, 0],
      [0, 1, 0],
    ]);
    partial(inspectProjectedMeshBounds(subnormal));
    const large = replacedMesh(input, [
      [1e30, 0, 0],
      [1, 0, 0],
      [0, 1, 0],
    ]);
    const transforms = new Float32Array(identityMatrix);
    transforms[0] = 1e30;
    partial(
      inspectProjectedMeshBounds({
        ...large,
        snapshot: { ...large.snapshot, transforms },
      }),
    );
    transforms.set(identityMatrix);
    transforms[3] = 0.1;
    partial(
      inspectProjectedMeshBounds({
        ...input,
        snapshot: { ...input.snapshot, transforms },
      }),
    );
  });
  it("preserves signed retained draw/view IDs from high entity generations", () => {
    const { input } = projectedBoundsFixture();
    const entity = { index: 42, generation: 128 };
    const id = createStableRenderId(entity);
    expect(id).toBeLessThan(0);
    const report = inspectProjectedMeshBounds({
      ...input,
      viewId: id,
      scope: { entities: [entity] },
      snapshot: {
        ...input.snapshot,
        views: [
          {
            ...input.snapshot.views[0]!,
            viewId: id,
            camera: entity,
            layerMask: -1,
          },
        ],
        meshDraws: [
          {
            ...input.snapshot.meshDraws[0]!,
            renderId: id,
            entity,
            layerMask: -2147483648,
          },
        ],
      },
    });
    expect(report.coverage).toBe("complete");
    expect(report.viewId).toBe(id);
    expect(report.bounds!.witnesses.minY).toMatchObject({
      renderId: id,
      entity,
    });
  });
  it.each([false, true])(
    "matches an independent parent/reflection/scale oracle; perspective=%s",
    (perspective) => {
      const { input, mesh, oracle } = projectedBoundsFixture(perspective);
      const snapshotBefore = structuredClone(input.snapshot),
        meshBefore = structuredClone(mesh);
      const report = inspectProjectedMeshBounds(input);
      expect(report.coverage).toBe("complete");
      expect(report.visibility).toBe("unknown");
      const pixels = probePoints.map((p) => oracle(p).pixel);
      expect(report.bounds!.min[0]).toBeCloseTo(
        Math.min(...pixels.map((p) => p[0])),
        4,
      );
      expect(report.bounds!.min[1]).toBeCloseTo(
        Math.min(...pixels.map((p) => p[1])),
        4,
      );
      expect(report.bounds!.max[0]).toBeCloseTo(
        Math.max(...pixels.map((p) => p[0])),
        4,
      );
      expect(report.bounds!.max[1]).toBeCloseTo(
        Math.max(...pixels.map((p) => p[1])),
        4,
      );
      for (const w of Object.values(report.bounds!.witnesses)) {
        const expected = oracle(w.local);
        w.world.forEach((n, i) => expect(n).toBeCloseTo(expected.world[i]!, 5));
        w.pixel.forEach((n, i) => expect(n).toBeCloseTo(expected.pixel[i]!, 4));
      }
      expect(report.counts.projectedReferences).toBe(3);
      expect(report.draws[0]!.maxPixelUncertainty).toBeLessThan(0.05);
      expect(input.snapshot).toEqual(snapshotBefore);
      expect(mesh).toEqual(meshBefore);
      expect(allFinite(report)).toBe(true);
      // A nonexistent corner can extend the AABB above every actual vertex.
      expect(oracle([-1, 2, -0.5]).pixel[1]).toBeLessThan(
        report.bounds!.min[1] - 20,
      );
    },
  );
  it.each([false, true])(
    "honors interleaved indexed range and excludes inactive outlier; perspective=%s",
    (perspective) => {
      const { input } = projectedBoundsFixture(perspective, true);
      const report = inspectProjectedMeshBounds(input);
      const baseline = inspectProjectedMeshBounds(
        projectedBoundsFixture(perspective).input,
      );
      expect(report.bounds!.min).toEqual(baseline.bounds!.min);
      expect(report.bounds!.max).toEqual(baseline.bounds!.max);
      expect(report.draws[0]!.range).toEqual({
        unit: "index",
        start: 3,
        count: 3,
      });
      expect(
        Object.values(report.bounds!.witnesses).every(
          (w) =>
            w.offset >= 3 &&
            w.offset < 6 &&
            w.vertexIndex >= 1 &&
            w.vertexIndex <= 3,
        ),
      ).toBe(true);
    },
  );
  it("includes a degenerate triangle extremum and reports offscreen geometry without clamping", () => {
    const { input, oracle } = projectedBoundsFixture(false, true, true);
    const report = inspectProjectedMeshBounds(input);
    expect(report.coverage).toBe("complete");
    expect(report.bounds!.min[1]).toBeCloseTo(oracle([0, 5, 0]).pixel[1], 4);
    expect(report.bounds!.min[1]).toBeLessThan(0);
    expect(report.bounds!.witnesses.minY).toMatchObject({
      offset: 6,
      vertexIndex: 4,
      local: [0, 5, 0],
    });
    expect(report.draws[0]!.outsideViewportReferences).toBe(3);
    expect(report.counts.attemptedReferences).toBe(6);
  });
  it("uses nonindexed packet overrides and selected submesh only", () => {
    const { input } = projectedBoundsFixture();
    const mesh = inspectionMesh([
      [999, 999, 0],
      [999, 999, 0],
      [999, 999, 0],
      ...probePoints,
    ]);
    const ranged = {
      ...input,
      resolveMesh: () => ({
        ...mesh,
        submeshes: [
          ...mesh.submeshes,
          { ...mesh.submeshes[0]!, topology: "line-list" as const },
        ],
      }),
      snapshot: {
        ...input.snapshot,
        meshDraws: input.snapshot.meshDraws.map((d) => ({
          ...d,
          vertexStart: 3,
          vertexCount: 3,
        })),
      },
    };
    const report = inspectProjectedMeshBounds(ranged);
    expect(report.coverage).toBe("complete");
    expect(report.bounds!.min).toEqual(
      inspectProjectedMeshBounds(input).bounds!.min,
    );
    expect(report.draws[0]!.range).toEqual({
      unit: "vertex",
      start: 3,
      count: 3,
    });
  });
  it("selects the explicit view, unions selectors, clones scope and orders draw witnesses deterministically", () => {
    const { input } = projectedBoundsFixture();
    const first = input.snapshot.meshDraws[0]!;
    const scope = {
      meshIds: ["mesh.0"],
      entities: [{ index: 5, generation: 3 }],
    };
    const second = {
      ...first,
      renderId: 50,
      entity: { index: 5, generation: 3 },
    };
    const third = {
      ...first,
      renderId: 70,
      entity: { index: 7, generation: 2 },
      layerMask: 2,
    };
    const snapshot = {
      ...input.snapshot,
      views: [
        { ...input.snapshot.views[0]!, viewId: 123, layerMask: 2 },
        ...input.snapshot.views,
      ],
      meshDraws: [third, second, first],
    };
    const report = inspectProjectedMeshBounds({ ...input, scope, snapshot });
    expect(report.counts).toMatchObject({
      matchedDraws: 3,
      selectedDraws: 2,
      layerExcludedDraws: 1,
    });
    expect(report.draws.map((d) => d.renderId)).toEqual([0, 50]);
    expect(report.bounds!.witnesses.minY.renderId).toBe(0);
    expect(
      inspectProjectedMeshBounds({
        ...input,
        scope,
        snapshot: { ...snapshot, meshDraws: [first, second, third] },
      }),
    ).toEqual(report);
    const alternate = inspectProjectedMeshBounds({
      ...input,
      scope,
      snapshot,
      viewId: 123,
    });
    expect(alternate.draws.map((d) => d.renderId)).toEqual([70]);
    scope.meshIds[0] = "changed";
    scope.entities[0]!.index = 100;
    expect(report.scope).toEqual({
      meshIds: ["mesh.0"],
      entities: [{ index: 5, generation: 3 }],
    });
  });
  it.each([
    "draw",
    "vertex",
    "unmatched",
    "missing-mesh",
    "missing-material",
    "deform",
    "range",
    "index",
    "matrix",
    "position",
  ])("nulls aggregate with explicit %s diagnostic", (kind) => {
    const f = projectedBoundsFixture(false, true),
      input = f.input;
    let changed: ProjectedBoundsInput = input;
    if (kind === "draw")
      changed = {
        ...input,
        scope: { all: true },
        limits: { maxDraws: 1 },
        snapshot: {
          ...input.snapshot,
          meshDraws: [
            input.snapshot.meshDraws[0]!,
            {
              ...input.snapshot.meshDraws[0]!,
              renderId: 5,
              entity: { index: 5, generation: 0 },
            },
          ],
        },
      };
    if (kind === "vertex") changed = { ...input, limits: { maxVertices: 2 } };
    if (kind === "unmatched")
      changed = { ...input, scope: { meshIds: ["mesh.0", "unknown"] } };
    if (kind === "missing-mesh")
      changed = { ...input, resolveMesh: () => undefined };
    if (kind === "missing-material")
      changed = { ...input, resolveMaterial: () => undefined };
    if (kind === "deform")
      changed = {
        ...input,
        snapshot: {
          ...input.snapshot,
          meshDraws: input.snapshot.meshDraws.map((d) => ({
            ...d,
            boneMatrixOffset: 0,
          })),
        },
      };
    if (kind === "range")
      changed = {
        ...input,
        snapshot: {
          ...input.snapshot,
          meshDraws: input.snapshot.meshDraws.map((d) => ({
            ...d,
            indexStart: 300,
          })),
        },
      };
    if (kind === "index")
      changed = {
        ...input,
        resolveMesh: () => ({
          ...f.mesh,
          indexBuffer: {
            ...f.mesh.indexBuffer!,
            data: new Uint16Array([0, 0, 0, 1, 999, 3]),
          },
        }),
      };
    if (kind === "matrix") {
      const transforms = input.snapshot.transforms.slice();
      transforms[0] = NaN;
      changed = { ...input, snapshot: { ...input.snapshot, transforms } };
    }
    if (kind === "position")
      changed = {
        ...input,
        resolveMesh: () =>
          inspectionMesh(
            [
              [NaN, 0, 0],
              [1, 0, 0],
              [0, 1, 0],
            ],
            [0, 0, 0, 0, 1, 2],
          ),
      };
    partial(inspectProjectedMeshBounds(changed));
  });
  it.each([9.95, 10, 11])(
    "rejects near/eye crossing at world Z %s without a subset envelope",
    (z) => {
      const { input } = projectedBoundsFixture(true);
      const report = inspectProjectedMeshBounds(
        replacedMesh(input, [
          [0, 0, 0],
          [1, 0, 0],
          [0, 1, z],
        ]),
      );
      partial(report);
      expect(report.draws[0]!.bounds).toBeNull();
      expect(report.draws[0]!.projectedReferences).toBe(2);
      expect(report.diagnostics[0]!.message).toMatch(/eye\/near/);
    },
  );
  it("retains a far-plane/offscreen envelope as unclipped evidence", () => {
    const { input } = projectedBoundsFixture(true);
    const report = inspectProjectedMeshBounds(
      replacedMesh(input, [
        [-1000, 0, -150],
        [1000, 0, -150],
        [0, 1000, -150],
      ]),
    );
    expect(report.coverage).toBe("complete");
    expect(report.draws[0]!.beyondFarReferences).toBe(3);
    expect(report.draws[0]!.outsideViewportReferences).toBe(3);
  });
  it("rejects large-coordinate cancellation even when double pixels are finite", () => {
    const { input } = projectedBoundsFixture(true);
    const transforms = new Float32Array(identityMatrix);
    transforms[12] = 1e8;
    const matrices = input.snapshot.viewMatrices.slice();
    // Same 1e8 translation in the retained camera; double arithmetic can
    // preserve local detail while the Float32 world shader stage cannot.
    matrices[12] = -1e8;
    matrices[44] = -0.75e8;
    partial(
      inspectProjectedMeshBounds({
        ...input,
        snapshot: { ...input.snapshot, transforms, viewMatrices: matrices },
      }),
    );
  });
  it.each([
    "viewport",
    "scissor",
    "render-target",
    "offset",
    "singular",
    "nonfinite",
  ])("returns partial for unsupported retained view %s", (kind) => {
    const { input } = projectedBoundsFixture();
    let view = input.snapshot.views[0]!;
    const matrices = input.snapshot.viewMatrices.slice();
    if (kind === "viewport") view = { ...view, viewport: [0, 0, 0.5, 1] };
    if (kind === "scissor") view = { ...view, scissor: [0, 0, 1, 0.5] };
    if (kind === "render-target")
      view = { ...view, renderTarget: createRenderTargetHandle("other") };
    if (kind === "offset") view = { ...view, viewProjectionMatrixOffset: 100 };
    if (kind === "singular") matrices.fill(0, 32);
    if (kind === "nonfinite") matrices[32] = Infinity;
    partial(
      inspectProjectedMeshBounds({
        ...input,
        snapshot: { ...input.snapshot, views: [view], viewMatrices: matrices },
      }),
    );
  });
  it("reports empty geometry without artificial infinity bounds and rejects ambiguous/invalid options", () => {
    const { input } = projectedBoundsFixture();
    const empty = inspectProjectedMeshBounds({
      ...input,
      snapshot: { ...input.snapshot, meshDraws: [] },
      scope: { all: true },
    });
    expect(empty.coverage).toBe("empty");
    expect(empty.bounds).toBeNull();
    expect(allFinite(empty)).toBe(true);
    for (const bad of [
      { viewId: undefined },
      { viewId: 999 },
      { target: { width: 0, height: 600 } },
      { scope: {} },
      { scope: { all: true, meshIds: ["mesh.0"] } },
      { limits: { maxVertices: 0 } },
    ])
      expect(() =>
        inspectProjectedMeshBounds({
          ...input,
          ...bad,
        } as ProjectedBoundsInput),
      ).toThrow();
    expect(() =>
      inspectProjectedMeshBounds({
        ...input,
        snapshot: {
          ...input.snapshot,
          views: [...input.snapshot.views, ...input.snapshot.views],
        },
      }),
    ).toThrow(/exactly one/);
  });
});
