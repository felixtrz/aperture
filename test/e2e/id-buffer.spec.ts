import { expect, test } from "@playwright/test";

test("renders three known entity IDs into an r32uint ID buffer", async ({
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
      createOffscreenColorTargets,
      createRenderPassAttachmentPlan,
      createWebGpuIdBufferIdForEntity,
      WEBGPU_ID_BUFFER_FORMAT,
    } = await import("@aperture-engine/webgpu");
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
    const width = 96;
    const height = 32;
    const colorFormat = "rgba8unorm";
    const idFormat = WEBGPU_ID_BUFFER_FORMAT as GPUTextureFormat;
    const entities = [
      { index: 11, generation: 1 },
      { index: 12, generation: 1 },
      { index: 13, generation: 1 },
    ];
    const ids = entities.map((entity) =>
      createWebGpuIdBufferIdForEntity(entity),
    );
    const colorTexture = device.createTexture({
      label: "aperture-id-buffer-color-target",
      size: { width, height },
      format: colorFormat,
      usage: textureUsage.RENDER_ATTACHMENT | textureUsage.COPY_SRC,
    });
    const idTexture = device.createTexture({
      label: "aperture-id-buffer-id-target",
      size: { width, height },
      format: idFormat,
      usage: textureUsage.RENDER_ATTACHMENT | textureUsage.COPY_SRC,
    });
    const targets = createOffscreenColorTargets({
      textures: [colorTexture, idTexture],
      clearColors: [
        [0, 0, 0, 1],
        [0, 0, 0, 0],
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
      idTexture.destroy();
      return {
        ok: false,
        reason: "attachment-plan-failed",
        targets,
        attachmentPlan,
      };
    }

    const shader = device.createShaderModule({
      label: "aperture-id-buffer-test-shader",
      code: `
        struct VertexOutput {
          @builtin(position) position: vec4f,
          @location(0) @interpolate(flat) instance: u32,
        }

        struct FragmentOutput {
          @location(0) color: vec4f,
          @location(1) id: u32,
        }

        @vertex
        fn vs(
          @builtin(vertex_index) vertexIndex: u32,
          @builtin(instance_index) instanceIndex: u32,
        ) -> VertexOutput {
          var positions = array<vec2f, 3>(
            vec2f(-0.18, -0.45),
            vec2f(0.18, -0.45),
            vec2f(0.0, 0.45),
          );
          var offsets = array<f32, 3>(-0.58, 0.0, 0.58);
          var output: VertexOutput;
          output.position = vec4f(
            positions[vertexIndex].x + offsets[instanceIndex],
            positions[vertexIndex].y,
            0.0,
            1.0,
          );
          output.instance = instanceIndex;
          return output;
        }

        @fragment
        fn fs(input: VertexOutput) -> FragmentOutput {
          var colors = array<vec4f, 3>(
            vec4f(0.9, 0.1, 0.1, 1.0),
            vec4f(0.1, 0.9, 0.1, 1.0),
            vec4f(0.1, 0.1, 0.9, 1.0),
          );
          var ids = array<u32, 3>(
            ${ids[0]}u,
            ${ids[1]}u,
            ${ids[2]}u,
          );
          var output: FragmentOutput;
          output.color = colors[input.instance];
          output.id = ids[input.instance];
          return output;
        }
      `,
    });
    const pipeline = device.createRenderPipeline({
      label: "aperture-id-buffer-test-pipeline",
      layout: "auto",
      vertex: { module: shader, entryPoint: "vs" },
      fragment: {
        module: shader,
        entryPoint: "fs",
        targets: [{ format: colorFormat }, { format: idFormat }],
      },
      primitive: { topology: "triangle-list" },
    });
    const encoder = device.createCommandEncoder({
      label: "aperture-id-buffer-test-encoder",
    });
    const pass = encoder.beginRenderPass({
      label: "aperture-id-buffer-test-pass",
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
    pass.draw(3, 3);
    pass.end();

    const readbacks = [
      copyIdPixel(device, encoder, idTexture, width, height, 0.21, bufferUsage),
      copyIdPixel(device, encoder, idTexture, width, height, 0.5, bufferUsage),
      copyIdPixel(device, encoder, idTexture, width, height, 0.79, bufferUsage),
    ];

    device.queue.submit([encoder.finish()]);

    const readIds = await Promise.all(
      readbacks.map((buffer) => mapIdPixel(buffer, mapMode.READ)),
    );

    colorTexture.destroy();
    idTexture.destroy();

    return {
      ok: true,
      ids,
      readIds,
      idFormat,
      attachmentCount: attachmentPlan.plan.colorAttachments.length,
    };

    function copyIdPixel(
      device: GPUDevice,
      encoder: GPUCommandEncoder,
      texture: GPUTexture,
      width: number,
      height: number,
      x: number,
      bufferUsage: { readonly MAP_READ: number; readonly COPY_DST: number },
    ): GPUBuffer {
      const bytesPerRow = 256;
      const buffer = device.createBuffer({
        label: "aperture-id-buffer-test-readback",
        size: bytesPerRow,
        usage: bufferUsage.COPY_DST | bufferUsage.MAP_READ,
      });

      encoder.copyTextureToBuffer(
        {
          texture,
          origin: {
            x: Math.floor(width * x),
            y: Math.floor(height * 0.5),
            z: 0,
          },
        },
        { buffer, bytesPerRow, rowsPerImage: 1 },
        { width: 1, height: 1, depthOrArrayLayers: 1 },
      );

      return buffer;
    }

    async function mapIdPixel(
      buffer: GPUBuffer,
      mapModeRead: number,
    ): Promise<number> {
      await buffer.mapAsync(mapModeRead);

      const id = new Uint32Array(buffer.getMappedRange())[0] ?? 0;

      buffer.unmap();
      return id;
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
    idFormat: "r32uint",
    attachmentCount: 2,
  });
  expect(result.readIds).toEqual(result.ids);
});
