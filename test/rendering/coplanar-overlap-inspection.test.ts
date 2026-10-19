import { describe, expect, it } from "vitest";
import { createApertureApp, defineApertureConfig } from "@aperture-engine/app";
import { createSystem, mesh, material } from "@aperture-engine/app/systems";
import {
  inspectCoplanarMeshOverlaps,
  createUnlitMaterialAsset,
  type MeshAsset,
  type SourceMaterialAsset,
  type CoplanarOverlapReport,
} from "@aperture-engine/render";
import {
  coplanarFixture,
  identityMatrix,
  inspectionMesh,
  rectangle,
  type Position,
} from "../helpers/coplanar-overlap-fixture.js";

const area = (report: CoplanarOverlapReport) =>
  report.findings.reduce((sum, f) => sum + f.area, 0);
const triangle: Position[] = [
  [0, 0, 0],
  [1, 0, 0],
  [0, 1, 0],
];

describe("optional coplanar overlap inspection", () => {
  it("reports analytic overlap area across different triangulations without mutating inputs", () => {
    const { input } = coplanarFixture(),
      before = structuredClone(input.snapshot);
    const report = inspectCoplanarMeshOverlaps(input);
    expect(report.coverage).toBe("complete");
    expect(area(report)).toBeCloseTo(1, 12);
    expect(
      report.findings.every(
        (f) => f.visibility === "unknown" && f.maxPlaneSeparation === 0,
      ),
    ).toBe(true);
    expect(
      report.findings
        .flatMap((f) => f.polygonWorld)
        .every(
          (p) =>
            p[0] >= 1 - 1e-12 &&
            p[0] <= 2 + 1e-12 &&
            p[1] >= 0.5 - 1e-12 &&
            p[1] <= 1.5 + 1e-12 &&
            p[2] === 0,
        ),
    ).toBe(true);
    expect(input.snapshot).toEqual(before);
    expect(
      inspectCoplanarMeshOverlaps({
        ...input,
        snapshot: {
          ...input.snapshot,
          meshDraws: [...input.snapshot.meshDraws].reverse(),
        },
      }),
    ).toEqual(report);
  });
  it.each([
    ["shared edge", rectangle(2, 0, 4, 2)],
    ["shared vertex", rectangle(2, 2, 4, 4)],
    ["separated", rectangle(3, 0, 4, 1)],
    [
      "crossing planes",
      [
        [0, 0, -1],
        [1, 0, 1],
        [0, 1, 0],
      ] as Position[],
    ],
  ])("excludes %s", (_name, positions) => {
    const { input } = coplanarFixture([
      inspectionMesh(rectangle()),
      inspectionMesh(positions),
    ]);
    const report = inspectCoplanarMeshOverlaps(input);
    expect(report.coverage).toBe("complete");
    expect(report.findings).toEqual([]);
  });
  it("retains thin genuine overlap, containment, and reversed winding", () => {
    const thin = coplanarFixture([
      inspectionMesh(rectangle()),
      inspectionMesh(rectangle(1.99999, 0, 3, 2)),
    ]);
    expect(area(inspectCoplanarMeshOverlaps(thin.input))).toBeGreaterThan(
      0.000019,
    );
    const contained = coplanarFixture([
      inspectionMesh(rectangle()),
      inspectionMesh([...triangle].reverse()),
    ]);
    const report = inspectCoplanarMeshOverlaps(contained.input);
    expect(area(report)).toBeCloseTo(0.5, 12);
    expect(report.findings.every((f) => f.normalDot === -1)).toBe(true);
  });
  it("separates plane distance, angle, and minimum-area thresholds", () => {
    const shifted = [...identityMatrix];
    shifted[14] = 0.00001;
    const { input } = coplanarFixture(
      [inspectionMesh(triangle), inspectionMesh(triangle)],
      [identityMatrix, shifted],
    );
    expect(inspectCoplanarMeshOverlaps(input).findings).toEqual([]);
    const report = inspectCoplanarMeshOverlaps({
      ...input,
      tolerances: { distance: 0.00002, relativeDistance: 0 },
    });
    expect(area(report)).toBeCloseTo(0.5, 12);
    expect(report.findings[0]!.maxPlaneSeparation).toBeCloseTo(0.00001, 10);
    expect(
      inspectCoplanarMeshOverlaps({
        ...input,
        tolerances: { distance: 0.00002, minArea: 1 },
      }).findings,
    ).toEqual([]);
    const tilted = [...identityMatrix];
    tilted[6] = 0.01;
    const tiltedInput = coplanarFixture(
      [inspectionMesh(triangle), inspectionMesh(triangle)],
      [identityMatrix, tilted],
    ).input;
    expect(
      inspectCoplanarMeshOverlaps({
        ...tiltedInput,
        tolerances: { distance: 1 },
      }).findings,
    ).toEqual([]);
  });
  it.each([1e-8, 1e-7])(
    "does not widen zero angular tolerance to admit a %s radian tilt",
    (tilt) => {
      const { input } = coplanarFixture([
        inspectionMesh([
          [0, 0, 0],
          [2, 0, 0],
          [0, 2, 0],
        ]),
        inspectionMesh([
          [0, 0, 0],
          [2, 0, 0],
          [0, 2, 2 * tilt],
        ]),
      ]);
      const report = inspectCoplanarMeshOverlaps({
        ...input,
        tolerances: { distance: 1, relativeDistance: 0, angleRadians: 0 },
      });
      expect(report.coverage).toBe("complete");
      expect(report.findings).toEqual([]);
    },
  );
  it.each([
    ["mirror and rotation", [0, 0, 2, 0, 0, 3, 0, 0, 0.5, 0, 0, 0, 3, 4, 5, 1]],
    ["affine shear", [2, 0, 0, 0, 1, 3, 0, 0, 0, 0, 1, 0, 10000, -20000, 3, 1]],
  ])("uses complete resolved matrices for %s", (_name, pose) => {
    const { input } = coplanarFixture(
      [inspectionMesh(triangle), inspectionMesh(triangle)],
      [pose, pose],
    );
    expect(area(inspectCoplanarMeshOverlaps(input))).toBeCloseTo(3, 10);
  });
  it("uses actual ECS parent resolution with rotation and nonuniform scale", async () => {
    const app = await createApertureApp({
      config: defineApertureConfig({
        mode: "headless",
        render: {
          defaultCamera: false,
          defaultLight: false,
          defaultEnvironment: false,
        },
      }),
      systems: [
        {
          default: class Scene extends createSystem() {
            override init(): void {
              this.spawn.camera({
                transform: { translation: [0, 0, 20] },
                camera: { frustumCulling: false },
              });
              const parent = this.spawn.group({
                transform: {
                  translation: [3, 4, 5],
                  rotationEulerDegrees: [25, 47, -12],
                  scale: [2, 3, 0.5],
                },
              });
              for (const [key, x] of [
                ["left", 0],
                ["right", 0.5],
              ] as const)
                this.spawn.mesh({
                  key,
                  mesh: mesh.plane({ size: [1, 1] }),
                  material: material.standard(),
                  transform: { parent, translation: [x, 0, 0] },
                });
            }
          },
        },
      ],
    });
    try {
      app.step(1 / 60, 0);
      const report = inspectCoplanarMeshOverlaps({
        snapshot: app.extract(1),
        scope: { meshIds: ["left.mesh", "right.mesh"] },
        resolveMesh: (h) =>
          app.context.assetsRegistry.get<"mesh", MeshAsset>(h)?.asset ??
          undefined,
        resolveMaterial: (h) =>
          app.context.assetsRegistry.get<"material", SourceMaterialAsset>(h)
            ?.asset ?? undefined,
      });
      expect(report.coverage).toBe("complete");
      expect(area(report)).toBeCloseTo(3, 5);
    } finally {
      await app.dispose();
    }
  });
  it.each([1e10, 1e12, 1e14])(
    "reports unresolved translated coordinates at %s before rejecting uncertain planes",
    (translation) => {
      const pose = [
        0.7071068,
        0.3,
        0.4,
        0,
        -0.2,
        0.8,
        0.1,
        0,
        0.1,
        0.2,
        0.7,
        0,
        translation,
        translation,
        translation,
        1,
      ];
      const { input } = coplanarFixture(
        [
          inspectionMesh([
            [0, 0, 0],
            [2, 0, 0],
            [0, 2, 0],
          ]),
          inspectionMesh([
            [0.5, 0.5, 0],
            [1.5, 0.5, 0],
            [0.5, 1.5, 0],
          ]),
        ],
        [pose, pose],
      );
      // A loose distance tolerance must not hide uncertain angular accuracy.
      for (const distance of [1e-6, 0.1]) {
        const report = inspectCoplanarMeshOverlaps({
          ...input,
          tolerances: { distance },
        });
        expect(report.coverage).toBe("partial");
        expect(
          report.diagnostics.some((d) => d.code === "numerical-precision"),
        ).toBe(true);
      }
    },
  );
  it("diagnoses overflow in derived tolerance instead of emitting nonfinite findings", () => {
    const { input } = coplanarFixture();
    const report = inspectCoplanarMeshOverlaps({
      ...input,
      tolerances: { relativeDistance: 1e308 },
    });
    expect(report.coverage).toBe("partial");
    expect(report.findings).toEqual([]);
    expect(
      report.diagnostics.some((d) => d.code === "numerical-precision"),
    ).toBe(true);
  });
  it.each([0, 1e-20])(
    "reports unresolved affine plane distances below arithmetic precision (%s)",
    (distance) => {
      const pose = [
        0.7071068, 0.3, 0.4, 0, -0.2, 0.8, 0.1, 0, 0.1, 0.2, 0.7, 0, 0, 0, 0, 1,
      ];
      const { input } = coplanarFixture(
        [
          inspectionMesh([
            [0, 0, 0],
            [2, 0, 0],
            [0, 2, 0],
          ]),
          inspectionMesh([
            [0.5, 0.5, 0],
            [1.5, 0.5, 0],
            [0.5, 1.5, 0],
          ]),
        ],
        [pose, pose],
      );
      const report = inspectCoplanarMeshOverlaps({
        ...input,
        tolerances: { distance, relativeDistance: 0 },
      });
      expect(report.coverage).toBe("partial");
      expect(
        report.diagnostics.some((d) => d.code === "numerical-precision"),
      ).toBe(true);
    },
  );
  it("honors indexed draw ranges, position byte offsets, and mixed source topology", () => {
    const positions = [
      ...triangle,
      ...triangle.map(([x, y, z]): Position => [x + 10, y, z]),
    ];
    const base = inspectionMesh(positions, [0, 1, 2, 3, 4, 5]);
    const interleaved: MeshAsset = {
      ...base,
      vertexStreams: [
        {
          id: "interleaved",
          arrayStride: 16,
          vertexCount: 6,
          attributes: [
            { semantic: "POSITION", format: "float32x3", offset: 4 },
          ],
          data: new Float32Array(positions.flatMap((p) => [99, ...p])),
        },
      ],
      submeshes: [
        { ...base.submeshes[0]!, topology: "line-list" },
        { ...base.submeshes[0]! },
      ],
    };
    const { input } = coplanarFixture([interleaved, inspectionMesh(triangle)]);
    const first = {
      ...input.snapshot.meshDraws[0]!,
      submesh: 1,
      indexStart: 3,
      indexCount: 3,
      vertexStart: 3,
    };
    const away = inspectCoplanarMeshOverlaps({
      ...input,
      snapshot: {
        ...input.snapshot,
        meshDraws: [first, input.snapshot.meshDraws[1]!],
      },
    });
    expect(away.coverage).toBe("complete");
    expect(away.findings).toEqual([]);
    const same = inspectCoplanarMeshOverlaps({
      ...input,
      snapshot: {
        ...input.snapshot,
        meshDraws: [{ ...first, indexStart: 0 }, input.snapshot.meshDraws[1]!],
      },
    });
    expect(area(same)).toBeCloseTo(0.5, 12);
    expect(same.findings[0]!.a).toMatchObject({
      submesh: 1,
      triangleOffset: 0,
    });
  });
  it("selects exact entity generations and treats distinct draws of one asset independently", () => {
    const { input } = coplanarFixture([
      inspectionMesh(triangle),
      inspectionMesh(triangle),
    ]);
    const both = {
      ...input,
      snapshot: {
        ...input.snapshot,
        meshDraws: input.snapshot.meshDraws.map((d) => ({
          ...d,
          mesh: input.snapshot.meshDraws[0]!.mesh,
        })),
      },
      scope: { meshIds: ["mesh.0"] },
    };
    expect(area(inspectCoplanarMeshOverlaps(both))).toBe(0.5);
    expect(
      inspectCoplanarMeshOverlaps({
        ...input,
        scope: { entities: [{ index: 0, generation: 1 }] },
      }),
    ).toMatchObject({
      coverage: "partial",
      counts: { selectedDraws: 0 },
      diagnostics: [{ code: "unmatched-selector" }],
    });
    expect(
      inspectCoplanarMeshOverlaps({
        ...input,
        scope: { entities: [{ index: 0, generation: 0 }] },
      }).coverage,
    ).toBe("empty");
    expect(() => inspectCoplanarMeshOverlaps({ ...input, scope: {} })).toThrow(
      /explicit|selectors/,
    );
  });
  it("filters each draw against a view independently and leaves visibility unknown", () => {
    const { input } = coplanarFixture();
    const snapshot = {
      ...input.snapshot,
      views: [
        {
          viewId: 9,
          camera: { index: 9, generation: 0 },
          priority: 0,
          layerMask: 3,
          viewMatrixOffset: 0,
          projectionMatrixOffset: 0,
          viewProjectionMatrixOffset: 0,
          viewport: [0, 0, 1, 1],
          scissor: [0, 0, 1, 1],
          clearColor: [0, 0, 0, 1],
          clearDepth: 1,
          clearStencil: 0,
          renderTarget: null,
        },
      ],
      meshDraws: input.snapshot.meshDraws.map((d, i) => ({
        ...d,
        layerMask: 1 << i,
      })),
    };
    const report = inspectCoplanarMeshOverlaps({
      ...input,
      snapshot,
      viewId: 9,
      resolveMaterial: () =>
        createUnlitMaterialAsset({
          renderState: {
            alphaMode: "blend",
            cullMode: "none",
            depth: { test: true, write: false, compare: "less-equal", bias: 2 },
          },
        }),
    });
    expect(area(report)).toBeCloseTo(1, 12);
    expect(report.findings[0]!.visibility).toBe("unknown");
    expect(report.findings[0]!.a.renderState.depth.bias).toBe(2);
  });
  it.each(["pair", "finding", "draw", "triangle"] as const)(
    "reports the %s budget honestly and deterministically",
    (kind) => {
      const { input } = coplanarFixture();
      const limits = {
        pair: { maxTrianglePairs: 1 },
        finding: { maxFindings: 1 },
        draw: { maxDraws: 1 },
        triangle: { maxTriangles: 1 },
      }[kind];
      const report = inspectCoplanarMeshOverlaps({ ...input, limits });
      expect(report.coverage).toBe("partial");
      expect(report.diagnostics.some((d) => d.code === `${kind}-limit`)).toBe(
        true,
      );
      expect(inspectCoplanarMeshOverlaps({ ...input, limits })).toEqual(report);
      if (kind === "pair") expect(report.counts.trianglePairs).toBe(1);
    },
  );
  it("reports unsupported/invalid data and degeneracy rather than a clean scene", () => {
    const { input } = coplanarFixture();
    const bad = { ...input.snapshot.meshDraws[0]!, boneMatrixOffset: 0 };
    expect(
      inspectCoplanarMeshOverlaps({
        ...input,
        snapshot: {
          ...input.snapshot,
          meshDraws: [bad, input.snapshot.meshDraws[1]!],
        },
      }),
    ).toMatchObject({
      coverage: "partial",
      diagnostics: [{ code: "unsupported-draw" }],
    });
    const invalid = inspectionMesh(triangle, [0, 1, 9]);
    expect(
      inspectCoplanarMeshOverlaps({ ...input, resolveMesh: () => invalid })
        .coverage,
    ).toBe("partial");
    const degenerate = inspectionMesh([
      [0, 0, 0],
      [1, 0, 0],
      [2, 0, 0],
    ]);
    expect(
      inspectCoplanarMeshOverlaps({
        ...input,
        resolveMesh: () => degenerate,
      }).diagnostics.every((d) => d.code === "degenerate-triangles"),
    ).toBe(true);
    expect(() =>
      inspectCoplanarMeshOverlaps({
        ...input,
        limits: { maxTrianglePairs: Infinity },
      }),
    ).toThrow(/Limit/);
  });
  it.each([-1, 3.5, 99])(
    "rejects malformed advertised index count %s before adaptation",
    (indexCount) => {
      const mesh = inspectionMesh(triangle, [0, 1, 2, 0, 1, 2]);
      const invalid: MeshAsset = {
        ...mesh,
        indexBuffer: { ...mesh.indexBuffer!, indexCount },
      };
      const { input } = coplanarFixture([invalid, inspectionMesh(triangle)]);
      const report = inspectCoplanarMeshOverlaps(input);
      expect(report.coverage).toBe("partial");
      expect(report.diagnostics).toEqual([
        expect.objectContaining({
          code: "unsupported-draw",
          message: "Invalid advertised index buffer count.",
        }),
      ]);
      expect(report.findings).toEqual([]);
    },
  );
  it("accepts indexed geometry whose optional advertised count is omitted", () => {
    const mesh = inspectionMesh(triangle, [0, 1, 2]);
    const indexed: MeshAsset = {
      ...mesh,
      indexBuffer: {
        format: mesh.indexBuffer!.format,
        data: mesh.indexBuffer!.data,
      },
    };
    const { input } = coplanarFixture([indexed, inspectionMesh(triangle)]);
    const report = inspectCoplanarMeshOverlaps(input);
    expect(report.coverage).toBe("complete");
    expect(area(report)).toBeCloseTo(0.5, 12);
  });
  it("charges attempted triangles when a draw fails near its end", () => {
    const invalid = inspectionMesh(triangle, [0, 1, 2, 0, 1, 99]);
    const { input } = coplanarFixture([invalid, inspectionMesh(triangle)]);
    const report = inspectCoplanarMeshOverlaps({
      ...input,
      limits: { maxTriangles: 2 },
    });
    expect(report.counts.triangles).toBe(2);
    expect(report.counts.inspectedDraws).toBe(0);
    expect(report.diagnostics.map((d) => d.code)).toEqual([
      "unsupported-draw",
      "triangle-limit",
    ]);
  });
});
