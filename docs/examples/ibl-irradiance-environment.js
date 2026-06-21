// IBL irradiance demo environment: a synthetic cube whose +X/+Y/+Z faces form a
// bright hemisphere over a dark -X/-Y/-Z hemisphere. Convolving it produces a
// smooth diffuse irradiance map (a directional gradient with hemisphere bleed
// into the dark side), vs the raw verbatim cube (sharp per-face values). The
// diffuse cube is built by the real createDiffuseIblTextureResourceReport so the
// GPU convolution runs.

const ENV_MAP_KEY = "environment-map:ibl-irradiance-demo";
const DIFFUSE_KEY = "texture:ibl-irradiance-demo:diffuse";
const SAMPLER_KEY = "texture:ibl-irradiance-demo:diffuse:sampler";
// Faces in cube-layer order: +X, -X, +Y, -Y, +Z, -Z. The +X/+Y/+Z faces are
// bright; the -X (left of the sphere) face is the darkest visible direction.
const BRIGHT_FACE_INDICES = [0, 2, 4];
const SOURCE_FACE_SIZE = 16;

export function createIblIrradianceEnvironmentSource() {
  const faces = [];
  // A bright hemisphere (+X, +Y, +Z faces) over a dark hemisphere (-X, -Y, -Z).
  // A single bright face convolves toward the global average (its solid angle is
  // small); a bright hemisphere keeps a strong directional irradiance gradient.
  const brightFaces = new Set(BRIGHT_FACE_INDICES);

  for (let face = 0; face < 6; face += 1) {
    const rgba = new Uint8Array(SOURCE_FACE_SIZE * SOURCE_FACE_SIZE * 4);
    const value = brightFaces.has(face) ? 235 : 14;

    for (let texel = 0; texel < rgba.length; texel += 4) {
      rgba[texel] = value;
      rgba[texel + 1] = value;
      rgba[texel + 2] = value;
      rgba[texel + 3] = 255;
    }

    faces.push(rgba);
  }

  return {
    kind: "synthetic-directional-cube",
    loader: "createIblIrradianceEnvironmentSource",
    faceSize: SOURCE_FACE_SIZE,
    brightFaceIndices: BRIGHT_FACE_INDICES,
    faces,
  };
}

export function createIblIrradianceIblResources(
  aperture,
  app,
  environmentSource,
  mode,
) {
  const cache = aperture.getOrCreateWebGpuAppEnvironmentResourceCache(app);
  const device = app.initialization.device;
  let iblSampler = cache.samplers.get(SAMPLER_KEY);

  const diffuseTextureResource = aperture.createDiffuseIblTextureResourceReport(
    {
      device,
      textures: createIrradiancePreparation(aperture),
      convolveIrradiance: mode === "convolved",
      irradianceFaceSize: 32,
      diffuseSources: [
        {
          environmentMapResourceKey: ENV_MAP_KEY,
          label: "ibl-irradiance-demo",
          faceSize: environmentSource.faceSize,
          faces: environmentSource.faces,
          format: "rgba8unorm",
        },
      ],
    },
  );

  if (iblSampler === undefined) {
    iblSampler = createDiffuseIblSampler(device);
    cache.samplers.set(SAMPLER_KEY, iblSampler);
  }

  const diffuseResourceKey =
    diffuseTextureResource.resources[0]?.resource?.resourceKey ?? DIFFUSE_KEY;

  return {
    diffuseTextureResource,
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
      resources: [{ valid: true, resource: iblSampler, diagnostics: [] }],
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
        resourceKey: "bind-group:standard/ibl/group-4/ibl-irradiance",
        layoutKey: "standard/ibl/group-4",
        bindGroup: { label: "standard/ibl/group-4/ibl-irradiance" },
        entryResourceKeys: [diffuseResourceKey, SAMPLER_KEY],
      },
      diagnostics: [],
    },
  };
}

function createIrradiancePreparation(aperture) {
  const environmentMap = aperture.createEnvironmentMapHandle(
    "ibl-irradiance-demo",
  );
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
        specularResourceKey: "texture:ibl-irradiance-demo:specular-prefilter",
      },
    ],
  });

  return aperture.createIblTexturePreparationReport({
    descriptors,
    preparation: "ready",
  });
}

function createDiffuseIblSampler(device) {
  const descriptor = {
    label: "ibl-irradiance-demo:diffuse-sampler",
    addressModeU: "clamp-to-edge",
    addressModeV: "clamp-to-edge",
    addressModeW: "clamp-to-edge",
    magFilter: "linear",
    minFilter: "linear",
    mipmapFilter: "linear",
    lodMinClamp: 0,
    lodMaxClamp: 0,
    maxAnisotropy: 1,
  };

  return {
    resourceKey: SAMPLER_KEY,
    sampler: device.createSampler(descriptor),
    descriptor,
  };
}
