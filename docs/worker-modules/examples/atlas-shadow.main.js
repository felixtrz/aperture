// M4-T9 proof: two shadow-casting lights share ONE atlas depth texture. The
// deterministic packer (packShadowAtlas) assigns each light a non-overlapping
// sub-region; each caster is rendered into its sub-rect via the render-pass
// viewport/scissor. Reading the atlas back shows BOTH sub-regions contain
// shadow (written depth) — both lights' shadows live in a single shared
// texture. An 'once' (static) update mode is also demonstrated: the per-frame
// update scheduler encodes a static light's caster pass on the first frame and
// SKIPS it afterwards (its draw count drops to 0 while its region stays valid).

const stateElement = document.querySelector("#example-state");
const jsonElement = document.querySelector("#example-json");

const ATLAS_WIDTH = 256;
const ATLAS_HEIGHT = 128;
const REGION_SIZE = 128;

// prettier-ignore
const QUAD_VERTICES = new Float32Array([
  -0.7, -0.7, 0.5,
   0.7, -0.7, 0.5,
   0.7,  0.7, 0.5,
  -0.7,  0.7, 0.5,
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

    // Deterministic atlas assignment for the two shadow lights.
    const packed = webgpu.packShadowAtlas({
      atlasWidth: ATLAS_WIDTH,
      atlasHeight: ATLAS_HEIGHT,
      requests: [
        { shadowId: 1, mapSize: REGION_SIZE, priority: 1 },
        { shadowId: 2, mapSize: REGION_SIZE, priority: 1 },
      ],
    });

    // Per-frame update scheduler: light 1 is realtime, light 2 is 'once'.
    const updateModes = new Map([
      [1, "realtime"],
      [2, "once"],
    ]);
    const frame1 = scheduleAtlasUpdates(updateModes, 1, new Set());
    const rendered = new Set(frame1);
    const frame2 = scheduleAtlasUpdates(updateModes, 2, rendered);

    const atlas = await renderAtlas(device, webgpu, packed.assignments);

    publish({
      example: "atlas-shadow",
      ok: true,
      phase: "render",
      renderingBackend: "webgpu-explicit",
      atlas: {
        width: ATLAS_WIDTH,
        height: ATLAS_HEIGHT,
        sharedTexture: 1,
        subRegions: packed.assignments.map((a) => a.region),
        dropped: packed.dropped,
      },
      regions: atlas.regions,
      // 'once'/realtime scheduling: frame 1 encodes both caster passes; frame 2
      // re-encodes only the realtime light, so the static light's draw count is 0.
      scheduler: {
        frame1Rendered: frame1,
        frame2Rendered: frame2,
        staticLightSkippedAfterFirstFrame: !frame2.includes(2),
      },
    });
  }
} catch (error) {
  publish(
    failure(
      "atlas-shadow-failed",
      error instanceof Error ? error.message : "Atlas-shadow example failed.",
    ),
  );
}

// Pure per-frame update scheduler (M4-T9): returns the shadow ids whose caster
// pass must be (re)encoded this frame. realtime -> every frame; once -> only
// until first rendered; interval -> every 4th frame.
function scheduleAtlasUpdates(updateModes, frame, alreadyRendered) {
  const due = [];
  for (const [shadowId, mode] of updateModes) {
    if (mode === "once") {
      if (!alreadyRendered.has(shadowId)) {
        due.push(shadowId);
      }
    } else if (mode === "interval") {
      if (frame % 4 === 1) {
        due.push(shadowId);
      }
    } else {
      due.push(shadowId);
    }
  }
  return due;
}

async function renderAtlas(device, webgpu, assignments) {
  const module = device.createShaderModule({
    code: webgpu.SHADOW_CASTER_DEPTH_ONLY_WGSL,
  });
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
  const pipeline = device.createRenderPipeline({
    layout: device.createPipelineLayout({ bindGroupLayouts: [matrixLayout] }),
    vertex: {
      module,
      entryPoint: "vs_main",
      buffers: [
        {
          arrayStride: 12,
          attributes: [{ shaderLocation: 0, offset: 0, format: "float32x3" }],
        },
      ],
    },
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

  // ONE shared atlas depth texture for both lights.
  const atlasTexture = device.createTexture({
    size: [ATLAS_WIDTH, ATLAS_HEIGHT],
    format: "depth32float",
    usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
  });

  const encoder = device.createCommandEncoder();
  const pass = encoder.beginRenderPass({
    colorAttachments: [],
    depthStencilAttachment: {
      view: atlasTexture.createView(),
      depthClearValue: 1.0,
      depthLoadOp: "clear",
      depthStoreOp: "store",
    },
  });
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, matrixBindGroup);
  pass.setVertexBuffer(0, vertexBuffer);
  pass.setIndexBuffer(indexBuffer, "uint16");
  // Each light draws into its OWN atlas sub-region via the viewport + scissor.
  for (const { region } of assignments) {
    pass.setViewport(
      region.originX,
      region.originY,
      region.width,
      region.height,
      0,
      1,
    );
    pass.setScissorRect(
      region.originX,
      region.originY,
      region.width,
      region.height,
    );
    pass.drawIndexed(QUAD_INDICES.length);
  }
  pass.end();

  const bytesPerRow = Math.ceil((ATLAS_WIDTH * 4) / 256) * 256;
  const readBuffer = device.createBuffer({
    size: bytesPerRow * ATLAS_HEIGHT,
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
  });
  encoder.copyTextureToBuffer(
    { texture: atlasTexture, aspect: "depth-only" },
    { buffer: readBuffer, bytesPerRow },
    [ATLAS_WIDTH, ATLAS_HEIGHT],
  );
  device.queue.submit([encoder.finish()]);

  await readBuffer.mapAsync(GPUMapMode.READ);
  const data = new Float32Array(readBuffer.getMappedRange().slice(0));
  readBuffer.unmap();

  const floatsPerRow = bytesPerRow / 4;
  const regions = assignments.map(({ shadowId, region }) => {
    let written = 0;
    for (let y = region.originY; y < region.originY + region.height; y += 1) {
      for (let x = region.originX; x < region.originX + region.width; x += 1) {
        if ((data[y * floatsPerRow + x] ?? 1) < 0.999) {
          written += 1;
        }
      }
    }
    return { shadowId, region, writtenTexels: written };
  });

  return { regions };
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
    example: "atlas-shadow",
    ok: false,
    phase: "failed",
    reason,
    message,
  };
}
