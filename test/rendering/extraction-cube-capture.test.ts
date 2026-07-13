import { describe, expect, it } from "vitest";
import {
  AssetRegistry,
  WorldTransform,
  createRenderTargetHandle,
  createRootTransform,
  createWorld,
  registerMetadataComponents,
  registerTransformComponents,
} from "@aperture-engine/simulation";
import {
  Camera,
  CUBE_CAPTURE_FACE_COUNT,
  createCamera,
  createCubeCaptureFaceViewId,
  createRenderExtractionCache,
  createRenderTargetAsset,
  createStableRenderId,
  cubeCaptureFaceViewMatrix,
  extractRenderSnapshot,
  registerRenderAuthoringComponents,
} from "@aperture-engine/render";

// B2 (three.js parity plan): a camera paired with a cube render target emits
// six 90-degree face views per scheduled capture instead of one view.
describe("cube-capture view extraction (B2)", () => {
  it("emits six face views with distinct stable ids and face indices", () => {
    const world = createRuntimeWorld();
    const assets = createCubeTargetAssets("probe");
    const camera = createCaptureCameraEntity(world, {
      renderTargetId: "render-target:probe",
      translation: [1, 2, 3],
    });

    const snapshot = extractRenderSnapshot(world, assets, { frame: 0 });

    expect(snapshot.views).toHaveLength(CUBE_CAPTURE_FACE_COUNT);
    expect(snapshot.report.views).toBe(CUBE_CAPTURE_FACE_COUNT);

    const faces = snapshot.views.map((view) => view.renderTargetFace);

    expect([...faces].sort((a, b) => (a ?? -1) - (b ?? -1))).toEqual([
      0, 1, 2, 3, 4, 5,
    ]);

    const viewIds = new Set(snapshot.views.map((view) => view.viewId));

    expect(viewIds.size).toBe(CUBE_CAPTURE_FACE_COUNT);

    for (const view of snapshot.views) {
      expect(view.camera).toEqual({
        index: camera.index,
        generation: camera.generation,
      });
      expect(view.renderTarget).toEqual(createRenderTargetHandle("probe"));
      // Faces always fill their cube layer.
      expect(view.viewport).toEqual([0, 0, 1, 1]);
      expect(view.scissor).toEqual([0, 0, 1, 1]);
      expect(view.viewId).toBe(
        createCubeCaptureFaceViewId(view.camera, view.renderTargetFace ?? -1),
      );
    }

    // Three matrices per face view.
    expect(snapshot.viewMatrices).toHaveLength(
      CUBE_CAPTURE_FACE_COUNT * 3 * 16,
    );
  });

  it("keeps face view ids collision-free across adjacent capture cameras", () => {
    const cameraA = { index: 5, generation: 1 };
    const cameraB = { index: 6, generation: 1 };
    const ids = new Set<number>();

    for (const camera of [cameraA, cameraB]) {
      for (let face = 0; face < CUBE_CAPTURE_FACE_COUNT; face += 1) {
        ids.add(createCubeCaptureFaceViewId(camera, face));
      }
    }

    expect(ids.size).toBe(2 * CUBE_CAPTURE_FACE_COUNT);
    // Face 0 keeps the plain stable render id.
    expect(createCubeCaptureFaceViewId(cameraA, 0)).toBe(
      createStableRenderId(cameraA),
    );
  });

  it("builds world-axis-aligned face view matrices at the camera position", () => {
    const position: [number, number, number] = [1, -2, 3];
    // Face 1 (-X layer) captures world +X (the captured cube stores the
    // X-mirrored environment; kernels sample with sourceFlipX).
    const matrix = cubeCaptureFaceViewMatrix(position, 1);
    const transformed = transformPoint(matrix, [position[0] + 5, -2, 3]);

    // A point 5 units along the face's forward axis lands on -Z in view space.
    expect(transformed[0]).toBeCloseTo(0);
    expect(transformed[1]).toBeCloseTo(0);
    expect(transformed[2]).toBeCloseTo(-5);

    // Every face basis is a proper rotation (winding-preserving).
    for (let face = 0; face < CUBE_CAPTURE_FACE_COUNT; face += 1) {
      expect(
        rotationDeterminant(cubeCaptureFaceViewMatrix([0, 0, 0], face)),
      ).toBeCloseTo(1);
    }

    expect(() => cubeCaptureFaceViewMatrix(position, 6)).toThrow(RangeError);
  });

  it("schedules captures every N frames with probe priming (cache)", () => {
    const world = createRuntimeWorld();
    const assets = createCubeTargetAssets("probe");
    const cache = createRenderExtractionCache();

    createCaptureCameraEntity(world, {
      renderTargetId: "render-target:probe",
      captureEvery: 2,
    });

    const viewCounts = [1, 2, 3, 4, 5].map(
      (frame) =>
        extractRenderSnapshot(world, assets, { frame, cache }).views.length,
    );

    // Frame 1 primes the never-captured probe; then only even frames fire.
    expect(viewCounts).toEqual([6, 6, 0, 6, 0]);
  });

  it("fires one-shot capture requests exactly once per new request stamp", () => {
    const world = createRuntimeWorld();
    const assets = createCubeTargetAssets("probe");
    const cache = createRenderExtractionCache();
    const camera = createCaptureCameraEntity(world, {
      renderTargetId: "render-target:probe",
      captureEvery: 0,
    });

    // Frame 0 primes; frames 1-2 stay idle (captureEvery 0 = on-demand only).
    expect(
      extractRenderSnapshot(world, assets, { frame: 0, cache }).views,
    ).toHaveLength(6);
    expect(
      extractRenderSnapshot(world, assets, { frame: 1, cache }).views,
    ).toHaveLength(0);

    camera.setValue(Camera, "captureRequestFrame", 2);

    expect(
      extractRenderSnapshot(world, assets, { frame: 2, cache }).views,
    ).toHaveLength(6);
    // The honored stamp does not re-fire.
    expect(
      extractRenderSnapshot(world, assets, { frame: 3, cache }).views,
    ).toHaveLength(0);

    // A new stamp fires once more, even when the frame is already past it.
    camera.setValue(Camera, "captureRequestFrame", 4);

    expect(
      extractRenderSnapshot(world, assets, { frame: 6, cache }).views,
    ).toHaveLength(6);
    expect(
      extractRenderSnapshot(world, assets, { frame: 7, cache }).views,
    ).toHaveLength(0);
  });

  it("falls back to exact-frame requests without a cache (no priming)", () => {
    const world = createRuntimeWorld();
    const assets = createCubeTargetAssets("probe");
    const camera = createCaptureCameraEntity(world, {
      renderTargetId: "render-target:probe",
      captureEvery: 0,
    });

    expect(extractRenderSnapshot(world, assets, { frame: 1 }).views).toEqual(
      [],
    );

    camera.setValue(Camera, "captureRequestFrame", 2);

    expect(
      extractRenderSnapshot(world, assets, { frame: 2 }).views,
    ).toHaveLength(6);
    expect(extractRenderSnapshot(world, assets, { frame: 3 }).views).toEqual(
      [],
    );
  });

  it("keeps 2d targets and missing targets on the single-view path", () => {
    const world = createRuntimeWorld();
    const assets = createCubeTargetAssets("probe");
    const flatTarget = createRenderTargetHandle("flat");

    assets.register(flatTarget);
    assets.markReady(
      flatTarget,
      createRenderTargetAsset({ width: 64, height: 64 }),
    );

    createCaptureCameraEntity(world, {
      renderTargetId: "render-target:flat",
    });
    createCaptureCameraEntity(world, {
      renderTargetId: "render-target:never-registered",
    });

    const snapshot = extractRenderSnapshot(world, assets, { frame: 0 });

    expect(snapshot.views).toHaveLength(2);

    for (const view of snapshot.views) {
      expect(view.renderTargetFace).toBeUndefined();
    }
  });

  it("rejects invalid capture scheduling fields with camera diagnostics", () => {
    const world = createRuntimeWorld();
    const assets = createCubeTargetAssets("probe");

    createCaptureCameraEntity(world, {
      renderTargetId: "render-target:probe",
      captureEvery: -3,
    });

    const snapshot = extractRenderSnapshot(world, assets, { frame: 0 });

    expect(snapshot.views).toHaveLength(0);
    expect(snapshot.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "render.camera.invalidCaptureEvery",
    ]);
  });
});

function createRuntimeWorld(): ReturnType<typeof createWorld> {
  const world = createWorld({ entityCapacity: 16 });

  registerTransformComponents(world);
  registerMetadataComponents(world);
  registerRenderAuthoringComponents(world);
  return world;
}

function createCubeTargetAssets(id: string): AssetRegistry {
  const registry = new AssetRegistry();
  const handle = createRenderTargetHandle(id);

  registry.register(handle);
  registry.markReady(
    handle,
    createRenderTargetAsset({ dimension: "cube", size: 128 }),
  );
  return registry;
}

function createCaptureCameraEntity(
  world: ReturnType<typeof createWorld>,
  input: {
    readonly renderTargetId: string;
    readonly translation?: readonly [number, number, number];
    readonly captureEvery?: number;
  },
) {
  const entity = world.createEntity();
  const root =
    input.translation === undefined
      ? createRootTransform()
      : createRootTransform({ translation: input.translation });

  entity.addComponent(WorldTransform, root.world);
  entity.addComponent(
    Camera,
    createCamera({
      renderTargetId: input.renderTargetId,
      ...(input.captureEvery === undefined
        ? {}
        : { captureEvery: input.captureEvery }),
    }),
  );
  return entity;
}

function transformPoint(
  matrix: ArrayLike<number>,
  point: readonly [number, number, number],
): [number, number, number] {
  const [x, y, z] = point;
  const read = (index: number): number => matrix[index] ?? 0;

  return [
    read(0) * x + read(4) * y + read(8) * z + read(12),
    read(1) * x + read(5) * y + read(9) * z + read(13),
    read(2) * x + read(6) * y + read(10) * z + read(14),
  ];
}

function rotationDeterminant(matrix: ArrayLike<number>): number {
  const read = (index: number): number => matrix[index] ?? 0;

  return (
    read(0) * (read(5) * read(10) - read(6) * read(9)) -
    read(4) * (read(1) * read(10) - read(2) * read(9)) +
    read(8) * (read(1) * read(6) - read(2) * read(5))
  );
}
