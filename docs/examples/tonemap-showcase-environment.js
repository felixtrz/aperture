export const tonemapShowcaseEnvironmentAsset = {
  path: "./assets/pisa-studio-rgbe-cube.hdr",
  url: new URL("./assets/pisa-studio-rgbe-cube.hdr", import.meta.url),
  label: "Pisa HDR studio cube atlas",
  faceOrder: ["px", "nx", "py", "ny", "pz", "nz"],
};

export async function loadTonemapShowcaseEnvironment(aperture) {
  const loaded = await aperture.loadHdrFromUri(
    tonemapShowcaseEnvironmentAsset.url.href,
  );

  if (!loaded.ok || loaded.image === null) {
    const firstDiagnostic = loaded.diagnostics[0];

    throw new Error(
      firstDiagnostic?.message ??
        `Could not load Radiance HDR environment ${tonemapShowcaseEnvironmentAsset.path}.`,
    );
  }

  return decodeRgbeCubeAtlas(loaded.image, tonemapShowcaseEnvironmentAsset);
}

export function createTonemapShowcaseIblResources(
  aperture,
  app,
  environmentSource,
) {
  const cache = aperture.getOrCreateWebGpuAppEnvironmentResourceCache(app);
  const device = app.initialization.device;
  const diffuseResourceKey =
    "texture:tonemap-showcase-pisa-studio:diffuse:texture";
  const specularResourceKey =
    "texture:tonemap-showcase-pisa-studio:specular-prefilter:texture";
  const samplerResourceKey =
    "texture:tonemap-showcase-pisa-studio:diffuse:sampler";
  let diffuseTexture = cache.diffuseTextures.get(diffuseResourceKey);
  let iblSampler = cache.samplers.get(samplerResourceKey);

  if (diffuseTexture === undefined) {
    diffuseTexture = createEnvironmentDiffuseCubeTexture(
      aperture,
      device,
      diffuseResourceKey,
      environmentSource,
    );
    cache.diffuseTextures.set(diffuseResourceKey, diffuseTexture);
  }

  const specularTextureResource =
    aperture.createSpecularIblTextureResourceReport({
      device,
      textures: createTonemapShowcaseIblTexturePreparation(aperture),
      cache: cache.specularTextures,
      pmremSources: [
        {
          resourceKey: specularResourceKey,
          label: "tonemap-showcase-pisa-studio",
          faceSize: environmentSource.faceSize,
          faces: environmentSource.faces.map((face) => face.rgba),
          format: "rgba8unorm",
          mipLevelCount: 4,
        },
      ],
    });

  if (iblSampler === undefined) {
    iblSampler = createDiffuseIblSampler(device, samplerResourceKey);
    cache.samplers.set(samplerResourceKey, iblSampler);
  }

  return {
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
        resourceKey: "bind-group:standard/ibl/group-4/tonemap-showcase",
        layoutKey: "standard/ibl/group-4",
        bindGroup: {
          label: "standard/ibl/group-4/tonemap-showcase",
        },
        entryResourceKeys: [
          diffuseResourceKey,
          specularResourceKey,
          samplerResourceKey,
        ],
      },
      diagnostics: [],
    },
    diffuseTextureResource: {
      ready: true,
      status: "available",
      textureSlotCount: 1,
      diffuseSlotCount: 1,
      createdTextureCount: 1,
      reusedTextureCount: 0,
      sections: {
        texturePreparation: true,
        diffuseTextureResource: true,
        gpuAllocation: true,
        specularPrefiltering: false,
        shaderSampling: true,
      },
      resources: [
        {
          valid: true,
          resource: diffuseTexture,
          diagnostics: [],
        },
      ],
      diagnostics: [],
    },
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
      resources: [
        {
          valid: true,
          resource: iblSampler,
          diagnostics: [],
        },
      ],
      diagnostics: [],
    },
  };
}

function createTonemapShowcaseIblTexturePreparation(aperture) {
  const environmentMap = aperture.createEnvironmentMapHandle(
    "spinning-cube-pisa-studio",
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
        environmentMapResourceKey: "environment-map:spinning-cube-pisa-studio",
        diffuseResourceKey: "texture:tonemap-showcase-pisa-studio:diffuse",
        specularResourceKey:
          "texture:tonemap-showcase-pisa-studio:specular-prefilter",
      },
    ],
  });

  return aperture.createIblTexturePreparationReport({
    descriptors,
    preparation: "ready",
  });
}

function createEnvironmentDiffuseCubeTexture(
  aperture,
  device,
  resourceKey,
  environmentSource,
) {
  const usage = resolveTextureUsage(aperture);
  const texture = device.createTexture({
    label: "tonemap-showcase-pisa-studio:diffuse-ibl",
    size: [1, 1, 6],
    format: "rgba8unorm",
    usage: usage.TEXTURE_BINDING | usage.COPY_DST,
    mipLevelCount: 1,
  });

  environmentSource.faceAverages.forEach((color, face) => {
    const data = new Uint8Array(256);

    data.set(color, 0);
    device.queue.writeTexture(
      { texture, origin: [0, 0, face] },
      data,
      { bytesPerRow: 256, rowsPerImage: 1 },
      [1, 1, 1],
    );
  });

  return {
    resourceKey,
    texture,
    view: texture.createView({
      label: "tonemap-showcase-pisa-studio:diffuse-ibl-view",
      dimension: "cube",
    }),
    descriptor: {
      label: "tonemap-showcase-pisa-studio:diffuse-ibl",
      size: [1, 1, 6],
      format: "rgba8unorm",
      usage: usage.TEXTURE_BINDING | usage.COPY_DST,
      mipLevelCount: 1,
    },
    viewDescriptor: { dimension: "cube" },
  };
}

function createDiffuseIblSampler(device, resourceKey) {
  const descriptor = {
    label: "tonemap-showcase-pisa-studio:diffuse-ibl-sampler",
    addressModeU: "clamp-to-edge",
    addressModeV: "clamp-to-edge",
    addressModeW: "clamp-to-edge",
    magFilter: "linear",
    minFilter: "linear",
    mipmapFilter: "linear",
    lodMinClamp: 0,
    lodMaxClamp: 3,
    maxAnisotropy: 1,
  };

  return {
    resourceKey,
    sampler: device.createSampler(descriptor),
    descriptor,
  };
}

function decodeRgbeCubeAtlas(image, asset) {
  const height = image.height;
  const width = image.width;
  const faceCount = asset.faceOrder.length;

  if (height <= 0 || width <= 0 || width % faceCount !== 0) {
    throw new Error(
      `Radiance HDR asset ${asset.path} must be a horizontal cube atlas.`,
    );
  }

  const faceSize = width / faceCount;

  if (faceSize !== height) {
    throw new Error(
      `Radiance HDR asset ${asset.path} must contain square cube faces.`,
    );
  }

  const faces = asset.faceOrder.map((name, faceIndex) => {
    const rgba = new Uint8Array(faceSize * faceSize * 4);

    for (let y = 0; y < faceSize; y += 1) {
      for (let x = 0; x < faceSize; x += 1) {
        const src = (y * width + faceIndex * faceSize + x) * 4;
        const dst = (y * faceSize + x) * 4;

        rgba.set(
          linearRgbToDisplayRgba(
            image.data[src],
            image.data[src + 1],
            image.data[src + 2],
          ),
          dst,
        );
      }
    }

    return {
      name,
      rgba,
    };
  });
  const faceAverages = faces.map((face) => averageRgba(face.rgba));

  return {
    kind: "radiance-rgbe-cube-atlas",
    loader: "loadHdrFromUri",
    assetPath: asset.path,
    label: asset.label,
    sourceFormat: image.format,
    sourceColorSpace: image.colorSpace,
    width,
    height,
    faceSize,
    faceOrder: [...asset.faceOrder],
    faces,
    faceAverages,
  };
}

function linearRgbToDisplayRgba(r, g, b) {
  return [
    linearToDisplayByte(r),
    linearToDisplayByte(g),
    linearToDisplayByte(b),
    255,
  ];
}

function linearToDisplayByte(value) {
  const mapped = 1 - Math.exp(-Math.max(0, value) * 1.15);

  return Math.max(0, Math.min(255, Math.round(mapped ** (1 / 2.2) * 255)));
}

function averageRgba(rgba) {
  let r = 0;
  let g = 0;
  let b = 0;
  const pixelCount = rgba.length / 4;

  for (let offset = 0; offset < rgba.length; offset += 4) {
    r += rgba[offset];
    g += rgba[offset + 1];
    b += rgba[offset + 2];
  }

  return [
    Math.round(r / pixelCount),
    Math.round(g / pixelCount),
    Math.round(b / pixelCount),
    255,
  ];
}

function resolveTextureUsage(aperture) {
  return globalThis.GPUTextureUsage ?? aperture.WEBGPU_TEXTURE_USAGE_FLAGS;
}
