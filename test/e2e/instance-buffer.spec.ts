import { expect, test } from "@playwright/test";

test("draws four indexed cube instances from one instance transform buffer", async ({
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
      createInstanceTransformData,
      createInstanceTransformVertexBufferLayout,
    } = await import("@aperture-engine/webgpu/test-support");
    const globals = globalThis as unknown as {
      readonly GPUBufferUsage?: {
        readonly VERTEX: number;
        readonly INDEX: number;
        readonly COPY_DST: number;
        readonly MAP_READ: number;
      };
      readonly GPUTextureUsage?: {
        readonly COPY_SRC: number;
        readonly RENDER_ATTACHMENT: number;
      };
      readonly GPUMapMode?: { readonly READ: number };
    };
    const bufferUsage = globals.GPUBufferUsage ?? {
      VERTEX: 0x20,
      INDEX: 0x10,
      COPY_DST: 0x08,
      MAP_READ: 0x01,
    };
    const textureUsage = globals.GPUTextureUsage ?? {
      COPY_SRC: 0x01,
      RENDER_ATTACHMENT: 0x10,
    };
    const mapMode = globals.GPUMapMode ?? { READ: 0x01 };
    const width = 160;
    const height = 160;
    const format = "rgba8unorm";
    const color = device.createTexture({
      label: "aperture-instance-buffer-proof-color",
      size: { width, height },
      format,
      usage: textureUsage.RENDER_ATTACHMENT | textureUsage.COPY_SRC,
    });
    const positions = new Float32Array([
      -0.5, -0.5, -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, -0.5, -0.5, 0.5, -0.5, -0.5,
      -0.5, 0.5, 0.5, -0.5, 0.5, 0.5, 0.5, 0.5, -0.5, 0.5, 0.5,
    ]);
    const indices = new Uint16Array([
      0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6, 0, 4, 5, 0, 5, 1, 1, 5, 6, 1, 6, 2, 2,
      6, 7, 2, 7, 3, 3, 7, 4, 3, 4, 0,
    ]);
    const instances = createInstanceTransformData([
      instanceMatrix(-0.55, -0.55, 0, 0.32),
      instanceMatrix(0.55, -0.55, 0, 0.32),
      instanceMatrix(-0.55, 0.55, 0, 0.32),
      instanceMatrix(0.55, 0.55, 0, 0.32),
    ]);
    const positionBuffer = device.createBuffer({
      label: "aperture-instance-buffer-proof-positions",
      size: positions.byteLength,
      usage: bufferUsage.VERTEX | bufferUsage.COPY_DST,
    });
    const indexBuffer = device.createBuffer({
      label: "aperture-instance-buffer-proof-indices",
      size: indices.byteLength,
      usage: bufferUsage.INDEX | bufferUsage.COPY_DST,
    });
    const instanceBuffer = device.createBuffer({
      label: "aperture-instance-buffer-proof-instances",
      size: instances.byteLength,
      usage: bufferUsage.VERTEX | bufferUsage.COPY_DST,
    });

    device.queue.writeBuffer(positionBuffer, 0, positions);
    device.queue.writeBuffer(indexBuffer, 0, indices);
    device.queue.writeBuffer(instanceBuffer, 0, instances);

    const shader = device.createShaderModule({
      label: "aperture-instance-buffer-proof-shader",
      code: `
        struct VertexInput {
          @location(0) position: vec3f,
          @location(1) m0: vec4f,
          @location(2) m1: vec4f,
          @location(3) m2: vec4f,
          @location(4) m3: vec4f,
          @builtin(instance_index) instanceIndex: u32,
        }

        struct VertexOutput {
          @builtin(position) position: vec4f,
          @location(0) color: vec4f,
        }

        @vertex
        fn vs(input: VertexInput) -> VertexOutput {
          let model = mat4x4f(input.m0, input.m1, input.m2, input.m3);
          let world = model * vec4f(input.position, 1.0);
          var colors = array<vec4f, 4>(
            vec4f(1.0, 0.12, 0.08, 1.0),
            vec4f(0.08, 0.85, 0.18, 1.0),
            vec4f(0.12, 0.34, 1.0, 1.0),
            vec4f(1.0, 0.86, 0.12, 1.0),
          );
          var output: VertexOutput;
          output.position = vec4f(world.xy, world.z * 0.1, 1.0);
          output.color = colors[input.instanceIndex];
          return output;
        }

        @fragment
        fn fs(input: VertexOutput) -> @location(0) vec4f {
          return input.color;
        }
      `,
    });
    const pipeline = device.createRenderPipeline({
      label: "aperture-instance-buffer-proof-pipeline",
      layout: "auto",
      vertex: {
        module: shader,
        entryPoint: "vs",
        buffers: [
          {
            arrayStride: 12,
            stepMode: "vertex",
            attributes: [
              {
                shaderLocation: 0,
                offset: 0,
                format: "float32x3",
              },
            ],
          },
          createInstanceTransformVertexBufferLayout({
            shaderLocationStart: 1,
          }),
        ],
      },
      fragment: {
        module: shader,
        entryPoint: "fs",
        targets: [{ format }],
      },
      primitive: { topology: "triangle-list", cullMode: "none" },
    });
    const encoder = device.createCommandEncoder({
      label: "aperture-instance-buffer-proof-encoder",
    });
    const pass = encoder.beginRenderPass({
      label: "aperture-instance-buffer-proof-pass",
      colorAttachments: [
        {
          view: color.createView(),
          clearValue: { r: 0, g: 0, b: 0, a: 1 },
          loadOp: "clear",
          storeOp: "store",
        },
      ],
    });

    pass.setPipeline(pipeline);
    pass.setVertexBuffer(0, positionBuffer);
    pass.setVertexBuffer(1, instanceBuffer);
    pass.setIndexBuffer(indexBuffer, "uint16");
    pass.drawIndexed(indices.length, 4, 0, 0, 0);
    pass.end();

    const bytesPerRow = 256 * 4;
    const readback = device.createBuffer({
      label: "aperture-instance-buffer-proof-readback",
      size: bytesPerRow * height,
      usage: bufferUsage.COPY_DST | bufferUsage.MAP_READ,
    });

    encoder.copyTextureToBuffer(
      { texture: color },
      { buffer: readback, bytesPerRow },
      { width, height },
    );
    device.queue.submit([encoder.finish()]);
    await readback.mapAsync(mapMode.READ);

    const mapped = new Uint8Array(readback.getMappedRange());
    const samples = {
      lowerLeft: readPixel(mapped, bytesPerRow, 36, 124),
      lowerRight: readPixel(mapped, bytesPerRow, 124, 124),
      upperLeft: readPixel(mapped, bytesPerRow, 36, 36),
      upperRight: readPixel(mapped, bytesPerRow, 124, 36),
    };

    readback.unmap();
    color.destroy();

    return {
      ok: true,
      instanceCount: 4,
      indexCount: indices.length,
      instanceStride: createInstanceTransformVertexBufferLayout({
        shaderLocationStart: 1,
      }).arrayStride,
      samples,
    };

    function instanceMatrix(
      x: number,
      y: number,
      z: number,
      scale: number,
    ): readonly number[] {
      return [scale, 0, 0, 0, 0, scale, 0, 0, 0, 0, scale, 0, x, y, z, 1];
    }

    function readPixel(
      bytes: Uint8Array,
      bytesPerImageRow: number,
      x: number,
      y: number,
    ): readonly number[] {
      const offset = y * bytesPerImageRow + x * 4;
      return Array.from(bytes.slice(offset, offset + 4));
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

  expect(result.instanceCount).toBe(4);
  expect(result.indexCount).toBe(36);
  expect(result.instanceStride).toBe(64);
  expect(result.samples?.lowerLeft[0]).toBeGreaterThan(180);
  expect(result.samples?.lowerRight[1]).toBeGreaterThan(150);
  expect(result.samples?.upperLeft[2]).toBeGreaterThan(180);
  expect(result.samples?.upperRight[0]).toBeGreaterThan(180);
  expect(result.samples?.upperRight[1]).toBeGreaterThan(150);
});
