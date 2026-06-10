import { expect, test } from "@playwright/test";
import type {
  WebGpuCanvasLike,
  WebGpuPostEffect,
} from "@aperture-engine/webgpu/test-support";

test("no-op post effect preserves rendered output through the app path", async ({
  page,
}) => {
  await page.goto("/examples/triangle.html");

  const result = await page.evaluate(async () => {
    if (navigator.gpu === undefined) {
      return { ok: false, reason: "webgpu-unavailable" };
    }

    const adapter = await navigator.gpu.requestAdapter();

    if (adapter === null) {
      return { ok: false, reason: "adapter-unavailable" };
    }

    const core = await Promise.all([
      import("@aperture-engine/simulation"),
      import("@aperture-engine/render"),
      import("@aperture-engine/runtime"),
    ]).then(([simulation, render, runtime]) => ({
      ...simulation,
      ...render,
      ...runtime,
    }));
    const webgpu = await import("@aperture-engine/webgpu/test-support");

    async function renderSample(postEffects: readonly WebGpuPostEffect[] = []) {
      const canvas = document.createElement("canvas");

      canvas.width = 128;
      canvas.height = 128;
      document.body.append(canvas);

      const extraction = core.createExtractionApp({
        worldOptions: { entityCapacity: 8 },
      });
      const assets = core.createRenderAssetCollections({
        registry: extraction.assets,
      });
      const mesh = assets.meshes.add(
        core.createPlaneMeshAsset({
          label: "PostPlane",
          width: 2.5,
          height: 2.5,
        }),
      );
      const material = assets.materials.unlit.add(
        core.createUnlitMaterialAsset({
          label: "PostWhite",
          baseColorFactor: [0.9, 0.2, 0.1, 1],
          renderState: { cullMode: "none" },
        }),
      );

      extraction.spawn(
        core.withTransform({ translation: [0, 0, 2.5] }),
        core.withCamera({
          priority: 0,
          layerMask: 1,
          clearColor: [0.2, 0.4, 0.6, 1],
        }),
      );
      extraction.spawn(
        core.withTransform(),
        core.withMesh(mesh),
        core.withMaterial(material),
        core.withRenderLayer(1),
        core.withVisibility(true),
      );

      const created = await webgpu.createWebGpuApp({
        canvas: canvas as unknown as WebGpuCanvasLike,
        simulationWorker: {
          start() {},
          onSnapshot() {
            return () => {};
          },
          onError() {
            return () => {};
          },
        },
        sourceAssets: extraction.assets,
        postEffects,
      });

      if (!created.ok) {
        canvas.remove();
        return { ok: false, reason: created.reason, message: created.message };
      }

      const report = await created.app.renderSnapshot(
        extraction.stepAndExtract(1 / 60, 1, 1),
        {
          readbackSamples: [{ id: "center", x: 0.5, y: 0.5 }],
        },
      );
      const pixel =
        report.readback?.ok === true ? report.readback.samples[0]?.pixel : null;

      created.app.stop();
      canvas.remove();

      return {
        ok: report.ok,
        counts: report.counts,
        postEffects: report.postEffects ?? [],
        pixel,
        diagnostics: report.diagnostics,
        readback: report.readback,
      };
    }

    const direct = await renderSample();
    const post = await renderSample([webgpu.createWebGpuCopyPostEffect()]);

    return { ok: true, direct, post };
  });

  if (!result.ok && result.reason === "webgpu-unavailable") {
    test.skip(true, "WebGPU is not available in this browser.");
  }

  if (!result.ok && result.reason === "adapter-unavailable") {
    test.skip(true, "WebGPU adapter is not available.");
  }

  if (!result.ok) {
    expect(result).toMatchObject({ ok: true });
    return;
  }

  expect(result.direct).toBeDefined();
  expect(result.post).toBeDefined();

  if (result.direct === undefined || result.post === undefined) {
    return;
  }

  expect(result.direct).toMatchObject({
    ok: true,
    counts: { drawCalls: 1 },
  });
  expect(result.post).toMatchObject({
    ok: true,
    counts: { drawCalls: 2 },
    postEffects: [{ effectId: "copy", ok: true, output: "swapchain" }],
  });
  expect(result.direct.readback).toMatchObject({ ok: true });
  expect(result.post.readback).toMatchObject({ ok: true });
  expect(result.post.pixel).toEqual(result.direct.pixel);
});

test("FXAA post effect softens a high-contrast texture edge", async ({
  page,
}) => {
  await page.goto("/examples/triangle.html");

  const result = await page.evaluate(async () => {
    if (navigator.gpu === undefined) {
      return { ok: false, reason: "webgpu-unavailable" };
    }

    const adapter = await navigator.gpu.requestAdapter();

    if (adapter === null) {
      return { ok: false, reason: "adapter-unavailable" };
    }

    const device = await adapter.requestDevice();
    const {
      assembleFrameBoundary,
      createWebGpuCopyPostEffect,
      createWebGpuFxaaPostEffect,
      mapFrameBoundaryReadbackSamples,
    } = await import("@aperture-engine/webgpu/test-support");
    const usage = {
      COPY_SRC: 0x01,
      COPY_DST: 0x02,
      TEXTURE_BINDING: 0x04,
      RENDER_ATTACHMENT: 0x10,
    };
    const width = 16;
    const height = 16;
    const format = "rgba8unorm";
    const bytesPerRow = 256;
    const source = new Uint8Array(bytesPerRow * height);
    const samples: { id: string; x: number; y: number }[] = [];

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const offset = y * bytesPerRow + x * 4;
        const value = x >= y ? 255 : 0;

        source[offset] = value;
        source[offset + 1] = value;
        source[offset + 2] = value;
        source[offset + 3] = 255;
        samples.push({
          id: `${x},${y}`,
          x: (x + 0.5) / width,
          y: (y + 0.5) / height,
        });
      }
    }

    const inputTexture = device.createTexture({
      label: "aperture-fxaa-edge-input",
      size: { width, height },
      format,
      usage: usage.TEXTURE_BINDING | usage.COPY_DST,
    });

    device.queue.writeTexture(
      { texture: inputTexture },
      source,
      { bytesPerRow },
      { width, height },
    );

    async function runEffect(effect: WebGpuPostEffect) {
      const outputTexture = device.createTexture({
        label: `aperture-${effect.id}-edge-output`,
        size: { width, height },
        format,
        usage: usage.RENDER_ATTACHMENT | usage.COPY_SRC,
      });
      const prepared = effect.prepare({
        device: device as unknown as Parameters<
          WebGpuPostEffect["prepare"]
        >[0]["device"],
        input: {
          texture: inputTexture,
          width,
          height,
          format,
          label: "edge-input",
        },
        outputFormat: format,
        width,
        height,
        frame: 1,
        passIndex: 0,
        isLast: true,
        label: `edge-${effect.id}`,
      });
      const boundary = assembleFrameBoundary({
        context: { getCurrentTexture: () => null },
        device: device as unknown as Parameters<
          typeof assembleFrameBoundary
        >[0]["device"],
        queue: device.queue as unknown as Parameters<
          typeof assembleFrameBoundary
        >[0]["queue"],
        commands: prepared.commands,
        label: `edge-${effect.id}`,
        colorTarget: {
          source: "offscreen-target",
          texture: outputTexture,
        },
        clearColor: [0, 0, 0, 1],
        readback: {
          format,
          width,
          height,
          samples,
        },
      });

      await device.queue.onSubmittedWorkDone();

      const readback = await mapFrameBoundaryReadbackSamples(
        boundary.readback,
        boundary.valid && prepared.diagnostics.length === 0,
      );

      outputTexture.destroy();
      return {
        ok: boundary.valid && prepared.diagnostics.length === 0,
        diagnostics: [...prepared.diagnostics, ...boundary.texture.diagnostics],
        readback,
      };
    }

    const copy = await runEffect(createWebGpuCopyPostEffect());
    const fxaa = await runEffect(createWebGpuFxaaPostEffect());
    let maxDelta = 0;

    if (copy.readback?.ok === true && fxaa.readback?.ok === true) {
      const copySamples = new Map(
        copy.readback.samples.map((sample) => [sample.id, sample.pixel]),
      );

      for (const sample of fxaa.readback.samples) {
        const direct = copySamples.get(sample.id);

        if (direct !== undefined) {
          maxDelta = Math.max(maxDelta, Math.abs(direct.r - sample.pixel.r));
        }
      }
    }

    inputTexture.destroy();

    return { ok: true, copy, fxaa, maxDelta };
  });

  if (!result.ok && result.reason === "webgpu-unavailable") {
    test.skip(true, "WebGPU is not available in this browser.");
  }

  if (!result.ok && result.reason === "adapter-unavailable") {
    test.skip(true, "WebGPU adapter is not available.");
  }

  if (!result.ok) {
    expect(result).toMatchObject({ ok: true });
    return;
  }

  expect(result.copy).toMatchObject({ ok: true, readback: { ok: true } });
  expect(result.fxaa).toMatchObject({ ok: true, readback: { ok: true } });

  const copyReadback = result.copy?.readback;
  const fxaaReadback = result.fxaa?.readback;

  if (copyReadback?.ok !== true || fxaaReadback?.ok !== true) {
    expect(copyReadback).toMatchObject({ ok: true });
    expect(fxaaReadback).toMatchObject({ ok: true });
    return;
  }

  expect(copyReadback.samples).toHaveLength(256);
  expect(fxaaReadback.samples).toHaveLength(256);
  expect(result.maxDelta).toBeGreaterThan(20);
});

test("bloom post effect adds glow around bright pixels", async ({ page }) => {
  await page.goto("/examples/triangle.html");

  const result = await page.evaluate(async () => {
    if (navigator.gpu === undefined) {
      return { ok: false, reason: "webgpu-unavailable" };
    }

    const adapter = await navigator.gpu.requestAdapter();

    if (adapter === null) {
      return { ok: false, reason: "adapter-unavailable" };
    }

    const device = await adapter.requestDevice();
    const {
      assembleFrameBoundary,
      createWebGpuBloomPostEffect,
      createWebGpuCopyPostEffect,
      mapFrameBoundaryReadbackSamples,
    } = await import("@aperture-engine/webgpu/test-support");
    const usage = {
      COPY_SRC: 0x01,
      COPY_DST: 0x02,
      TEXTURE_BINDING: 0x04,
      RENDER_ATTACHMENT: 0x10,
    };
    const width = 16;
    const height = 16;
    const format = "rgba8unorm";
    const bytesPerRow = 256;
    const source = new Uint8Array(bytesPerRow * height);
    const samples = [
      { id: "far-dark", x: (1 + 0.5) / width, y: (1 + 0.5) / height },
      { id: "left-glow", x: (6 + 0.5) / width, y: (7 + 0.5) / height },
      { id: "bright", x: (7 + 0.5) / width, y: (7 + 0.5) / height },
    ];

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const offset = y * bytesPerRow + x * 4;
        const bright = (x === 7 || x === 8) && (y === 7 || y === 8);
        const value = bright ? 255 : 0;

        source[offset] = value;
        source[offset + 1] = value;
        source[offset + 2] = value;
        source[offset + 3] = 255;
      }
    }

    const inputTexture = device.createTexture({
      label: "aperture-bloom-bright-input",
      size: { width, height },
      format,
      usage: usage.TEXTURE_BINDING | usage.COPY_DST,
    });

    device.queue.writeTexture(
      { texture: inputTexture },
      source,
      { bytesPerRow },
      { width, height },
    );

    async function runEffect(effect: WebGpuPostEffect) {
      const outputTexture = device.createTexture({
        label: `aperture-${effect.id}-bloom-output`,
        size: { width, height },
        format,
        usage: usage.RENDER_ATTACHMENT | usage.COPY_SRC,
      });
      const prepared = effect.prepare({
        device: device as unknown as Parameters<
          WebGpuPostEffect["prepare"]
        >[0]["device"],
        input: {
          texture: inputTexture,
          width,
          height,
          format,
          label: "bloom-input",
        },
        outputFormat: format,
        width,
        height,
        frame: 1,
        passIndex: 0,
        isLast: true,
        label: `bloom-${effect.id}`,
      });
      // Graph-based effects (bloom's downsample/upsample/composite topology)
      // carry their work in prepared.graph.passes with empty flat commands;
      // execute each pass into its own output texture, directing the final
      // (composite) pass at the probe's output target. Flat effects (copy)
      // keep the single-boundary path.
      const graphPasses = prepared.graph?.passes ?? null;
      const passPlans =
        graphPasses === null
          ? [
              {
                commands: prepared.commands,
                texture: outputTexture,
                last: true,
              },
            ]
          : graphPasses.map((pass, index) => ({
              commands: pass.commands,
              texture:
                index === graphPasses.length - 1
                  ? outputTexture
                  : (pass.outputResource?.texture ?? outputTexture),
              last: index === graphPasses.length - 1,
            }));
      let boundary: ReturnType<typeof assembleFrameBoundary> | null = null;
      let allValid = true;

      for (const plan of passPlans) {
        const passBoundary = assembleFrameBoundary({
          context: { getCurrentTexture: () => null },
          device: device as unknown as Parameters<
            typeof assembleFrameBoundary
          >[0]["device"],
          queue: device.queue as unknown as Parameters<
            typeof assembleFrameBoundary
          >[0]["queue"],
          commands: plan.commands,
          label: `bloom-${effect.id}`,
          colorTarget: {
            source: "offscreen-target",
            texture: plan.texture,
          },
          clearColor: [0, 0, 0, 1],
          ...(plan.last
            ? {
                readback: {
                  format,
                  width,
                  height,
                  samples,
                },
              }
            : {}),
        });

        allValid = allValid && passBoundary.valid;
        boundary = passBoundary;
      }

      await device.queue.onSubmittedWorkDone();

      const readback = await mapFrameBoundaryReadbackSamples(
        boundary?.readback ?? null,
        allValid && prepared.diagnostics.length === 0,
      );

      outputTexture.destroy();
      return {
        ok: allValid && prepared.diagnostics.length === 0,
        diagnostics: [
          ...prepared.diagnostics,
          ...(boundary?.texture.diagnostics ?? []),
        ],
        readback,
      };
    }

    const copy = await runEffect(createWebGpuCopyPostEffect());
    const bloom = await runEffect(
      createWebGpuBloomPostEffect({
        threshold: 0.7,
        intensity: 1.2,
        radiusPixels: 1,
      }),
    );
    const copyPixels = new Map(
      copy.readback?.ok === true
        ? copy.readback.samples.map((sample) => [sample.id, sample.pixel])
        : [],
    );
    const bloomPixels = new Map(
      bloom.readback?.ok === true
        ? bloom.readback.samples.map((sample) => [sample.id, sample.pixel])
        : [],
    );

    inputTexture.destroy();

    return {
      ok: true,
      copy,
      bloom,
      copyLeft: copyPixels.get("left-glow") ?? null,
      bloomLeft: bloomPixels.get("left-glow") ?? null,
      bloomFar: bloomPixels.get("far-dark") ?? null,
      bloomBright: bloomPixels.get("bright") ?? null,
    };
  });

  if (!result.ok && result.reason === "webgpu-unavailable") {
    test.skip(true, "WebGPU is not available in this browser.");
  }

  if (!result.ok && result.reason === "adapter-unavailable") {
    test.skip(true, "WebGPU adapter is not available.");
  }

  if (!result.ok) {
    expect(result).toMatchObject({ ok: true });
    return;
  }

  expect(result.copy).toMatchObject({ ok: true, readback: { ok: true } });
  expect(result.bloom).toMatchObject({ ok: true, readback: { ok: true } });
  expect(result.copyLeft?.r).toBeLessThanOrEqual(2);
  expect(result.bloomLeft?.r).toBeGreaterThan(20);
  expect(result.bloomFar?.r).toBeLessThanOrEqual(2);
  expect(result.bloomBright?.r).toBeGreaterThan(240);
});
