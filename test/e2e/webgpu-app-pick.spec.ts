import { expect, test } from "@playwright/test";

test("public app.pick returns an ECS entity ref from the ID buffer", async ({
  page,
}) => {
  await page.goto("/examples/triangle.html");

  const result = await page.evaluate(async () => {
    if (navigator.gpu === undefined) {
      return { ok: false, reason: "webgpu-unavailable" };
    }

    const canvas =
      document.querySelector<HTMLCanvasElement>("#aperture-canvas");

    if (canvas === null) {
      return { ok: false, reason: "canvas-unavailable" };
    }

    canvas.width = 320;
    canvas.height = 240;

    const [core, webgpu] = await Promise.all([
      Promise.all([
        import("@aperture-engine/simulation"),
        import("@aperture-engine/render"),
        import("@aperture-engine/runtime"),
      ]).then(([simulation, render, runtime]) => ({
        ...simulation,
        ...render,
        ...runtime,
      })),
      import("@aperture-engine/webgpu"),
    ]);
    const assets = new core.AssetRegistry();
    const world = core.createWorld({ entityCapacity: 8 });
    const meshHandle = core.createMeshHandle("pick-triangle");
    const materialHandle = core.createMaterialHandle("pick-triangle");

    core.registerTransformComponents(world);
    core.registerMetadataComponents(world);
    core.registerRenderAuthoringComponents(world);
    assets.register(meshHandle);
    assets.register(materialHandle);
    assets.markReady(meshHandle, createTriangleMesh());
    assets.markReady(
      materialHandle,
      core.createUnlitMaterialAsset({
        label: "PickTriangle",
        baseColorFactor: new Float32Array([1, 0.2, 0.1, 1]),
      }),
    );

    const camera = world.createEntity();

    camera.addComponent(
      core.WorldTransform,
      core.createRootTransform({ translation: [0, 0, 2.5] }).world,
    );
    camera.addComponent(
      core.Camera,
      core.createCamera({
        aspect: canvas.width / canvas.height,
        near: 0.1,
        far: 100,
        clearColor: [0.015, 0.025, 0.035, 1],
        layerMask: 1,
      }),
    );

    const triangle = world.createEntity();

    triangle.addComponent(
      core.WorldTransform,
      core.createRootTransform().world,
    );
    triangle.addComponent(core.Mesh, {
      meshId: core.assetHandleKey(meshHandle),
    });
    triangle.addComponent(core.Material, {
      materialId: core.assetHandleKey(materialHandle),
    });
    triangle.addComponent(core.RenderLayer, { mask: 1 });
    triangle.addComponent(core.Visibility);

    const snapshot = core.extractRenderSnapshot(world, assets, { frame: 1 });
    const expected = snapshot.meshDraws[0]?.entity ?? null;
    const created = await webgpu.createWebGpuApp({
      canvas: canvas as unknown as Parameters<
        typeof webgpu.createWebGpuApp
      >[0]["canvas"],
      sourceAssets: assets,
      simulationWorker: {
        start() {},
        onSnapshot() {
          return () => {};
        },
        onError() {
          return () => {};
        },
      },
    });

    if (!created.ok) {
      return {
        ok: false,
        reason: created.reason,
        message: created.message,
      };
    }

    const report = await created.app.renderSnapshot(snapshot, { frame: 1 });
    const picked = await created.app.pick(canvas.width / 2, canvas.height / 2);
    const centerPick = created.app.getDiagnostics().lastPick;
    const empty = await created.app.pick(2, 2);
    const emptyPick = created.app.getDiagnostics().lastPick;

    return {
      ok: true,
      renderOk: report.ok,
      expected,
      picked,
      empty,
      centerPick,
      emptyPick,
      drawCount: snapshot.meshDraws.length,
      diagnostics: report.diagnostics,
    };

    function createTriangleMesh() {
      return {
        kind: "mesh" as const,
        label: "PickTriangle",
        vertexStreams: [
          {
            id: "primitive-interleaved",
            arrayStride: 32,
            vertexCount: 3,
            attributes: [
              {
                semantic: "POSITION" as const,
                format: "float32x3" as const,
                offset: 0,
              },
              {
                semantic: "NORMAL" as const,
                format: "float32x3" as const,
                offset: 12,
              },
              {
                semantic: "TEXCOORD_0" as const,
                format: "float32x2" as const,
                offset: 24,
              },
            ],
            data: new Float32Array([
              0, 0.72, 0, 0, 0, 1, 0.5, 0, -0.72, -0.55, 0, 0, 0, 1, 0, 1, 0.72,
              -0.55, 0, 0, 0, 1, 1, 1,
            ]),
          },
        ],
        indexBuffer: {
          format: "uint16" as const,
          data: new Uint16Array([0, 1, 2]),
        },
        submeshes: [
          {
            label: "default",
            topology: "triangle-list" as const,
            materialSlot: 0,
            vertexStart: 0,
            vertexCount: 3,
            indexStart: 0,
            indexCount: 3,
          },
        ],
        materialSlots: [{ index: 0, label: "default" }],
        localAabb: { min: [-0.72, -0.55, 0], max: [0.72, 0.72, 0] },
        localSphere: { center: [0, 0, 0], radius: 0.9 },
      };
    }
  });

  if (!result.ok && result.reason === "webgpu-unavailable") {
    test.skip(true, "WebGPU is not available in this browser.");
  }

  if (!result.ok) {
    expect(result).toMatchObject({ ok: true });
    return;
  }

  expect(result.renderOk, JSON.stringify(result, null, 2)).toBe(true);
  expect(result.drawCount).toBe(1);
  expect(result.picked, JSON.stringify(result, null, 2)).toEqual(
    result.expected,
  );
  expect(result.empty).toBeNull();
  expect(result.centerPick).toMatchObject({
    ok: true,
    entity: result.expected,
  });
  expect(result.emptyPick).toMatchObject({
    ok: false,
    entity: null,
  });
});
