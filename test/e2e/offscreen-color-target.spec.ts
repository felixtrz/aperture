import { expect, test } from "@playwright/test";

test("renders a triangle into an off-screen color target and reads pixels", async ({
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
    const { createOffscreenColorTarget, createRenderPassAttachmentPlan } =
      await import("@aperture-engine/webgpu/test-support");
    const width = 32;
    const height = 32;
    const format = "rgba8unorm";
    const textureUsageCopySrc = 0x01;
    const textureUsageRenderAttachment = 0x10;
    const bufferUsageMapRead = 0x01;
    const bufferUsageCopyDst = 0x08;
    const mapModeRead = 0x01;
    const texture = device.createTexture({
      label: "aperture-offscreen-target-test",
      size: { width, height },
      format,
      usage: textureUsageRenderAttachment | textureUsageCopySrc,
    });
    const target = createOffscreenColorTarget({
      texture,
      clearColor: [0, 0, 0, 1],
      loadOp: "clear",
      storeOp: "store",
    });
    const attachmentPlan = createRenderPassAttachmentPlan({
      colorTargets: target.target === null ? [] : [target.target],
    });

    if (
      !target.valid ||
      !attachmentPlan.valid ||
      attachmentPlan.plan === null
    ) {
      return {
        ok: false,
        reason: "attachment-plan-failed",
        target,
        attachmentPlan,
      };
    }

    const shader = device.createShaderModule({
      label: "aperture-offscreen-target-test-shader",
      code: `
        @vertex
        fn vs(@builtin(vertex_index) vertexIndex: u32) -> @builtin(position) vec4f {
          var positions = array<vec2f, 3>(
            vec2f(-0.8, -0.8),
            vec2f(0.8, -0.8),
            vec2f(0.0, 0.8),
          );
          return vec4f(positions[vertexIndex], 0.0, 1.0);
        }

        @fragment
        fn fs() -> @location(0) vec4f {
          return vec4f(0.95, 0.2, 0.1, 1.0);
        }
      `,
    });
    const pipeline = device.createRenderPipeline({
      label: "aperture-offscreen-target-test-pipeline",
      layout: "auto",
      vertex: { module: shader, entryPoint: "vs" },
      fragment: {
        module: shader,
        entryPoint: "fs",
        targets: [{ format }],
      },
      primitive: { topology: "triangle-list" },
    });
    const encoder = device.createCommandEncoder({
      label: "aperture-offscreen-target-test-encoder",
    });
    const pass = encoder.beginRenderPass({
      label: "aperture-offscreen-target-test-pass",
      colorAttachments: attachmentPlan.plan.colorAttachments.map(
        (attachment) => ({
          view: attachment.view as GPUTextureView,
          ...(attachment.clearValue === undefined
            ? {}
            : { clearValue: attachment.clearValue }),
          loadOp: attachment.loadOp,
          storeOp: attachment.storeOp,
        }),
      ),
    });

    pass.setPipeline(pipeline);
    pass.draw(3);
    pass.end();

    const bytesPerRow = 256;
    const readback = device.createBuffer({
      label: "aperture-offscreen-target-test-readback",
      size: bytesPerRow * height,
      usage: bufferUsageCopyDst | bufferUsageMapRead,
    });

    encoder.copyTextureToBuffer(
      { texture },
      { buffer: readback, bytesPerRow },
      { width, height },
    );
    device.queue.submit([encoder.finish()]);
    await readback.mapAsync(mapModeRead);

    const mapped = new Uint8Array(readback.getMappedRange());
    const offset = 16 * bytesPerRow + 16 * 4;
    const center = Array.from(mapped.slice(offset, offset + 4));

    readback.unmap();
    texture.destroy();

    return {
      ok: true,
      center,
      targetValid: target.valid,
      attachmentCount: attachmentPlan.plan.colorAttachments.length,
    };
  });

  if (!result.ok && result.reason === "webgpu-unavailable") {
    test.skip(true, "WebGPU is not available in this browser.");
  }

  if (!result.ok && result.reason === "adapter-unavailable") {
    test.skip(true, "WebGPU adapter is not available in this browser.");
  }

  if (!result.ok) {
    expect(result).toMatchObject({ ok: true });
    return;
  }

  expect(result).toMatchObject({
    ok: true,
    targetValid: true,
    attachmentCount: 1,
  });
  const center = result.center ?? [];

  expect(center[0]).toBeGreaterThan(180);
  expect(center[1]).toBeLessThan(90);
  expect(center[3]).toBe(255);
});

test("renders a triangle into two off-screen color targets in one pass", async ({
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
    const { createOffscreenColorTargets, createRenderPassAttachmentPlan } =
      await import("@aperture-engine/webgpu/test-support");
    const globals = globalThis as unknown as {
      readonly GPUTextureUsage?: {
        readonly COPY_SRC: number;
        readonly RENDER_ATTACHMENT: number;
      };
      readonly GPUBufferUsage?: {
        readonly MAP_READ: number;
        readonly COPY_DST: number;
      };
      readonly GPUMapMode?: { readonly READ: number };
    };
    const textureUsage = globals.GPUTextureUsage ?? {
      COPY_SRC: 0x01,
      RENDER_ATTACHMENT: 0x10,
    };
    const bufferUsage = globals.GPUBufferUsage ?? {
      MAP_READ: 0x01,
      COPY_DST: 0x08,
    };
    const mapMode = globals.GPUMapMode ?? { READ: 0x01 };
    const width = 32;
    const height = 32;
    const format = "rgba8unorm";
    const colorTexture = device.createTexture({
      label: "aperture-mrt-color-target-test-color",
      size: { width, height },
      format,
      usage: textureUsage.RENDER_ATTACHMENT | textureUsage.COPY_SRC,
    });
    const normalTexture = device.createTexture({
      label: "aperture-mrt-color-target-test-normal",
      size: { width, height },
      format,
      usage: textureUsage.RENDER_ATTACHMENT | textureUsage.COPY_SRC,
    });
    const targets = createOffscreenColorTargets({
      textures: [colorTexture, normalTexture],
      clearColors: [
        [0, 0, 0, 1],
        [0, 0, 0, 1],
      ],
      loadOp: "clear",
      storeOp: "store",
    });
    const attachmentPlan = createRenderPassAttachmentPlan({
      colorTargets: targets.targets,
    });

    if (
      !targets.valid ||
      !attachmentPlan.valid ||
      attachmentPlan.plan === null
    ) {
      colorTexture.destroy();
      normalTexture.destroy();
      return {
        ok: false,
        reason: "attachment-plan-failed",
        targets,
        attachmentPlan,
      };
    }

    const shader = device.createShaderModule({
      label: "aperture-mrt-color-target-test-shader",
      code: `
        struct FragmentOutput {
          @location(0) color: vec4f,
          @location(1) normal: vec4f,
        }

        @vertex
        fn vs(@builtin(vertex_index) vertexIndex: u32) -> @builtin(position) vec4f {
          var positions = array<vec2f, 3>(
            vec2f(-0.8, -0.8),
            vec2f(0.8, -0.8),
            vec2f(0.0, 0.8),
          );
          return vec4f(positions[vertexIndex], 0.0, 1.0);
        }

        @fragment
        fn fs() -> FragmentOutput {
          var output: FragmentOutput;
          output.color = vec4f(0.9, 0.12, 0.08, 1.0);
          output.normal = vec4f(0.05, 0.72, 0.95, 1.0);
          return output;
        }
      `,
    });
    const pipeline = device.createRenderPipeline({
      label: "aperture-mrt-color-target-test-pipeline",
      layout: "auto",
      vertex: { module: shader, entryPoint: "vs" },
      fragment: {
        module: shader,
        entryPoint: "fs",
        targets: [{ format }, { format }],
      },
      primitive: { topology: "triangle-list" },
    });
    const encoder = device.createCommandEncoder({
      label: "aperture-mrt-color-target-test-encoder",
    });
    const pass = encoder.beginRenderPass({
      label: "aperture-mrt-color-target-test-pass",
      colorAttachments: attachmentPlan.plan.colorAttachments.map(
        (attachment) => ({
          view: attachment.view as GPUTextureView,
          ...(attachment.clearValue === undefined
            ? {}
            : { clearValue: attachment.clearValue }),
          loadOp: attachment.loadOp,
          storeOp: attachment.storeOp,
        }),
      ),
    });

    pass.setPipeline(pipeline);
    pass.draw(3);
    pass.end();

    const colorReadback = copyTexturePixel(
      device,
      encoder,
      colorTexture,
      width,
      height,
      bufferUsage,
    );
    const normalReadback = copyTexturePixel(
      device,
      encoder,
      normalTexture,
      width,
      height,
      bufferUsage,
    );

    device.queue.submit([encoder.finish()]);

    const [colorCenter, normalCenter] = await Promise.all([
      mapTexturePixel(colorReadback, mapMode.READ),
      mapTexturePixel(normalReadback, mapMode.READ),
    ]);

    colorTexture.destroy();
    normalTexture.destroy();

    return {
      ok: true,
      colorCenter,
      normalCenter,
      targetValid: targets.valid,
      attachmentCount: attachmentPlan.plan.colorAttachments.length,
    };

    function copyTexturePixel(
      device: GPUDevice,
      encoder: GPUCommandEncoder,
      texture: GPUTexture,
      width: number,
      height: number,
      bufferUsage: { readonly MAP_READ: number; readonly COPY_DST: number },
    ): GPUBuffer {
      const bytesPerRow = 256;
      const buffer = device.createBuffer({
        label: "aperture-mrt-color-target-test-readback",
        size: bytesPerRow,
        usage: bufferUsage.COPY_DST | bufferUsage.MAP_READ,
      });

      encoder.copyTextureToBuffer(
        {
          texture,
          origin: {
            x: Math.floor(width * 0.5),
            y: Math.floor(height * 0.5),
            z: 0,
          },
        },
        { buffer, bytesPerRow, rowsPerImage: 1 },
        { width: 1, height: 1, depthOrArrayLayers: 1 },
      );

      return buffer;
    }

    async function mapTexturePixel(
      buffer: GPUBuffer,
      mapModeRead: number,
    ): Promise<readonly number[]> {
      await buffer.mapAsync(mapModeRead);

      const pixel = Array.from(
        new Uint8Array(buffer.getMappedRange()).slice(0, 4),
      );

      buffer.unmap();
      return pixel;
    }
  });

  if (!result.ok && result.reason === "webgpu-unavailable") {
    test.skip(true, "WebGPU is not available in this browser.");
  }

  if (!result.ok && result.reason === "adapter-unavailable") {
    test.skip(true, "WebGPU adapter is not available in this browser.");
  }

  if (!result.ok) {
    expect(result).toMatchObject({ ok: true });
    return;
  }

  expect(result).toMatchObject({
    ok: true,
    targetValid: true,
    attachmentCount: 2,
  });

  const colorCenter = result.colorCenter ?? [];
  const normalCenter = result.normalCenter ?? [];

  expect(colorCenter[0]).toBeGreaterThan(180);
  expect(colorCenter[1]).toBeLessThan(70);
  expect(colorCenter[2]).toBeLessThan(70);
  expect(colorCenter[3]).toBe(255);
  expect(normalCenter[0]).toBeLessThan(70);
  expect(normalCenter[1]).toBeGreaterThan(150);
  expect(normalCenter[2]).toBeGreaterThan(180);
  expect(normalCenter[3]).toBe(255);
});

test("renders ECS ViewPacket targets to off-screen texture and swapchain", async ({
  page,
}) => {
  await page.goto("/examples/");

  const result = await page.evaluate(async () => {
    if (navigator.gpu === undefined) {
      return { ok: false, reason: "webgpu-unavailable" };
    }

    const canvas = document.querySelector(
      "#aperture-canvas",
    ) as HTMLCanvasElement | null;

    if (canvas === null) {
      return { ok: false, reason: "canvas-unavailable" };
    }

    canvas.width = 96;
    canvas.height = 96;

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
      import("@aperture-engine/webgpu/test-support"),
    ]);
    const aperture = { ...core, ...webgpu };
    const browserGlobals = globalThis as unknown as {
      readonly GPUTextureUsage?: {
        readonly COPY_SRC: number;
        readonly RENDER_ATTACHMENT: number;
      };
      readonly GPUBufferUsage?: {
        readonly MAP_READ: number;
        readonly COPY_DST: number;
      };
      readonly GPUMapMode?: { readonly READ: number };
    };
    const textureUsage = browserGlobals.GPUTextureUsage ?? {
      COPY_SRC: 0x01,
      RENDER_ATTACHMENT: 0x10,
    };
    const bufferUsage = browserGlobals.GPUBufferUsage ?? {
      MAP_READ: 0x01,
      COPY_DST: 0x08,
    };
    const mapMode = browserGlobals.GPUMapMode ?? { READ: 0x01 };
    const webGpuCanvas = canvas as unknown as Parameters<
      typeof webgpu.createWebGpuApp
    >[0]["canvas"];
    const simulation = aperture.createExtractionApp({
      worldOptions: { entityCapacity: 8 },
    });
    const simulationWorker: Parameters<
      typeof webgpu.createWebGpuApp
    >[0]["simulationWorker"] = {
      start() {},
      onSnapshot() {
        return () => {};
      },
      onError() {
        return () => {};
      },
    };
    const created = await aperture.createWebGpuApp({
      canvas: webGpuCanvas,
      textureUsage: textureUsage.RENDER_ATTACHMENT | textureUsage.COPY_SRC,
      simulationWorker,
      sourceAssets: simulation.assets,
    });

    if (!created.ok) {
      return {
        ok: false,
        reason: created.reason,
        message: created.message,
      };
    }

    const app = created.app;
    const device = app.initialization.device as GPUDevice;
    const format = app.initialization.format as GPUTextureFormat;
    const width = 96;
    const height = 96;
    const offscreenTexture = device.createTexture({
      label: "aperture-e2e-view-target-offscreen",
      size: { width, height },
      format,
      usage: textureUsage.RENDER_ATTACHMENT | textureUsage.COPY_SRC,
    });
    const assets = aperture.createRenderAssetCollections({
      registry: simulation.assets,
    });
    const mesh = assets.meshes.add(
      aperture.createBoxMeshAsset({ label: "ViewTargetCube" }),
    );
    const material = assets.materials.unlit.add(
      aperture.createUnlitMaterialAsset({
        label: "ViewTargetGreen",
        baseColorFactor: [0.05, 0.85, 0.18, 1],
      }),
    );
    const renderTarget = aperture.createRenderTargetHandle("e2e-offscreen");

    simulation.assets.register(renderTarget);
    simulation.assets.markReady(
      renderTarget,
      aperture.createWebGpuAppRenderTargetAsset({
        texture: offscreenTexture,
        width,
        height,
        format,
        label: "E2E offscreen target",
      }),
    );

    simulation.spawn(
      aperture.withTransform({ translation: [0, 0, 5] }),
      aperture.withCamera({
        priority: 0,
        layerMask: 1,
        aspect: 1,
        renderTargetId: aperture.assetHandleKey(renderTarget),
      }),
    );
    simulation.spawn(
      aperture.withTransform({ translation: [0, 0, 5] }),
      aperture.withCamera({ priority: 1, layerMask: 1, aspect: 1 }),
    );
    simulation.spawn(
      aperture.withTransform(),
      aperture.withMesh(mesh),
      aperture.withMaterial(material),
      aperture.withRenderLayer(1),
      aperture.withVisibility(true),
    );
    const snapshot = simulation.stepAndExtract(1 / 60, 1, 17);
    const frame = await app.renderSnapshot(snapshot, {
      frame: 17,
      clearColor: [0, 0, 0, 1],
      readbackSamples: [{ id: "swapchain-center", x: 0.5, y: 0.5 }],
    });
    const offscreenCenter = await readTexturePixel({
      device,
      texture: offscreenTexture,
      format,
      width,
      height,
      x: 0.5,
      y: 0.5,
      bufferUsage,
      mapMode,
    });

    offscreenTexture.destroy();

    return {
      ok: frame.ok,
      counts: frame.counts,
      renderTargets: frame.renderTargets,
      readback: frame.readback,
      offscreenCenter,
      diagnostics: frame.diagnostics,
    };

    async function readTexturePixel(options: {
      readonly device: GPUDevice;
      readonly texture: GPUTexture;
      readonly format: GPUTextureFormat;
      readonly width: number;
      readonly height: number;
      readonly x: number;
      readonly y: number;
      readonly bufferUsage: {
        readonly MAP_READ: number;
        readonly COPY_DST: number;
      };
      readonly mapMode: { readonly READ: number };
    }): Promise<readonly number[]> {
      const bytesPerRow = 256;
      const origin = {
        x: Math.floor(options.width * options.x),
        y: Math.floor(options.height * options.y),
        z: 0,
      };
      const buffer = options.device.createBuffer({
        label: "aperture-e2e-view-target-offscreen-readback",
        size: bytesPerRow,
        usage: options.bufferUsage.COPY_DST | options.bufferUsage.MAP_READ,
      });
      const encoder = options.device.createCommandEncoder({
        label: "aperture-e2e-view-target-offscreen-readback",
      });

      encoder.copyTextureToBuffer(
        { texture: options.texture, origin },
        { buffer, bytesPerRow, rowsPerImage: 1 },
        { width: 1, height: 1, depthOrArrayLayers: 1 },
      );
      options.device.queue.submit([encoder.finish()]);
      await buffer.mapAsync(options.mapMode.READ);

      const bytes = new Uint8Array(buffer.getMappedRange()).slice(0, 4);
      const pixel = options.format.startsWith("bgra")
        ? [bytes[2] ?? 0, bytes[1] ?? 0, bytes[0] ?? 0, bytes[3] ?? 0]
        : [bytes[0] ?? 0, bytes[1] ?? 0, bytes[2] ?? 0, bytes[3] ?? 0];

      buffer.unmap();
      return pixel;
    }
  });

  if (!result.ok && result.reason === "webgpu-unavailable") {
    test.skip(true, "WebGPU is not available in this browser.");
  }

  if (!result.ok && result.reason === "adapter-unavailable") {
    test.skip(true, "WebGPU adapter is not available in this browser.");
  }

  if (!result.ok) {
    expect(result).toMatchObject({ ok: true });
    return;
  }

  expect(result.counts).toMatchObject({
    views: 2,
    meshDraws: 1,
    drawCalls: 2,
    diagnostics: 0,
  });
  expect(result.renderTargets).toMatchObject([
    { source: "offscreen", drawCalls: 1, ok: true },
    { source: "swapchain", drawCalls: 1, ok: true },
  ]);

  const swapchainCenter =
    result.readback?.ok === true ? result.readback.samples[0]?.pixel : null;
  const offscreenCenter = result.offscreenCenter ?? [];

  expect(swapchainCenter?.g ?? 0).toBeGreaterThan(120);
  expect(swapchainCenter?.r ?? 255).toBeLessThan(80);
  expect(offscreenCenter[1] ?? 0).toBeGreaterThan(120);
  expect(offscreenCenter[0] ?? 255).toBeLessThan(80);
});
