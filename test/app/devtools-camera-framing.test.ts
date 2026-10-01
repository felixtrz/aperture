import { describe, expect, it } from "vitest";
import { createApertureApp, defineApertureConfig } from "@aperture-engine/app";
import { createApertureDevtoolsRequest } from "@aperture-engine/app/commands";
import { AppEntityKey, material, mesh } from "@aperture-engine/app/systems";
import {
  Camera,
  Mesh,
  type MeshAsset,
  type RenderSnapshot,
} from "@aperture-engine/render";
import {
  LocalTransform,
  Parent,
  WorldTransform,
  createRootTransform,
  createMeshHandle,
  resolveWorldTransforms,
  type Entity,
} from "@aperture-engine/simulation";
import {
  callCameraTool,
  type CameraToolState,
} from "../../packages/app/src/devtools/camera.js";
import type { CameraFramingReport } from "../../packages/app/src/devtools/camera-framing.js";

async function harness(
  aspect = 1,
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
  const camera = app.context.spawn.camera({
    key: "camera.agent",
    transform: { translation: [0, 0, 5], lookAt: [0, 0, 0] },
    camera: { aspect, autoAspect: false, projection },
  });
  const saved = new Map<string, CameraToolState>();
  const call = (tool: string, payload: Record<string, unknown> = {}) =>
    callCameraTool(
      app,
      createApertureDevtoolsRequest({ requestId: "framing", tool, payload }),
      saved,
    );
  const box = (
    size: readonly [number, number, number],
    key = "subject",
    parent?: Entity,
  ) =>
    app.context.spawn.mesh({
      key,
      mesh: mesh.box({ size }),
      material: material.standard(),
      transform: { ...(parent === undefined ? {} : { parent }) },
    });
  return { app, camera, call, box };
}

function framing(value: unknown): CameraFramingReport {
  return (value as { framing: CameraFramingReport }).framing;
}
function corners(min: readonly number[], max: readonly number[]): number[][] {
  return Array.from({ length: 8 }, (_, bits) =>
    [0, 1, 2].map((axis) =>
      (bits & (1 << axis)) === 0 ? min[axis]! : max[axis]!,
    ),
  );
}
function project(snapshot: RenderSnapshot, point: readonly number[]): number[] {
  const offset = snapshot.views[0]!.viewProjectionMatrixOffset;
  const matrix = snapshot.viewMatrices.subarray(offset, offset + 16);
  const clip = [0, 1, 2, 3].map(
    (row) =>
      matrix[row]! * point[0]! +
      matrix[4 + row]! * point[1]! +
      matrix[8 + row]! * point[2]! +
      matrix[12 + row]!,
  );
  return [
    clip[0]! / clip[3]!,
    clip[1]! / clip[3]!,
    clip[2]! / clip[3]!,
    clip[3]!,
  ];
}
function expectContained(
  snapshot: RenderSnapshot,
  report: CameraFramingReport,
): void {
  for (const corner of corners(report.bounds.min, report.bounds.max)) {
    const [x, y, z, w] = project(snapshot, corner);
    expect(w).toBeGreaterThan(0);
    expect(Math.abs(x!)).toBeLessThanOrEqual(1 / report.padding + 0.00002);
    expect(Math.abs(y!)).toBeLessThanOrEqual(1 / report.padding + 0.00002);
    expect(z).toBeGreaterThanOrEqual(0);
    expect(z).toBeLessThanOrEqual(1);
  }
}

const framingCases = [
  { name: "unit cube", size: [1, 1, 1], aspect: 1, legacyContains: true },
  { name: "large cube", size: [20, 20, 20], aspect: 1, legacyContains: false },
  {
    name: "tall product",
    size: [2, 20, 2],
    aspect: 1.5,
    legacyContains: false,
  },
  {
    name: "wide product in portrait",
    size: [20, 2, 2],
    aspect: 0.5,
    legacyContains: false,
  },
  {
    name: "tiny prop",
    size: [0.01, 0.01, 0.01],
    aspect: 1,
    legacyContains: true,
  },
  { name: "deep assembly", size: [2, 2, 20], aspect: 1, legacyContains: false },
] as const;

describe("bounds-aware camera framing", () => {
  it.each(framingCases)(
    "baseline: fixed-radius fit for $name",
    async ({ size, aspect, legacyContains }) => {
      const { app, call, box } = await harness(aspect);
      const subject = box(size);
      resolveWorldTransforms(app.lowLevel.world);
      const result = call("camera_fit_entity", {
        key: "camera.agent",
        entity: { index: subject.index, generation: subject.generation },
        yawDegrees: 0,
        pitchDegrees: 0,
      });
      expect(result.ok).toBe(true);
      const translation = (
        result.result as { localTransform: { translation: number[] } }
      ).localTransform.translation;
      expect(translation).toEqual([0, 0, 5]);
      // Isolate distance adequacy from legacy camera rotation behavior. This is
      // an analytic authoring baseline, not a screenshot or renderer claim.
      const requiredDistance =
        size[2] / 2 +
        Math.max(
          size[0] / (2 * aspect * Math.tan(Math.PI / 6)),
          size[1] / (2 * Math.tan(Math.PI / 6)),
        );
      expect(translation[2]! >= requiredDistance).toBe(legacyContains);
      app.dispose();
    },
  );

  it.each(framingCases)(
    "frames $name in one call using actual extracted projection",
    async ({ size, aspect }) => {
      const { app, call, box } = await harness(aspect);
      box(size);
      const result = call("camera_frame_entities", {
        subjects: [{ key: "subject" }],
      });
      expect(result.ok).toBe(true);
      const report = framing(result.result);
      expect(report).toMatchObject({
        source: "mesh-local-aabb",
        approximation: "static-mesh-bounds",
        aspect,
        padding: 1.1,
      });
      resolveWorldTransforms(app.lowLevel.world);
      expectContained(app.extract(), report);
      app.dispose();
    },
  );

  it.each(["perspective", "orthographic"] as const)(
    "frames nested, rotated, negatively scaled groups with %s projection",
    async (projection) => {
      const { app, camera, call, box } = await harness(0.6, projection);
      const root = app.lowLevel.world.createEntity();
      root.addComponent(AppEntityKey, { value: "assembly" });
      const transform = createRootTransform({
        translation: [40, -10, 30],
        scale: [-2, 3, 0.5],
        rotation: [0, Math.sin(Math.PI / 8), 0, Math.cos(Math.PI / 8)],
      });
      root.addComponent(LocalTransform, transform.local);
      root.addComponent(WorldTransform, transform.world);
      const first = box([3, 2, 1], "part.a", root);
      first.getVectorView(LocalTransform, "translation").set([-4, 1, 0]);
      const second = box([1, 4, 2], "part.b", first);
      second.getVectorView(LocalTransform, "translation").set([8, 0, -5]);
      // Both selectors overlap; each descendant mesh must be counted once.
      const result = call("camera_frame_entities", {
        subjects: [{ key: "assembly" }, { key: "part.a" }],
        yawDegrees: -65,
        pitchDegrees: 35,
        padding: 1.2,
      });
      expect(result.ok).toBe(true);
      const report = framing(result.result);
      expect(report.meshes).toHaveLength(2);
      expect(report.projection).toBe(projection);
      expect(camera.getValue(Camera, "near")).toBeCloseTo(report.near);
      resolveWorldTransforms(app.lowLevel.world);
      expectContained(app.extract(), report);
      app.dispose();
    },
  );

  it("frames disjoint subjects and accepts generation-checked references", async () => {
    const { app, call, box } = await harness();
    const a = box([2, 2, 2], "a");
    const b = box([2, 2, 2], "b");
    a.getVectorView(LocalTransform, "translation").set([-20, 0, 0]);
    b.getVectorView(LocalTransform, "translation").set([20, 0, 0]);
    const result = call("camera_frame_entities", {
      subjects: [{ index: a.index, generation: a.generation }, { key: "b" }],
      yawDegrees: 0,
      pitchDegrees: 0,
    });
    expect(result.ok).toBe(true);
    const report = framing(result.result);
    expect(report.bounds).toEqual({ min: [-21, -1, -1], max: [21, 1, 1] });
    resolveWorldTransforms(app.lowLevel.world);
    expectContained(app.extract(), report);
    app.dispose();
  });

  it.each([
    { subjects: [] },
    { subjects: [{ key: "missing" }] },
    { subjects: [{ index: 0.5, generation: 0 }] },
    { subjects: [{ key: "subject" }], padding: 0.5 },
    { subjects: [{ key: "subject" }], padding: Number.NaN },
    { subjects: [{ key: "subject" }], pitchDegrees: 90 },
    { subjects: [{ key: "subject" }], includeDescendants: "yes" },
    { subjects: [{ key: "subject" }], entity: { index: "100", generation: 0 } },
    { subjects: [{ key: "subject" }], entity: null },
    { subjects: [{ key: "subject" }], key: "" },
    {
      subjects: [{ key: "subject" }],
      key: "camera.agent",
      entity: { index: 0, generation: 0 },
    },
  ])(
    "rejects invalid requests without changing the camera: %j",
    async (payload) => {
      const { app, call, box } = await harness();
      box([1, 1, 1]);
      const before = call("camera_get").result;
      const result = call("camera_frame_entities", payload);
      expect(result.ok).toBe(false);
      expect(result.diagnostics).toHaveLength(1);
      expect(call("camera_get").result).toEqual(before);
      app.dispose();
    },
  );

  it("rejects empty groups, stale refs and parented inspection cameras", async () => {
    const { app, camera, call, box } = await harness();
    const subject = box([1, 1, 1]);
    const empty = app.lowLevel.world.createEntity();
    empty.addComponent(AppEntityKey, { value: "empty" });
    expect(
      call("camera_frame_entities", { subjects: [{ key: "empty" }] }),
    ).toMatchObject({
      ok: false,
      diagnostics: [{ code: "aperture.camera.framing.emptyBounds" }],
    });
    expect(
      call("camera_frame_entities", {
        subjects: [
          { index: subject.index, generation: subject.generation + 1 },
        ],
      }).ok,
    ).toBe(false);
    camera.setValue(Parent, "entity", subject);
    expect(
      call("camera_frame_entities", { subjects: [{ key: "subject" }] }),
    ).toMatchObject({
      ok: false,
      diagnostics: [{ code: "aperture.camera.framing.parentedCamera" }],
    });
    app.dispose();
  });
  it("returns an immediately extractable camera pose without advancing user systems", async () => {
    const { app, call, box } = await harness();
    box([20, 20, 20]);
    const result = call("camera_frame_entities", {
      subjects: [{ key: "subject" }],
    });
    expect(result.ok).toBe(true);
    const report = framing(result.result);
    expect(result.result).toMatchObject({
      worldTransform: { col3: [...report.translation, 1] },
    });
    expectContained(app.extract(), report);
    app.dispose();
  });

  it.each(["perspective", "orthographic"] as const)(
    "keeps the intended camera basis near poles for %s",
    async (projection) => {
      const { app, call, box } = await harness(4, projection);
      box([1, 1, 100]);
      for (const pitchDegrees of [-89.999999, 89.999999]) {
        const result = call("camera_frame_entities", {
          subjects: [{ key: "subject" }],
          yawDegrees: 90,
          pitchDegrees,
        });
        expect(result.ok).toBe(true);
        expectContained(app.extract(), framing(result.result));
      }
      app.dispose();
    },
  );

  it.each([1e6, 1e7])(
    "rejects precision-unsafe distant subjects at %s without authored camera changes",
    async (coordinate) => {
      const { app, call, box } = await harness();
      const subject = box([2, 2, 2]);
      subject
        .getVectorView(LocalTransform, "translation")
        .set([coordinate, coordinate, coordinate]);
      const before = call("camera_get").result as Record<string, unknown>;
      expect(
        call("camera_frame_entities", { subjects: [{ key: "subject" }] }),
      ).toMatchObject({
        ok: false,
        diagnostics: [{ code: "aperture.camera.framing.precisionLoss" }],
      });
      const after = call("camera_get").result as Record<string, unknown>;
      expect(after["camera"]).toEqual(before["camera"]);
      expect(after["localTransform"]).toEqual(before["localTransform"]);
      app.dispose();
    },
  );

  it("rejects a broken ancestor hierarchy even when the selected leaf has transforms", async () => {
    const { app, call, box } = await harness();
    const bare = app.lowLevel.world.createEntity();
    const group = app.lowLevel.world.createEntity();
    group.addComponent(LocalTransform);
    group.addComponent(WorldTransform);
    group.addComponent(Parent, { entity: bare });
    box([2, 2, 2], "subject", group);
    expect(
      call("camera_frame_entities", { subjects: [{ key: "subject" }] }),
    ).toMatchObject({
      ok: false,
      diagnostics: [{ code: "aperture.camera.framing.invalidTransform" }],
    });
    app.dispose();
  });

  it("fits an initially culled subject without using extracted visibility", async () => {
    const { app, call, box } = await harness();
    const subject = box([2, 2, 2]);
    subject.getVectorView(LocalTransform, "translation").set([100, 0, 0]);
    resolveWorldTransforms(app.lowLevel.world);
    expect(app.extract().meshDraws).toHaveLength(0);
    const result = call("camera_frame_entities", {
      subjects: [{ key: "subject" }],
    });
    expect(result.ok).toBe(true);
    const snapshot = app.extract();
    expect(snapshot.meshDraws).toHaveLength(1);
    expectContained(snapshot, framing(result.result));
    app.dispose();
  });

  it("excludes descendants when requested and is idempotent across repeated fits", async () => {
    const { app, call, box } = await harness();
    const root = box([2, 2, 2]);
    const child = box([20, 20, 20], "child", root);
    child.getVectorView(LocalTransform, "translation").set([30, 0, 0]);
    const options = {
      subjects: [{ key: "subject" }],
      includeDescendants: false,
    };
    const first = call("camera_frame_entities", options);
    expect(first.ok).toBe(true);
    expect(framing(first.result).meshes).toHaveLength(1);
    expect(framing(first.result).bounds).toEqual({
      min: [-1, -1, -1],
      max: [1, 1, 1],
    });
    expect(call("camera_frame_entities", options)).toEqual(first);
    app.dispose();
  });

  it("rejects invalid or unavailable source mesh bounds and collapsed geometry", async () => {
    const { app, call, box } = await harness();
    const subject = box([2, 2, 2]);
    const meshId = subject.getValue(Mesh, "meshId")!;
    const handle = createMeshHandle(meshId.slice(5));
    const asset = app.lowLevel.assets.get<"mesh", MeshAsset>(handle)!.asset!;
    const before = call("camera_get").result as Record<string, unknown>;
    for (const localAabb of [
      { min: [1, 1, 1], max: [-1, -1, -1] },
      { min: [NaN, -1, -1], max: [1, 1, 1] },
    ]) {
      app.lowLevel.assets.markReady(handle, { ...asset, localAabb });
      expect(
        call("camera_frame_entities", { subjects: [{ key: "subject" }] }),
      ).toMatchObject({
        ok: false,
        diagnostics: [{ code: "aperture.camera.framing.invalidBounds" }],
      });
    }
    subject.setValue(Mesh, "meshId", "mesh:unavailable");
    expect(
      call("camera_frame_entities", { subjects: [{ key: "subject" }] }),
    ).toMatchObject({
      ok: false,
      diagnostics: [{ code: "aperture.camera.framing.meshNotReady" }],
    });
    subject.setValue(Mesh, "meshId", meshId);
    app.lowLevel.assets.markReady(handle, asset);
    subject.getVectorView(LocalTransform, "scale").set([0, 0, 0]);
    expect(
      call("camera_frame_entities", { subjects: [{ key: "subject" }] }),
    ).toMatchObject({
      ok: false,
      diagnostics: [{ code: "aperture.camera.framing.emptyBounds" }],
    });
    const after = call("camera_get").result as Record<string, unknown>;
    expect(after["localTransform"]).toEqual(before["localTransform"]);
    expect(after["camera"]).toEqual(before["camera"]);
    app.dispose();
  });

  it.each(["perspective", "orthographic"] as const)(
    "contains a deterministic 48-case size/aspect/angle grid for %s",
    async (projection) => {
      const { app, camera, call, box } = await harness(1, projection);
      let seed = 1729;
      const next = () => {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        return seed / 2 ** 32;
      };
      for (let index = 0; index < 48; index += 1) {
        camera.setValue(Camera, "aspect", 0.25 + next() * 3.75);
        camera.setValue(
          Camera,
          "fovYRadians",
          ((20 + next() * 100) * Math.PI) / 180,
        );
        const subject = box([
          0.5 + next() * 25,
          0.5 + next() * 25,
          0.5 + next() * 25,
        ]);
        subject
          .getVectorView(LocalTransform, "translation")
          .set([next() * 60 - 30, next() * 60 - 30, next() * 60 - 30]);
        const result = call("camera_frame_entities", {
          subjects: [{ index: subject.index, generation: subject.generation }],
          yawDegrees: next() * 720 - 360,
          pitchDegrees: next() * 179 - 89.5,
          padding: 1 + next(),
        });
        expect(result.ok, JSON.stringify(result)).toBe(true);
        expectContained(app.extract(), framing(result.result));
        subject.destroy();
      }
      app.dispose();
    },
  );
  it.each([0.0001, 0.01, 1, 10000])(
    "uses the requested screen-space margin consistently at scale %s",
    async (size) => {
      const { app, call, box } = await harness();
      box([size, size, size]);
      const result = call("camera_frame_entities", {
        subjects: [{ key: "subject" }],
        padding: 1.1,
      });
      expect(result.ok).toBe(true);
      const report = framing(result.result);
      expectContained(app.extract(), report);
      expect(
        Math.max(
          report.projectionCheck.maxAbsNdcX,
          report.projectionCheck.maxAbsNdcY,
        ),
      ).toBeCloseTo(1 / 1.1, 4);
      app.dispose();
    },
  );

  it("rejects camera-dependent subjects before moving their ancestor camera", async () => {
    const { app, camera, call, box } = await harness();
    const subject = box([20, 2, 2], "subject", camera);
    subject.getVectorView(LocalTransform, "translation").set([0, 0, -5]);
    const before = call("camera_get").result as Record<string, unknown>;
    expect(
      call("camera_frame_entities", {
        subjects: [{ key: "subject" }],
        yawDegrees: 0,
        pitchDegrees: 0,
      }),
    ).toMatchObject({
      ok: false,
      diagnostics: [{ code: "aperture.camera.framing.cameraDependentSubject" }],
    });
    const after = call("camera_get").result as Record<string, unknown>;
    expect(after["localTransform"]).toEqual(before["localTransform"]);
    expect(after["camera"]).toEqual(before["camera"]);
    app.dispose();
  });
});
