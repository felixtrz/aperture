import { expect, test } from "@playwright/test";

import { pixelDistance } from "./png.js";

test("PMREM compute pipeline writes constant cubemap color into mip zero", async ({
  page,
}) => {
  await page.goto("/examples/");

  const result = await page.evaluate(async () => {
    if (navigator.gpu === undefined) {
      return { ok: false, reason: "webgpu-unavailable" };
    }

    const adapter = await navigator.gpu.requestAdapter();

    if (adapter === null) {
      return { ok: false, reason: "adapter-unavailable" };
    }

    const device = await adapter.requestDevice();
    const webgpu = await import("@aperture-engine/webgpu");
    const browserGlobals = globalThis as unknown as {
      readonly GPUTextureUsage?: {
        readonly COPY_SRC: number;
        readonly COPY_DST: number;
        readonly TEXTURE_BINDING: number;
        readonly STORAGE_BINDING: number;
      };
      readonly GPUBufferUsage?: {
        readonly MAP_READ: number;
        readonly COPY_DST: number;
        readonly COPY_SRC: number;
        readonly UNIFORM: number;
      };
      readonly GPUMapMode?: { readonly READ: number };
    };
    const textureUsage = browserGlobals.GPUTextureUsage ?? {
      COPY_SRC: 0x01,
      COPY_DST: 0x02,
      TEXTURE_BINDING: 0x04,
      STORAGE_BINDING: 0x08,
    };
    const bufferUsage = browserGlobals.GPUBufferUsage ?? {
      MAP_READ: 0x01,
      COPY_DST: 0x08,
      UNIFORM: 0x40,
      COPY_SRC: 0x04,
    };
    const mapMode = browserGlobals.GPUMapMode ?? { READ: 0x01 };
    const size = 16;
    const layers = 6;
    const format = "rgba8unorm";
    const color = [42, 190, 96, 255];
    const source = device.createTexture({
      label: "aperture-pmrem-source-constant",
      size: { width: size, height: size, depthOrArrayLayers: layers },
      dimension: "2d",
      format,
      usage: textureUsage.TEXTURE_BINDING | textureUsage.COPY_DST,
    });
    const output = device.createTexture({
      label: "aperture-pmrem-output-mip-zero",
      size: { width: size, height: size, depthOrArrayLayers: layers },
      dimension: "2d",
      format,
      usage: textureUsage.STORAGE_BINDING | textureUsage.COPY_SRC,
    });
    const faceBytes = new Uint8Array(size * size * 4);

    for (let index = 0; index < faceBytes.length; index += 4) {
      faceBytes.set(color, index);
    }

    for (let layer = 0; layer < layers; layer += 1) {
      device.queue.writeTexture(
        { texture: source, origin: { x: 0, y: 0, z: layer } },
        faceBytes,
        { bytesPerRow: size * 4, rowsPerImage: size },
        { width: size, height: size, depthOrArrayLayers: 1 },
      );
    }

    const created = webgpu.createPmremComputePipeline({
      device: device as unknown as Parameters<
        typeof webgpu.createPmremComputePipeline
      >[0]["device"],
      storageFormat: format,
    });

    if (!created.valid || created.resource === null) {
      return {
        ok: false,
        reason: "pipeline-invalid",
        diagnostics: created.diagnostics,
      };
    }

    const paramsBuffer = device.createBuffer({
      label: "aperture-pmrem-params",
      size: 16,
      usage: bufferUsage.UNIFORM | bufferUsage.COPY_DST,
    });

    device.queue.writeBuffer(
      paramsBuffer,
      0,
      new Uint32Array([size, size, layers, 0]),
    );

    const bindGroup = device.createBindGroup({
      label: "aperture-pmrem-bind-group",
      layout: created.resource.bindGroupLayout as GPUBindGroupLayout,
      entries: [
        {
          binding: 0,
          resource: device.createSampler({
            label: "aperture-pmrem-source-sampler",
            magFilter: "nearest",
            minFilter: "nearest",
          }),
        },
        {
          binding: 1,
          resource: source.createView({ dimension: "cube" }),
        },
        {
          binding: 2,
          resource: output.createView({ dimension: "2d-array" }),
        },
        {
          binding: 3,
          resource: { buffer: paramsBuffer },
        },
      ],
    });
    const dispatch = webgpu.createPmremComputeDispatchSize({
      width: size,
      height: size,
      layers,
    });
    const encoder = device.createCommandEncoder({
      label: "aperture-pmrem-dispatch",
    });
    const pass = encoder.beginComputePass({
      label: "aperture-pmrem-copy-constant",
    });

    pass.setPipeline(created.resource.pipeline as GPUComputePipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(dispatch.x, dispatch.y, dispatch.z);
    pass.end();

    const bytesPerRow = 256;
    const readback = device.createBuffer({
      label: "aperture-pmrem-readback",
      size: bytesPerRow,
      usage: bufferUsage.COPY_DST | bufferUsage.MAP_READ,
    });

    encoder.copyTextureToBuffer(
      { texture: output, origin: { x: 8, y: 8, z: 0 } },
      { buffer: readback, bytesPerRow, rowsPerImage: 1 },
      { width: 1, height: 1, depthOrArrayLayers: 1 },
    );
    device.queue.submit([encoder.finish()]);
    await readback.mapAsync(mapMode.READ);

    const pixel = Array.from(
      new Uint8Array(readback.getMappedRange()).slice(0, 4),
    );

    readback.unmap();
    source.destroy();
    output.destroy();

    return {
      ok: true,
      pixel,
      expected: color,
      dispatch,
      workgroupSize: created.resource.workgroupSize,
      storageFormat: created.resource.storageFormat,
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
    expected: [42, 190, 96, 255],
    dispatch: { x: 2, y: 2, z: 6 },
    workgroupSize: [8, 8, 1],
    storageFormat: "rgba8unorm",
  });
  expect(result.pixel).toEqual(result.expected);
});

test("PMREM compute pipeline writes rougher colors into higher mips", async ({
  page,
}) => {
  await page.goto("/examples/");

  const result = await page.evaluate(async () => {
    if (navigator.gpu === undefined) {
      return { ok: false, reason: "webgpu-unavailable" };
    }

    const adapter = await navigator.gpu.requestAdapter();

    if (adapter === null) {
      return { ok: false, reason: "adapter-unavailable" };
    }

    const device = await adapter.requestDevice();
    const webgpu = await import("@aperture-engine/webgpu");
    const browserGlobals = globalThis as unknown as {
      readonly GPUTextureUsage?: {
        readonly COPY_SRC: number;
        readonly COPY_DST: number;
        readonly TEXTURE_BINDING: number;
        readonly STORAGE_BINDING: number;
      };
      readonly GPUBufferUsage?: {
        readonly MAP_READ: number;
        readonly COPY_DST: number;
        readonly COPY_SRC: number;
        readonly UNIFORM: number;
      };
      readonly GPUMapMode?: { readonly READ: number };
    };
    const textureUsage = browserGlobals.GPUTextureUsage ?? {
      COPY_SRC: 0x01,
      COPY_DST: 0x02,
      TEXTURE_BINDING: 0x04,
      STORAGE_BINDING: 0x08,
    };
    const bufferUsage = browserGlobals.GPUBufferUsage ?? {
      MAP_READ: 0x01,
      COPY_DST: 0x08,
      UNIFORM: 0x40,
      COPY_SRC: 0x04,
    };
    const mapMode = browserGlobals.GPUMapMode ?? { READ: 0x01 };
    const size = 16;
    const layers = 6;
    const format = "rgba8unorm";
    const redFace = [220, 24, 24, 255];
    const greenFace = [24, 220, 72, 255];
    const source = device.createTexture({
      label: "aperture-pmrem-mip-source",
      size: { width: size, height: size, depthOrArrayLayers: layers },
      dimension: "2d",
      format,
      usage: textureUsage.TEXTURE_BINDING | textureUsage.COPY_DST,
    });
    const output = device.createTexture({
      label: "aperture-pmrem-mip-output",
      size: { width: size, height: size, depthOrArrayLayers: layers },
      dimension: "2d",
      format,
      usage: textureUsage.STORAGE_BINDING | textureUsage.COPY_SRC,
      mipLevelCount: 3,
    });

    for (let layer = 0; layer < layers; layer += 1) {
      const color = layer === 4 ? greenFace : redFace;
      const faceBytes = new Uint8Array(size * size * 4);

      for (let index = 0; index < faceBytes.length; index += 4) {
        faceBytes.set(color, index);
      }

      device.queue.writeTexture(
        { texture: source, origin: { x: 0, y: 0, z: layer } },
        faceBytes,
        { bytesPerRow: size * 4, rowsPerImage: size },
        { width: size, height: size, depthOrArrayLayers: 1 },
      );
    }

    const created = webgpu.createPmremComputePipeline({
      device: device as unknown as Parameters<
        typeof webgpu.createPmremComputePipeline
      >[0]["device"],
      storageFormat: format,
    });

    if (!created.valid || created.resource === null) {
      return {
        ok: false,
        reason: "pipeline-invalid",
        diagnostics: created.diagnostics,
      };
    }

    const sampler = device.createSampler({
      label: "aperture-pmrem-mip-source-sampler",
      magFilter: "nearest",
      minFilter: "nearest",
    });
    const sourceView = source.createView({ dimension: "cube" });
    const mip0Params = device.createBuffer({
      label: "aperture-pmrem-mip0-params",
      size: 16,
      usage: bufferUsage.UNIFORM | bufferUsage.COPY_DST,
    });
    const mip2Params = device.createBuffer({
      label: "aperture-pmrem-mip2-params",
      size: 16,
      usage: bufferUsage.UNIFORM | bufferUsage.COPY_DST,
    });

    device.queue.writeBuffer(
      mip0Params,
      0,
      new Uint32Array([size, size, layers, 0]),
    );
    device.queue.writeBuffer(mip2Params, 0, new Uint32Array([4, 4, layers, 2]));

    const mip0BindGroup = device.createBindGroup({
      label: "aperture-pmrem-mip0-bind-group",
      layout: created.resource.bindGroupLayout as GPUBindGroupLayout,
      entries: [
        { binding: 0, resource: sampler },
        { binding: 1, resource: sourceView },
        {
          binding: 2,
          resource: output.createView({
            dimension: "2d-array",
            baseMipLevel: 0,
            mipLevelCount: 1,
          }),
        },
        { binding: 3, resource: { buffer: mip0Params } },
      ],
    });
    const mip2BindGroup = device.createBindGroup({
      label: "aperture-pmrem-mip2-bind-group",
      layout: created.resource.bindGroupLayout as GPUBindGroupLayout,
      entries: [
        { binding: 0, resource: sampler },
        { binding: 1, resource: sourceView },
        {
          binding: 2,
          resource: output.createView({
            dimension: "2d-array",
            baseMipLevel: 2,
            mipLevelCount: 1,
          }),
        },
        { binding: 3, resource: { buffer: mip2Params } },
      ],
    });
    const mip0Dispatch = webgpu.createPmremComputeDispatchSize({
      width: size,
      height: size,
      layers,
    });
    const mip2Dispatch = webgpu.createPmremComputeDispatchSize({
      width: 4,
      height: 4,
      layers,
    });
    const encoder = device.createCommandEncoder({
      label: "aperture-pmrem-mip-dispatch",
    });
    const pass = encoder.beginComputePass({
      label: "aperture-pmrem-mip-chain",
    });

    pass.setPipeline(created.resource.pipeline as GPUComputePipeline);
    pass.setBindGroup(0, mip0BindGroup);
    pass.dispatchWorkgroups(mip0Dispatch.x, mip0Dispatch.y, mip0Dispatch.z);
    pass.setBindGroup(0, mip2BindGroup);
    pass.dispatchWorkgroups(mip2Dispatch.x, mip2Dispatch.y, mip2Dispatch.z);
    pass.end();

    const bytesPerRow = 256;
    const mip0Readback = device.createBuffer({
      label: "aperture-pmrem-mip0-readback",
      size: bytesPerRow,
      usage: bufferUsage.COPY_DST | bufferUsage.MAP_READ,
    });
    const mip2Readback = device.createBuffer({
      label: "aperture-pmrem-mip2-readback",
      size: bytesPerRow,
      usage: bufferUsage.COPY_DST | bufferUsage.MAP_READ,
    });

    encoder.copyTextureToBuffer(
      { texture: output, mipLevel: 0, origin: { x: 8, y: 8, z: 4 } },
      { buffer: mip0Readback, bytesPerRow, rowsPerImage: 1 },
      { width: 1, height: 1, depthOrArrayLayers: 1 },
    );
    encoder.copyTextureToBuffer(
      { texture: output, mipLevel: 2, origin: { x: 2, y: 2, z: 4 } },
      { buffer: mip2Readback, bytesPerRow, rowsPerImage: 1 },
      { width: 1, height: 1, depthOrArrayLayers: 1 },
    );
    device.queue.submit([encoder.finish()]);
    await Promise.all([
      mip0Readback.mapAsync(mapMode.READ),
      mip2Readback.mapAsync(mapMode.READ),
    ]);

    const mip0 = Array.from(
      new Uint8Array(mip0Readback.getMappedRange()).slice(0, 4),
    );
    const mip2 = Array.from(
      new Uint8Array(mip2Readback.getMappedRange()).slice(0, 4),
    );

    mip0Readback.unmap();
    mip2Readback.unmap();
    source.destroy();
    output.destroy();

    return {
      ok: true,
      mip0,
      mip2,
      greenFace,
      redFace,
      mip0Dispatch,
      mip2Dispatch,
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
    greenFace: [24, 220, 72, 255],
    redFace: [220, 24, 24, 255],
    mip0Dispatch: { x: 2, y: 2, z: 6 },
    mip2Dispatch: { x: 1, y: 1, z: 6 },
  });
  expect(result.mip0).toEqual(result.greenFace);
  expect(
    pixelDistance(
      rgbaArrayToPixel(result.mip0 ?? []),
      rgbaArrayToPixel(result.mip2 ?? []),
    ),
  ).toBeGreaterThan(80);
  expect(result.mip2?.[1] ?? 255).toBeLessThan(result.mip0?.[1] ?? 0);
});

function rgbaArrayToPixel(value: readonly number[]) {
  return {
    r: value[0] ?? 0,
    g: value[1] ?? 0,
    b: value[2] ?? 0,
    a: value[3] ?? 0,
  };
}
