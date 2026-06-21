// M4-T8 proof: render an alpha-cutout quad as a shadow CASTER using the
// alpha-test caster pipeline (SHADOW_CASTER_ALPHA_TEST_WGSL) into a depth
// texture, then read the depth back. The depth/shadow map is PERFORATED — it
// has holes (cleared depth == 1.0, where the checkerboard alpha < cutoff, so
// the fragment was discarded) interleaved with written texels (depth < 1.0,
// where alpha >= cutoff). The opaque depth-only pipeline over the same quad
// writes a SOLID map (no holes). This is the perforated-shadow footprint:
// lit samples (holes) and shadowed samples (written) coexist for the alpha-test
// caster, while the opaque caster is a solid silhouette.

const stateElement = document.querySelector("#example-state");
const jsonElement = document.querySelector("#example-json");

const SHADOW_SIZE = 64;
const ALPHA_CUTOFF = 0.5;

// Interleaved quad: position.xyz (clip space) + uv. Fills most of clip space.
// Fills the whole depth target so the opaque caster writes a fully solid map
// (every footprint texel covered) and only the alpha cutout creates holes.
// prettier-ignore
const QUAD_VERTICES = new Float32Array([
  -1.0, -1.0, 0.5, 0, 0,
   1.0, -1.0, 0.5, 1, 0,
   1.0,  1.0, 0.5, 1, 1,
  -1.0,  1.0, 0.5, 0, 1,
]);
const QUAD_INDICES = new Uint16Array([0, 1, 2, 0, 2, 3]);

try {
  const webgpu = await import("/aperture/worker-modules/packages/webgpu/dist/index.js");

  const initialized = await webgpu.initializeWebGpu({
    canvas: document.querySelector("#aperture-canvas"),
  });

  if (!initialized.ok) {
    publish(
      failure(
        initialized.reason ?? "webgpu-unavailable",
        initialized.message ?? "WebGPU is not available.",
      ),
    );
  } else {
    const device = initialized.device;
    const alphaTest = await renderShadowDepth(device, webgpu, true);
    const opaque = await renderShadowDepth(device, webgpu, false);

    publish({
      example: "alpha-shadow",
      ok: true,
      phase: "render",
      renderingBackend: "webgpu-explicit",
      cutoff: ALPHA_CUTOFF,
      shadowSize: SHADOW_SIZE,
      // Alpha-test caster: a PERFORATED shadow map — both holes (lit) and
      // written (shadowed) texels exist inside the quad footprint.
      alphaTest: {
        mode: "alpha-test",
        holeTexels: alphaTest.holeTexels,
        writtenTexels: alphaTest.writtenTexels,
        perforated: alphaTest.holeTexels > 0 && alphaTest.writtenTexels > 0,
      },
      // Opaque caster: a SOLID silhouette — the footprint is fully written.
      opaque: {
        mode: "opaque",
        holeTexels: opaque.holeTexels,
        writtenTexels: opaque.writtenTexels,
        solid: opaque.holeTexels === 0 && opaque.writtenTexels > 0,
      },
    });
  }
} catch (error) {
  publish(
    failure(
      "alpha-shadow-failed",
      error instanceof Error ? error.message : "Alpha-shadow example failed.",
    ),
  );
}

async function renderShadowDepth(device, webgpu, useAlphaTest) {
  const code = useAlphaTest
    ? webgpu.SHADOW_CASTER_ALPHA_TEST_WGSL
    : webgpu.SHADOW_CASTER_DEPTH_ONLY_WGSL;
  const module = device.createShaderModule({ code });

  // group(0): the shadow matrices storage buffer (a single identity matrix).
  const matrixLayout = device.createBindGroupLayout({
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.VERTEX,
        buffer: { type: "read-only-storage" },
      },
    ],
  });
  const identity = new Float32Array([
    1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1,
  ]);
  const matrixBuffer = device.createBuffer({
    size: identity.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(matrixBuffer, 0, identity);
  const matrixBindGroup = device.createBindGroup({
    layout: matrixLayout,
    entries: [{ binding: 0, resource: { buffer: matrixBuffer } }],
  });

  const bindGroupLayouts = [matrixLayout];
  let materialBindGroup = null;

  if (useAlphaTest) {
    // group(1): the material baseColor texture + sampler + alpha cutoff.
    const materialLayout = device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.FRAGMENT,
          texture: { sampleType: "float" },
        },
        {
          binding: 1,
          visibility: GPUShaderStage.FRAGMENT,
          sampler: { type: "filtering" },
        },
        {
          binding: 2,
          visibility: GPUShaderStage.FRAGMENT,
          buffer: { type: "uniform" },
        },
      ],
    });
    const texture = createCheckerboardAlphaTexture(device);
    const sampler = device.createSampler({
      magFilter: "nearest",
      minFilter: "nearest",
    });
    const cutoffBuffer = device.createBuffer({
      size: 16,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(cutoffBuffer, 0, new Float32Array([ALPHA_CUTOFF]));
    materialBindGroup = device.createBindGroup({
      layout: materialLayout,
      entries: [
        { binding: 0, resource: texture.createView() },
        { binding: 1, resource: sampler },
        { binding: 2, resource: { buffer: cutoffBuffer } },
      ],
    });
    bindGroupLayouts.push(materialLayout);
  }

  const pipelineLayout = device.createPipelineLayout({ bindGroupLayouts });
  const vertexBuffers = [
    {
      arrayStride: 20,
      attributes: useAlphaTest
        ? [
            { shaderLocation: 0, offset: 0, format: "float32x3" },
            { shaderLocation: 1, offset: 12, format: "float32x2" },
          ]
        : [{ shaderLocation: 0, offset: 0, format: "float32x3" }],
    },
  ];
  const pipeline = device.createRenderPipeline({
    layout: pipelineLayout,
    vertex: { module, entryPoint: "vs_main", buffers: vertexBuffers },
    fragment: { module, entryPoint: "fs_main", targets: [] },
    primitive: { topology: "triangle-list", cullMode: "none" },
    depthStencil: {
      format: "depth32float",
      depthWriteEnabled: true,
      depthCompare: "less-equal",
    },
  });

  const vertexBuffer = device.createBuffer({
    size: QUAD_VERTICES.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(vertexBuffer, 0, QUAD_VERTICES);
  const indexBuffer = device.createBuffer({
    size: QUAD_INDICES.byteLength,
    usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(indexBuffer, 0, QUAD_INDICES);

  const depthTexture = device.createTexture({
    size: [SHADOW_SIZE, SHADOW_SIZE],
    format: "depth32float",
    usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
  });

  const encoder = device.createCommandEncoder();
  const pass = encoder.beginRenderPass({
    colorAttachments: [],
    depthStencilAttachment: {
      view: depthTexture.createView(),
      depthClearValue: 1.0,
      depthLoadOp: "clear",
      depthStoreOp: "store",
    },
  });
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, matrixBindGroup);
  if (materialBindGroup !== null) {
    pass.setBindGroup(1, materialBindGroup);
  }
  pass.setVertexBuffer(0, vertexBuffer);
  pass.setIndexBuffer(indexBuffer, "uint16");
  pass.drawIndexed(QUAD_INDICES.length);
  pass.end();

  // Read back the depth (depth32float supports copyTextureToBuffer).
  const bytesPerRow = Math.ceil((SHADOW_SIZE * 4) / 256) * 256;
  const readBuffer = device.createBuffer({
    size: bytesPerRow * SHADOW_SIZE,
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
  });
  encoder.copyTextureToBuffer(
    { texture: depthTexture, aspect: "depth-only" },
    { buffer: readBuffer, bytesPerRow },
    [SHADOW_SIZE, SHADOW_SIZE],
  );
  device.queue.submit([encoder.finish()]);

  await readBuffer.mapAsync(GPUMapMode.READ);
  const data = new Float32Array(readBuffer.getMappedRange().slice(0));
  readBuffer.unmap();

  let holeTexels = 0;
  let writtenTexels = 0;
  const floatsPerRow = bytesPerRow / 4;
  for (let y = 0; y < SHADOW_SIZE; y += 1) {
    for (let x = 0; x < SHADOW_SIZE; x += 1) {
      const depth = data[y * floatsPerRow + x];
      if (depth >= 0.999) {
        holeTexels += 1;
      } else {
        writtenTexels += 1;
      }
    }
  }

  return { holeTexels, writtenTexels };
}

function createCheckerboardAlphaTexture(device) {
  const size = 8;
  const pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const i = (y * size + x) * 4;
      const opaque = (x + y) % 2 === 0;
      pixels[i] = 255;
      pixels[i + 1] = 255;
      pixels[i + 2] = 255;
      pixels[i + 3] = opaque ? 255 : 0;
    }
  }
  const texture = device.createTexture({
    size: [size, size],
    format: "rgba8unorm",
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
  });
  device.queue.writeTexture({ texture }, pixels, { bytesPerRow: size * 4 }, [
    size,
    size,
  ]);
  return texture;
}

function publish(status) {
  globalThis.__APERTURE_EXAMPLE_STATUS__ = status;
  window.__APERTURE_EXAMPLE_STATUS__ = status;
  if (stateElement !== null) {
    stateElement.textContent = status.ok ? (status.phase ?? "ready") : "failed";
  }
  if (jsonElement !== null) {
    jsonElement.textContent = JSON.stringify(status, null, 2);
  }
}

function failure(reason, message) {
  return {
    example: "alpha-shadow",
    ok: false,
    phase: "failed",
    reason,
    message,
  };
}
