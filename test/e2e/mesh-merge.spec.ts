import { expect, test } from "@playwright/test";
import type { MeshAsset } from "@aperture-engine/webgpu/test-support";

test("merged static mesh buffer renders pixel-identical to per-mesh draws", async ({
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
    const aperture = await import("@aperture-engine/webgpu/test-support");
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
    const format = "rgba8unorm";
    const width = 64;
    const height = 64;
    const sources = [
      {
        handle: aperture.createMeshHandle("merge-triangle-a"),
        mesh: meshAsset("TriangleA", [
          [-0.86, -0.86],
          [-0.24, -0.84],
          [-0.54, -0.24],
        ]),
      },
      {
        handle: aperture.createMeshHandle("merge-quad-b"),
        mesh: meshAsset(
          "QuadB",
          [
            [0.18, -0.82],
            [0.82, -0.82],
            [0.82, -0.24],
            [0.18, -0.24],
          ],
          [0, 1, 2, 0, 2, 3],
        ),
      },
      {
        handle: aperture.createMeshHandle("merge-triangle-c"),
        mesh: meshAsset("TriangleC", [
          [-0.82, 0.22],
          [-0.18, 0.22],
          [-0.52, 0.86],
        ]),
      },
      {
        handle: aperture.createMeshHandle("merge-pentagon-d"),
        mesh: meshAsset(
          "PentagonD",
          [
            [0.5, 0.86],
            [0.82, 0.58],
            [0.7, 0.18],
            [0.3, 0.18],
            [0.18, 0.58],
          ],
          [0, 1, 2, 0, 2, 3, 0, 3, 4],
        ),
      },
    ];
    const merged = aperture.mergeMeshAssetsForBatch({
      label: "MergedStaticProof",
      sources,
    });

    if (!merged.valid || merged.mesh === null) {
      return {
        ok: false,
        reason: "merge-failed",
        diagnostics: merged.diagnostics,
      };
    }

    const shader = device.createShaderModule({
      label: "aperture-mesh-merge-proof-shader",
      code: `
        @vertex
        fn vs(@location(0) position: vec3f) -> @builtin(position) vec4f {
          return vec4f(position, 1.0);
        }

        @fragment
        fn fs() -> @location(0) vec4f {
          return vec4f(0.08, 0.82, 0.32, 1.0);
        }
      `,
    });
    const pipeline = device.createRenderPipeline({
      label: "aperture-mesh-merge-proof-pipeline",
      layout: "auto",
      vertex: {
        module: shader,
        entryPoint: "vs",
        buffers: [
          {
            arrayStride: 32,
            stepMode: "vertex",
            attributes: [{ shaderLocation: 0, offset: 0, format: "float32x3" }],
          },
        ],
      },
      fragment: {
        module: shader,
        entryPoint: "fs",
        targets: [{ format }],
      },
      primitive: { topology: "triangle-list", cullMode: "none" },
    });
    const perMesh = await renderAndRead({
      label: "per-mesh",
      meshes: sources.map((source) => source.mesh),
    });
    const mergedPixels = await renderAndRead({
      label: "merged",
      meshes: [merged.mesh],
    });
    let mismatchedBytes = 0;

    for (let index = 0; index < perMesh.length; index += 1) {
      if (perMesh[index] !== mergedPixels[index]) {
        mismatchedBytes += 1;
      }
    }

    return {
      ok: true,
      mergedSubmeshes: merged.mesh.submeshes.length,
      ranges: merged.ranges.map((range) => ({
        sourceMeshKey: range.sourceMeshKey,
        vertexStart: range.vertexStart,
        indexStart: range.indexStart,
        indexCount: range.indexCount,
      })),
      indexCount: merged.mesh.indexBuffer?.data.length ?? 0,
      vertexCount: merged.mesh.vertexStreams[0]?.vertexCount ?? 0,
      mismatchedBytes,
    };

    async function renderAndRead(input: {
      readonly label: string;
      readonly meshes: readonly MeshAsset[];
    }): Promise<Uint8Array> {
      const texture = device.createTexture({
        label: `aperture-mesh-merge-proof-${input.label}`,
        size: { width, height },
        format,
        usage: textureUsage.RENDER_ATTACHMENT | textureUsage.COPY_SRC,
      });
      const encoder = device.createCommandEncoder({
        label: `aperture-mesh-merge-proof-${input.label}-encoder`,
      });
      const pass = encoder.beginRenderPass({
        label: `aperture-mesh-merge-proof-${input.label}-pass`,
        colorAttachments: [
          {
            view: texture.createView(),
            clearValue: { r: 0, g: 0, b: 0, a: 1 },
            loadOp: "clear",
            storeOp: "store",
          },
        ],
      });

      pass.setPipeline(pipeline);

      for (const mesh of input.meshes) {
        const vertexBuffer = createBuffer(
          `${input.label}-${mesh.label}-vertices`,
          required(mesh.vertexStreams[0]).data,
          bufferUsage.VERTEX | bufferUsage.COPY_DST,
        );
        const indexBuffer = createBuffer(
          `${input.label}-${mesh.label}-indices`,
          required(mesh.indexBuffer).data,
          bufferUsage.INDEX | bufferUsage.COPY_DST,
        );

        pass.setVertexBuffer(0, vertexBuffer);
        pass.setIndexBuffer(indexBuffer, required(mesh.indexBuffer).format);
        pass.drawIndexed(required(mesh.indexBuffer).data.length);
      }

      pass.end();

      const bytesPerRow = 256;
      const readback = device.createBuffer({
        label: `aperture-mesh-merge-proof-${input.label}-readback`,
        size: bytesPerRow * height,
        usage: bufferUsage.COPY_DST | bufferUsage.MAP_READ,
      });

      encoder.copyTextureToBuffer(
        { texture },
        { buffer: readback, bytesPerRow },
        { width, height },
      );
      device.queue.submit([encoder.finish()]);
      await readback.mapAsync(mapMode.READ);

      const pixels = new Uint8Array(readback.getMappedRange()).slice();

      readback.unmap();
      texture.destroy();

      return pixels;
    }

    function createBuffer(
      label: string,
      data: Float32Array | Uint8Array | Uint16Array | Uint32Array,
      usage: number,
    ): GPUBuffer {
      const upload = alignedUploadBytes(data);
      const buffer = device.createBuffer({
        label,
        size: upload.byteLength,
        usage,
      });

      device.queue.writeBuffer(buffer, 0, upload);
      return buffer;
    }

    function alignedUploadBytes(data: ArrayBufferView): Uint8Array {
      const source = new Uint8Array(
        data.buffer,
        data.byteOffset,
        data.byteLength,
      );
      const alignedByteLength = Math.ceil(source.byteLength / 4) * 4;

      if (alignedByteLength === source.byteLength) {
        return source;
      }

      const upload = new Uint8Array(alignedByteLength);

      upload.set(source);
      return upload;
    }

    function meshAsset(
      label: string,
      positions: readonly (readonly [number, number])[],
      indices: readonly number[] = [0, 1, 2],
    ): MeshAsset {
      const vertices = new Float32Array(positions.length * 8);
      const min: [number, number, number] = [Infinity, Infinity, 0];
      const max: [number, number, number] = [-Infinity, -Infinity, 0];

      positions.forEach((position, vertexIndex) => {
        const offset = vertexIndex * 8;

        vertices.set([position[0], position[1], 0, 0, 0, 1, 0, 0], offset);
        min[0] = Math.min(min[0], position[0]);
        min[1] = Math.min(min[1], position[1]);
        max[0] = Math.max(max[0], position[0]);
        max[1] = Math.max(max[1], position[1]);
      });

      return {
        kind: "mesh" as const,
        label,
        vertexStreams: [
          {
            id: "primitive-interleaved",
            arrayStride: 32,
            vertexCount: positions.length,
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
            data: vertices,
          },
        ],
        indexBuffer: {
          format: "uint16" as const,
          data: new Uint16Array(indices),
        },
        submeshes: [
          {
            label: "default",
            topology: "triangle-list" as const,
            materialSlot: 0,
            vertexStart: 0,
            vertexCount: positions.length,
            indexStart: 0,
            indexCount: indices.length,
          },
        ],
        materialSlots: [{ index: 0, label: "default" }],
        localAabb: { min, max },
        localSphere: {
          center: [(min[0] + max[0]) * 0.5, (min[1] + max[1]) * 0.5, 0],
          radius: Math.hypot(max[0] - min[0], max[1] - min[1]) * 0.5,
        },
      };
    }

    function required<T>(value: T | null | undefined): T {
      if (value === null || value === undefined) {
        throw new Error("Expected WebGPU mesh merge test value to exist.");
      }

      return value;
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

  expect(result.mergedSubmeshes).toBe(4);
  expect(result.vertexCount).toBe(15);
  expect(result.indexCount).toBe(21);
  expect(result.ranges?.slice(0, 2)).toMatchObject([
    {
      sourceMeshKey: "mesh:merge-triangle-a",
      vertexStart: 0,
      indexStart: 0,
      indexCount: 3,
    },
    {
      sourceMeshKey: "mesh:merge-quad-b",
      vertexStart: 3,
      indexStart: 3,
      indexCount: 6,
    },
  ]);
  expect(result.mismatchedBytes).toBe(0);
});
