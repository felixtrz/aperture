// IBL from a single equirectangular HDR. A small 2:1 equirect is synthesized as
// a valid flat-RGBE .hdr (a bright vertical band at the +Z longitude over a dark
// surround), loaded via loadHdrFromUri (data URL), projected to a cubemap by the
// equirect->cube compute pass, then read back to 6 faces that feed BOTH the
// specular PMREM prefilter and the diffuse irradiance convolution — i.e. one HDR
// asset auto-derives the whole IBL chain.

const ENV_MAP_KEY = "environment-map:ibl-equirect-demo";
const DIFFUSE_KEY = "texture:ibl-equirect-demo:diffuse";
const SPECULAR_KEY = "texture:ibl-equirect-demo:specular-prefilter";
const SAMPLER_KEY = "texture:ibl-equirect-demo:sampler";
const EQUIRECT_WIDTH = 64;
const EQUIRECT_HEIGHT = 32;
const CUBE_FACE_SIZE = 64;

function floatToRgbe(r, g, b) {
  const v = Math.max(r, g, b);

  if (v < 1e-9) {
    return [0, 0, 0, 0];
  }

  const e = Math.ceil(Math.log2(v));
  const scale = 255 / Math.pow(2, e);
  const clamp = (x) => Math.min(255, Math.max(0, Math.round(x)));

  return [clamp(r * scale), clamp(g * scale), clamp(b * scale), e + 128];
}

function synthesizeEquirectHdr() {
  // Bright band at the centre column (u≈0.5 → +Z longitude); dark elsewhere.
  const rgbe = new Uint8Array(EQUIRECT_WIDTH * EQUIRECT_HEIGHT * 4);

  for (let y = 0; y < EQUIRECT_HEIGHT; y += 1) {
    for (let x = 0; x < EQUIRECT_WIDTH; x += 1) {
      const bright = Math.abs(x - EQUIRECT_WIDTH / 2) <= 2 ? 3.0 : 0.04;
      const [r, g, b, e] = floatToRgbe(bright, bright, bright);
      const offset = (y * EQUIRECT_WIDTH + x) * 4;

      rgbe[offset] = r;
      rgbe[offset + 1] = g;
      rgbe[offset + 2] = b;
      rgbe[offset + 3] = e;
    }
  }

  const header = `#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n-Y ${EQUIRECT_HEIGHT} +X ${EQUIRECT_WIDTH}\n`;
  const headerBytes = new TextEncoder().encode(header);
  const hdr = new Uint8Array(headerBytes.length + rgbe.length);

  hdr.set(headerBytes, 0);
  hdr.set(rgbe, headerBytes.length);

  let binary = "";
  for (let i = 0; i < hdr.length; i += 1) {
    binary += String.fromCharCode(hdr[i]);
  }

  return {
    width: EQUIRECT_WIDTH,
    height: EQUIRECT_HEIGHT,
    dataUrl: `data:image/vnd.radiance;base64,${btoa(binary)}`,
  };
}

export async function loadIblEquirectEnvironment(aperture) {
  const synthetic = synthesizeEquirectHdr();
  const loaded = await aperture.loadHdrFromUri(synthetic.dataUrl);

  if (!loaded.ok || loaded.image === null) {
    throw new Error(
      loaded.diagnostics?.[0]?.message ??
        "Could not load the synthesized equirect HDR.",
    );
  }

  return {
    loader: "loadHdrFromUri",
    width: loaded.image.width,
    height: loaded.image.height,
    image: loaded.image,
  };
}

function floatEquirectToRgba8(image) {
  const pixelCount = image.width * image.height;
  const bytes = new Uint8Array(pixelCount * 4);

  for (let i = 0; i < pixelCount; i += 1) {
    bytes[i * 4] = Math.min(
      255,
      Math.max(0, Math.round(image.data[i * 4] * 255)),
    );
    bytes[i * 4 + 1] = Math.min(
      255,
      Math.max(0, Math.round(image.data[i * 4 + 1] * 255)),
    );
    bytes[i * 4 + 2] = Math.min(
      255,
      Math.max(0, Math.round(image.data[i * 4 + 2] * 255)),
    );
    bytes[i * 4 + 3] = 255;
  }

  return bytes;
}

async function readbackCubeFaces(device, texture, faceSize) {
  const bytesPerRow = faceSize * 4; // 256 for faceSize 64 (already aligned)
  const faceBytes = bytesPerRow * faceSize;
  const usage = globalThis.GPUBufferUsage ?? { COPY_DST: 0x08, MAP_READ: 0x01 };
  const buffer = device.createBuffer({
    label: "ibl-equirect:readback",
    size: faceBytes * 6,
    usage: usage.COPY_DST | usage.MAP_READ,
  });
  const encoder = device.createCommandEncoder({
    label: "ibl-equirect:readback",
  });

  encoder.copyTextureToBuffer(
    { texture },
    { buffer, bytesPerRow, rowsPerImage: faceSize },
    [faceSize, faceSize, 6],
  );
  device.queue.submit([encoder.finish()]);

  const mapRead = globalThis.GPUMapMode?.READ ?? 0x01;
  await buffer.mapAsync(mapRead);
  const mapped = new Uint8Array(buffer.getMappedRange()).slice();
  buffer.unmap();

  const faces = [];
  for (let layer = 0; layer < 6; layer += 1) {
    faces.push(mapped.slice(layer * faceBytes, (layer + 1) * faceBytes));
  }

  return faces;
}

function preparation(aperture) {
  const environmentMap =
    aperture.createEnvironmentMapHandle("ibl-equirect-demo");
  const descriptors = aperture.createIblResourceDescriptorReport({
    snapshot: [
      {
        environmentId: 1,
        handle: environmentMap,
        color: [1, 1, 1, 1],
        intensity: 1,
        layerMask: 1,
      },
    ],
    descriptors: [
      {
        environmentMapResourceKey: ENV_MAP_KEY,
        diffuseResourceKey: DIFFUSE_KEY,
        specularResourceKey: SPECULAR_KEY,
      },
    ],
  });

  return aperture.createIblTexturePreparationReport({
    descriptors,
    preparation: "ready",
  });
}

export async function createIblEquirectIblResources(aperture, app, image) {
  const device = app.initialization.device;
  const cache = aperture.getOrCreateWebGpuAppEnvironmentResourceCache(app);
  const equirectBytes = floatEquirectToRgba8(image);

  const projected = aperture.createEquirectToCubeResource({
    device,
    equirect: { width: image.width, height: image.height, data: equirectBytes },
    faceSize: CUBE_FACE_SIZE,
    format: "rgba8unorm",
    resourceKey: "ibl-equirect-demo:projected-cube",
  });

  if (!projected.ready || projected.resource === null) {
    throw new Error(
      projected.diagnostics?.[0]?.message ??
        "Equirect-to-cube projection failed.",
    );
  }

  const faces = await readbackCubeFaces(
    device,
    projected.resource.texture,
    CUBE_FACE_SIZE,
  );
  const textures = preparation(aperture);

  const specularTextureResource =
    aperture.createSpecularIblTextureResourceReport({
      device,
      textures,
      cache: cache.specularTextures,
      pmremSources: [
        {
          environmentMapResourceKey: ENV_MAP_KEY,
          label: "ibl-equirect-demo",
          faceSize: CUBE_FACE_SIZE,
          faces,
          format: "rgba8unorm",
          mipLevelCount: 4,
        },
      ],
    });

  const diffuseTextureResource = aperture.createDiffuseIblTextureResourceReport(
    {
      device,
      textures,
      convolveIrradiance: true,
      irradianceFaceSize: 32,
      diffuseSources: [
        {
          environmentMapResourceKey: ENV_MAP_KEY,
          label: "ibl-equirect-demo",
          faceSize: CUBE_FACE_SIZE,
          faces,
          format: "rgba8unorm",
        },
      ],
    },
  );

  let sampler = cache.samplers.get(SAMPLER_KEY);

  if (sampler === undefined) {
    const descriptor = {
      label: "ibl-equirect-demo:sampler",
      addressModeU: "clamp-to-edge",
      addressModeV: "clamp-to-edge",
      addressModeW: "clamp-to-edge",
      magFilter: "linear",
      minFilter: "linear",
      mipmapFilter: "linear",
      lodMinClamp: 0,
      lodMaxClamp: 4,
      maxAnisotropy: 1,
    };
    sampler = {
      resourceKey: SAMPLER_KEY,
      sampler: device.createSampler(descriptor),
      descriptor,
    };
    cache.samplers.set(SAMPLER_KEY, sampler);
  }

  const diffuseResourceKey =
    diffuseTextureResource.resources[0]?.resource?.resourceKey ?? DIFFUSE_KEY;
  const specularResourceKey =
    specularTextureResource.resources[0]?.resource?.resourceKey ?? SPECULAR_KEY;

  return {
    projection: "equirect-to-cube",
    faceCount: 6,
    specularPrefiltering: specularTextureResource.sections.prefiltering,
    diffuseConvolved: diffuseTextureResource.convolved === true,
    diffuseTextureResource,
    specularTextureResource,
    samplerResource: {
      ready: true,
      status: "available",
      samplerDescriptorCount: 1,
      createdSamplerCount: 1,
      reusedSamplerCount: 0,
      sections: {
        samplerDescriptors: true,
        gpuAllocation: true,
        bindGroupLayout: true,
        shaderSampling: true,
      },
      resources: [{ valid: true, resource: sampler, diagnostics: [] }],
      diagnostics: [],
    },
    bindGroupResource: {
      ready: true,
      status: "available",
      standardMaterialCount: 1,
      group: 4,
      createdBindGroupCount: 0,
      reusedBindGroupCount: 1,
      sections: {
        descriptorPlan: true,
        layoutResource: true,
        textureResources: true,
        samplerResource: true,
        bindGroupResource: true,
        shaderSampling: true,
      },
      resource: {
        group: 4,
        resourceKey: "bind-group:standard/ibl/group-4/ibl-equirect",
        layoutKey: "standard/ibl/group-4",
        bindGroup: { label: "standard/ibl/group-4/ibl-equirect" },
        entryResourceKeys: [
          diffuseResourceKey,
          specularResourceKey,
          SAMPLER_KEY,
        ],
      },
      diagnostics: [],
    },
  };
}
