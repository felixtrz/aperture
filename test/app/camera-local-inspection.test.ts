import { afterEach, describe, expect, it, vi } from "vitest";
import { createApertureApp, defineApertureConfig } from "@aperture-engine/app";
import {
  AppEntityKey,
  material,
  mesh,
  type CameraLocalInspectionRequest,
  type CameraLocalInspectionResult,
  type CameraLocalInspectionReport,
} from "@aperture-engine/app/systems";
import {
  Camera,
  Mesh,
  MorphTargetWeights,
  type MeshAsset,
} from "@aperture-engine/render";
import {
  LocalTransform,
  Parent,
  createMeshHandle,
  quatLookAt,
  type Entity,
} from "@aperture-engine/simulation";
import { inspectCameraLocal } from "../../packages/app/src/camera-local/inspect.js";
import {
  parseCameraLandmarkJob,
  projectCameraLandmarks,
} from "../../packages/cli/src/camera/landmarks.js";

const apps: Awaited<ReturnType<typeof createApertureApp>>[] = [];
afterEach(() => {
  for (const app of apps.splice(0)) app.dispose();
});
async function harness(
  projection: "perspective" | "orthographic" = "perspective",
) {
  const app = await createApertureApp({
    config: defineApertureConfig({
      mode: "headless",
      render: {
        defaultCamera: false,
        defaultLight: false,
        defaultEnvironment: false,
      },
    }),
    systems: [],
  });
  apps.push(app);
  const camera = app.context.spawn.camera({
    key: "camera.main",
    transform: { translation: [0, 0, 10], lookAt: [0, 0, 0] },
    camera: {
      projection,
      fovYRadians: Math.PI / 2,
      orthographicHeight: 10,
      aspect: 2,
      autoAspect: false,
      near: 1,
      far: 100,
    },
  });
  const root = app.context.spawn.group({ key: "assembly" });
  const handle = app.context.cameras.main;
  const request: CameraLocalInspectionRequest = {
    viewport: { width: 800, height: 400 },
    subjects: [
      {
        name: "assembly",
        entity: ref(root),
        points: [
          { name: "origin", local: [0, 0, 0], target: [400, 200], weight: 2 },
        ],
      },
    ],
  };
  return { app, root, camera, handle, request };
}
function ref(entity: Entity) {
  return { index: entity.index, generation: entity.generation };
}
function report(
  result: CameraLocalInspectionResult,
): CameraLocalInspectionReport {
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
  return result.result;
}
function point(
  request: CameraLocalInspectionRequest,
  local: readonly [number, number, number],
): CameraLocalInspectionRequest {
  return {
    ...request,
    subjects: [{ ...request.subjects[0]!, points: [{ name: "p", local }] }],
  };
}

describe("resolved local camera inspection", () => {
  it.each(["perspective", "orthographic"] as const)(
    "projects %s using extraction matrices, without stepping or changing authored camera fields",
    async (projection) => {
      const { app, root, camera, handle, request } = await harness(projection);
      const parent = app.context.spawn.group({
        transform: {
          translation: [1, 2, -4],
          rotationEulerDegrees: [5, 25, 10],
          scale: [-2, 3, 0.8],
        },
      });
      root.setValue(Parent, "entity", parent);
      root
        .getVectorView(LocalTransform, "rotation")
        .set([0, 0, Math.sin(0.2), Math.cos(0.2)]);
      root.getVectorView(LocalTransform, "translation").set([2, 1, -3]);
      const step = vi.spyOn(app, "step");
      const fields = Array.from(
        camera.getVectorView(LocalTransform, "translation"),
      );
      const result = report(handle.inspectLocal(point(request, [1, 2, 3])));
      const snapshot = app.extract();
      const offset = snapshot.views[0]!.viewProjectionMatrixOffset;
      expect(result.camera.viewProjectionMatrix).toEqual(
        Array.from(snapshot.viewMatrices.subarray(offset, offset + 16)),
      );
      const p = result.subjects[0]!.points[0]!;
      const transform = result.subjects[0]!.worldMatrix;
      expect(p.world).toEqual(
        [0, 1, 2].map(
          (row) =>
            transform[row]! +
            transform[row + 4]! * 2 +
            transform[row + 8]! * 3 +
            transform[row + 12]!,
        ),
      );
      const vp = snapshot.viewMatrices.subarray(offset, offset + 16);
      const clip = [0, 1, 2, 3].map(
        (row) =>
          vp[row]! * p.world[0] +
          vp[row + 4]! * p.world[1] +
          vp[row + 8]! * p.world[2] +
          vp[row + 12]!,
      );
      expect(p.pixel![0]).toBeCloseTo((clip[0]! / clip[3]! + 1) * 400, 8);
      expect(p.pixel![1]).toBeCloseTo((1 - clip[1]! / clip[3]!) * 200, 8);
      expect(step).not.toHaveBeenCalled();
      expect(
        Array.from(camera.getVectorView(LocalTransform, "translation")),
      ).toEqual(fields);
    },
  );

  it("refreshes direct indexed ancestor and camera writes on every call and reports copied targets/residuals", async () => {
    const { root, camera, handle, request } = await harness();
    const first = report(handle.inspectLocal(request));
    expect(first.subjects[0]!.points[0]).toMatchObject({
      world: [0, 0, 0],
      pixel: [400, 200],
      local: [0, 0, 0],
      target: [400, 200],
      weight: 2,
      residual: [0, 0],
      errorPixels: 0,
    });
    root.getVectorView(LocalTransform, "translation")[0] = 2;
    camera.getVectorView(LocalTransform, "translation")[1] = 1;
    const next = report(handle.inspectLocal(request)).subjects[0]!.points[0]!;
    expect(next.world).toEqual([2, 0, 0]);
    expect(next.pixel![0]).toBeCloseTo(440, 4);
    expect(next.pixel![1]).toBeCloseTo(220, 4);
    expect(next.residual).toEqual([next.pixel![0] - 400, next.pixel![1] - 200]);
    expect(next.errorPixels).toBeCloseTo(Math.hypot(40, 20), 4);
    expect(first.subjects[0]!.points[0]!.world).toEqual([0, 0, 0]);
  });

  it.each(["perspective", "orthographic"] as const)(
    "reports ordered face winding under reflected/sheared ancestry with %s",
    async (projection) => {
      const { app, root, handle, request } = await harness(projection);
      const parent = app.context.spawn.group({
        transform: { scale: [-2, 3, 0.5] },
      });
      root.setValue(Parent, "entity", parent);
      root
        .getVectorView(LocalTransform, "rotation")
        .set([0, Math.sin(0.3), 0, Math.cos(0.3)]);
      const input: CameraLocalInspectionRequest = {
        ...request,
        subjects: [
          {
            ...request.subjects[0]!,
            faces: [
              {
                name: "front",
                localTriangle: [
                  [-1, -1, 0],
                  [1, -1, 0],
                  [0, 2, 0],
                ],
              },
              {
                name: "collapsed",
                localTriangle: [
                  [0, 0, 0],
                  [1, 0, 0],
                  [2, 0, 0],
                ],
              },
            ],
          },
        ],
      };
      const faces = report(handle.inspectLocal(input)).subjects[0]!.faces;
      expect(faces[0]!.normal![2]).toBeLessThan(0);
      expect(faces[0]!.facingCosine).toBeLessThan(0);
      expect(faces[1]).toMatchObject({
        status: "degenerate",
        normal: null,
        facingCosine: null,
      });
      parent.getVectorView(LocalTransform, "scale")[0] = 2;
      expect(
        report(handle.inspectLocal(input)).subjects[0]!.faces[0]!.facingCosine,
      ).toBeGreaterThan(0);
    },
  );

  it("keeps outside/behind/eye-plane evidence finite and explicit", async () => {
    const { handle, request } = await harness();
    const input: CameraLocalInspectionRequest = {
      ...request,
      subjects: [
        {
          ...request.subjects[0]!,
          points: [
            { name: "behind", local: [0, 0, 11] },
            { name: "eye", local: [0, 0, 10], target: [1, 2] },
            { name: "outside", local: [100, 0, 0] },
          ],
        },
      ],
    };
    const points = report(handle.inspectLocal(input)).subjects[0]!.points;
    expect(points.every((p) => !p.inFrustum)).toBe(true);
    expect(points[0]!.cameraDepth).toBe(-1);
    expect(points[1]).toMatchObject({
      pixel: null,
      ndc: null,
      residual: null,
      errorPixels: null,
    });
    expect(JSON.stringify(points)).not.toContain("NaN");
  });

  it("keeps extremely large near-eye projections finite or explicitly null throughout the report", async () => {
    const { camera, handle, request } = await harness();
    camera.getVectorView(LocalTransform, "translation").set([0, 0, 0]);
    camera.getVectorView(LocalTransform, "rotation").set([0, 0, 0, 1]);
    camera.setValue(Camera, "aspect", 1);
    const result = report(
      handle.inspectLocal({
        ...request,
        viewport: { width: 1e6, height: 1e6 },
        subjects: [
          {
            ...request.subjects[0]!,
            points: [
              { name: "near-eye", local: [1, 1, -3.5e-303], target: [0, 0] },
              { name: "large-finite", local: [1, 1, -7e-303], target: [0, 0] },
            ],
          },
        ],
      }),
    );
    const measured = result.subjects[0]!.points[0]!;
    expect(measured.pixel).toBeNull();
    expect(measured.residual).toBeNull();
    expect(measured.errorPixels).toBeNull();
    const large = result.subjects[0]!.points[1]!;
    expect(large.pixel!.every(Number.isFinite)).toBe(true);
    expect(large.residual!.every(Number.isFinite)).toBe(true);
    expect(large.errorPixels).toBeGreaterThan(1e307);
    function assertFinite(value: unknown): void {
      if (typeof value === "number") expect(Number.isFinite(value)).toBe(true);
      else if (value !== null && typeof value === "object")
        Object.values(value).forEach(assertFinite);
    }
    assertFinite(result);
  });

  it("projects static descendant source boxes including offscreen meshes and reports unavailable bounds", async () => {
    const { app, root, handle, request } = await harness("orthographic");
    const nested = app.context.spawn.group({
      transform: {
        parent: root,
        translation: [2, 0, 0],
        rotationEulerDegrees: [0, 0, 45],
      },
    });
    const box = app.context.spawn.mesh({
      mesh: mesh.box({ size: [2, 2, 2] }),
      material: material.standard(),
      transform: { parent: nested, translation: [100, 0, 0] },
    });
    const input: CameraLocalInspectionRequest = {
      ...request,
      subjects: [
        {
          ...request.subjects[0]!,
          bounds: { source: "mesh-local-aabb", includeDescendants: true },
        },
      ],
    };
    const result = report(handle.inspectLocal(input)).subjects[0]!.bounds!;
    expect(result.status).toBe("complete");
    expect(result.meshes).toHaveLength(1);
    expect(result.meshes[0]!.entity).toEqual(ref(box));
    expect(result.meshes[0]!.corners).toHaveLength(8);
    expect(result.screenBounds!.min[0]).toBeGreaterThan(800);
    expect(
      report(
        handle.inspectLocal({
          ...input,
          subjects: [
            {
              ...input.subjects[0]!,
              bounds: { source: "mesh-local-aabb", includeDescendants: false },
            },
          ],
        }),
      ).subjects[0]!.bounds!.status,
    ).toBe("empty");
    box.setValue(Mesh, "meshId", "mesh:missing");
    expect(
      report(handle.inspectLocal(input)).subjects[0]!.bounds,
    ).toMatchObject({
      status: "incomplete",
      screenBounds: null,
      diagnostics: [{ code: "aperture.camera.local.boundsUnavailable" }],
    });
  });

  it("suppresses screen bounds at the near plane and labels undeformed bounds", async () => {
    const { app, root, handle, request } = await harness();
    const box = app.context.spawn.mesh({
      mesh: mesh.box({ size: [2, 2, 2] }),
      material: material.standard(),
      transform: { parent: root, translation: [0, 0, 9] },
    });
    box.addComponent(MorphTargetWeights, {
      targetCount: 1,
      weights: new Float32Array([1]),
    });
    const input: CameraLocalInspectionRequest = {
      ...request,
      subjects: [
        {
          ...request.subjects[0]!,
          bounds: { source: "mesh-local-aabb", includeDescendants: true },
        },
      ],
    };
    const bounds = report(handle.inspectLocal(input)).subjects[0]!.bounds!;
    expect(bounds.status).toBe("complete");
    expect(bounds.screenBounds).toBeNull();
    expect(bounds.diagnostics.map((d) => d.code)).toContain(
      "aperture.camera.local.renderedDeformationUnsupported",
    );
    expect(bounds.diagnostics.map((d) => d.code)).toContain(
      "aperture.camera.local.boundsCrossNearPlane",
    );
    const id = box.getValue(Mesh, "meshId")!;
    const asset = app.lowLevel.assets.get<"mesh", MeshAsset>(
      createMeshHandle(id.slice(5)),
    )!.asset!;
    expect(asset.localAabb).toBeDefined();
  });

  it.each(["perspective", "orthographic"] as const)(
    "exports an explicit %s seed accepted by the existing CPU camera job",
    async (projection) => {
      const { handle, request } = await harness(projection);
      const result = report(
        handle.inspectLocal({
          ...request,
          cameraJob: { referenceDistance: 7 },
        }),
      );
      expect(result.cameraJobDiagnostics).toEqual([]);
      expect(result.cameraJob!.camera.lookAt).toEqual([0, 0, 3]);
      const job = parseCameraLandmarkJob(result.cameraJob);
      const projected = projectCameraLandmarks(job);
      for (let i = 0; i < projected.landmarks.length; i++) {
        const actual = result.subjects[0]!.points[i]!.pixel!;
        const analytic = projected.landmarks[i]!.pixel!;
        const engine = projected.enginePrecision.landmarks[i]!.pixel!;
        expect(
          Math.hypot(actual[0] - analytic[0], actual[1] - analytic[1]),
        ).toBeLessThan(0.05);
        expect(
          Math.hypot(actual[0] - engine[0]!, actual[1] - engine[1]!),
        ).toBeLessThan(0.05);
      }
      expect(result.cameraJob!.landmarks[0]).toMatchObject({
        world: [0, 0, 0],
        target: [400, 200],
        weight: 2,
      });
      expect(report(handle.inspectLocal(request)).cameraJob).toBeNull();
    },
  );

  it.each(["perspective", "orthographic"] as const)(
    "checks %s seed fidelity across orbit octants and rejects large-coordinate analytic mismatch",
    async (projection) => {
      const { root, camera, handle, request } = await harness(projection);
      const input = {
        ...point(request, [1, 2, 0]),
        cameraJob: { referenceDistance: 7 },
      };
      for (const azimuth of [-135, -45, 45, 135]) {
        const az = (azimuth * Math.PI) / 180;
        const position = [Math.sin(az) * 10, 4, Math.cos(az) * 10] as const;
        camera.getVectorView(LocalTransform, "translation").set(position);
        camera
          .getVectorView(LocalTransform, "rotation")
          .set(quatLookAt(position, [0, 0, 0]));
        const result = report(handle.inspectLocal(input));
        expect(result.cameraJobDiagnostics).toEqual([]);
        const actual = result.subjects[0]!.points[0]!.pixel!;
        const projected = projectCameraLandmarks(result.cameraJob);
        for (const expected of [
          projected.landmarks[0]!.pixel!,
          projected.enginePrecision.landmarks[0]!.pixel!,
        ])
          expect(
            Math.hypot(actual[0] - expected[0]!, actual[1] - expected[1]!),
          ).toBeLessThan(0.05);
      }
      camera.getVectorView(LocalTransform, "translation").set([1e8, 0, 5]);
      camera.getVectorView(LocalTransform, "rotation").set([0, 0, 0, 1]);
      root.getVectorView(LocalTransform, "translation").set([1e8, 0, 0]);
      camera.setValue(Camera, "fovYRadians", (47 * Math.PI) / 180);
      camera.setValue(Camera, "aspect", 4 / 3);
      const result = report(
        handle.inspectLocal({
          ...input,
          viewport: { width: 1200, height: 900 },
        }),
      );
      expect(result.subjects[0]!.points[0]!.pixel).not.toBeNull();
      expect(result.cameraJob).toBeNull();
      expect(
        result.cameraJobDiagnostics.some((d) =>
          d.message.includes("0.05 pixels"),
        ),
      ).toBe(true);
    },
  );

  it("returns detached inspection and seed arrays instead of retaining caller-owned coordinates", async () => {
    const { handle, request } = await harness();
    const input = { ...request, cameraJob: { referenceDistance: 7 } };
    const result = report(handle.inspectLocal(input));
    const before = JSON.stringify(result);
    (input.viewport as { width: number }).width = 100;
    (input.subjects[0]!.points![0]!.target as unknown as number[])[0] = -500;
    (input.subjects[0]!.points![0]!.local as unknown as number[])[0] = -200;
    expect(JSON.stringify(result)).toBe(before);
    (result.subjects[0]!.points[0]!.world as unknown as number[])[0] = 5;
    expect(result.cameraJob!.landmarks[0]!.world).toEqual([0, 0, 0]);
  });

  it.each(["roll", "scale", "parent", "aspect", "camera-child"] as const)(
    "keeps inspection but diagnoses unsupported %s seed export",
    async (kind) => {
      const { app, root, camera, handle, request } = await harness();
      if (kind === "roll")
        camera
          .getVectorView(LocalTransform, "rotation")
          .set([0, 0, Math.sin(0.1), Math.cos(0.1)]);
      if (kind === "scale")
        camera.getVectorView(LocalTransform, "scale").set([2, 1, 1]);
      if (kind === "parent")
        camera.setValue(Parent, "entity", app.context.spawn.group());
      if (kind === "aspect") camera.setValue(Camera, "aspect", 1);
      if (kind === "camera-child") root.setValue(Parent, "entity", camera);
      const result = report(
        handle.inspectLocal({
          ...request,
          cameraJob: { referenceDistance: 7 },
        }),
      );
      expect(result.subjects[0]!.points).toHaveLength(1);
      expect(result.cameraJob).toBeNull();
      expect(result.cameraJobDiagnostics[0]!.code).toBe(
        "aperture.camera.local.unsupportedJobExport",
      );
    },
  );

  it("uses explicit viewport for auto aspect without mutating camera", async () => {
    const { camera, handle, request } = await harness();
    camera.setValue(Camera, "autoAspect", true);
    const result = report(
      handle.inspectLocal({
        ...request,
        viewport: { width: 300, height: 900 },
      }),
    );
    expect(result.camera.aspect).toBe(Math.fround(1 / 3));
    expect(result.camera.aspectSource).toBe("viewport-auto-aspect");
    expect(camera.getValue(Camera, "aspect")).toBe(2);
  });

  it("rejects stale selectors, duplicate keys, cycles, and singular camera matrices", async () => {
    const { app, root, camera, handle, request } = await harness();
    expect(
      handle.inspectLocal({
        ...request,
        subjects: [
          {
            ...request.subjects[0]!,
            entity: { index: root.index, generation: root.generation + 1 },
          },
        ],
      }).ok,
    ).toBe(false);
    app.context.spawn.group().addComponent(AppEntityKey, { value: "assembly" });
    expect(
      handle.inspectLocal({
        ...request,
        subjects: [{ ...request.subjects[0]!, entity: { key: "assembly" } }],
      }).ok,
    ).toBe(false);
    root.setValue(Parent, "entity", root);
    expect(handle.inspectLocal(request).ok).toBe(false);
    root.setValue(Parent, "entity", null);
    camera.getVectorView(LocalTransform, "scale")[0] = 0;
    expect(handle.inspectLocal(request).ok).toBe(false);
  });

  it("reports unrelated hierarchy failures without invalidating selected geometry", async () => {
    const { app, handle, request } = await harness();
    const unrelated = app.context.spawn.group();
    unrelated.setValue(Parent, "entity", unrelated);
    const result = report(handle.inspectLocal(request));
    expect(result.subjects[0]!.points[0]!.inFrustum).toBe(true);
    expect(result.diagnostics[0]!.code).toContain("unrelatedTransform");
  });

  it.each(["viewport", "scissor", "jitter", "renderTarget"] as const)(
    "rejects unsupported %s cameras explicitly",
    async (kind) => {
      const { camera, handle, request } = await harness();
      if (kind === "viewport" || kind === "scissor")
        camera.getVectorView(Camera, kind).set([0, 0, 0.5, 1]);
      if (kind === "jitter") camera.setValue(Camera, "temporalJitterX", 0.001);
      if (kind === "renderTarget")
        camera.setValue(Camera, "renderTargetId", "renderTarget:target");
      expect(handle.inspectLocal(request).ok).toBe(false);
    },
  );

  it("rejects malformed runtime input and requires explicit camera and export gauge", async () => {
    const { app, request } = await harness();
    const inspect = (
      input: unknown,
      selector: unknown = { key: "camera.main" },
    ) =>
      inspectCameraLocal(
        app.lowLevel.world,
        app.lowLevel.assets,
        selector,
        input,
      );
    for (const input of [
      null,
      { ...request, cameraJob: {} },
      { ...request, cameraJob: { referenceDistance: 0 } },
      { ...request, viewport: { width: 0, height: 400 } },
      { ...request, subjects: [{ ...request.subjects[0], points: null }] },
      {
        ...request,
        subjects: [
          {
            ...request.subjects[0],
            points: [{ name: "p", local: [0, 0, 0], weight: 1 }],
          },
        ],
      },
    ])
      expect(inspect(input).ok).toBe(false);
    expect(inspect(request, null).ok).toBe(false);
  });

  it("locates invalid bounds in a multi-subject request and preserves explicit selection", async () => {
    const { app, root, handle, request } = await harness();
    app.context.spawn.mesh({
      mesh: mesh.box({ size: [2, 2, 2] }),
      material: material.standard(),
      transform: { parent: root },
    });
    const input: CameraLocalInspectionRequest = {
      ...request,
      subjects: ["left", "middle", "right"].map((name) => ({
        name,
        entity: ref(root),
        bounds: { source: "mesh-local-aabb", includeDescendants: false },
      })),
    };
    const expected = handle.inspectLocal(input);
    expect(expected.ok).toBe(true);
    for (const [bounds, field] of [
      [{ source: "mesh-local-aabb" }, "includeDescendants"],
      [
        { source: "mesh-local-aabb", includeDescendants: "false" },
        "includeDescendants",
      ],
      [{ source: "rendered", includeDescendants: false }, "source"],
    ] as const) {
      const invalid = {
        ...input,
        subjects: input.subjects.map((subject, index) =>
          index === 1 ? { ...subject, bounds } : subject,
        ),
      };
      const result = inspectCameraLocal(
        app.lowLevel.world,
        app.lowLevel.assets,
        { key: "camera.main" },
        invalid,
      );
      expect(result).toMatchObject({
        ok: false,
        diagnostics: [
          {
            code: "aperture.camera.local.invalidInspection",
            severity: "error",
            message: expect.stringContaining(
              `subjects[1] ("middle").bounds.${field}`,
            ),
          },
        ],
      });
      expect(handle.inspectLocal(input)).toEqual(expected);
    }
    expect(report(expected).subjects[1]!.bounds!.status).toBe("empty");
    const descendants = report(
      handle.inspectLocal({
        ...input,
        subjects: input.subjects.map((subject, index) =>
          index === 1
            ? {
                ...subject,
                bounds: { source: "mesh-local-aabb", includeDescendants: true },
              }
            : subject,
        ),
      }),
    );
    expect(descendants.subjects[1]!.bounds!.status).toBe("complete");
    expect(descendants.subjects[1]!.bounds!.meshes).toHaveLength(1);
  });
});
