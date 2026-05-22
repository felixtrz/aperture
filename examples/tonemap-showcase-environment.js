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
    "texture:tonemap-showcase-pisa-studio:specular-proof:texture";
  const samplerResourceKey =
    "texture:tonemap-showcase-pisa-studio:diffuse:sampler";
  let diffuseTexture = cache.diffuseTextures.get(diffuseResourceKey);
  let specularTexture = cache.specularTextures.get(specularResourceKey);
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

  if (specularTexture === undefined) {
    specularTexture = createEnvironmentSpecularCubeTexture(
      aperture,
      device,
      specularResourceKey,
      environmentSource,
    );
    cache.specularTextures.set(specularResourceKey, specularTexture);
  }

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
    specularTextureResource: {
      ready: true,
      status: "available",
      textureSlotCount: 1,
      specularSlotCount: 1,
      createdTextureCount: 1,
      reusedTextureCount: 0,
      sections: {
        texturePreparation: true,
        specularTextureResource: true,
        gpuAllocation: true,
        proofUpload: !specularTexture.prefiltered,
        prefiltering: specularTexture.prefiltered,
        bindGroupResource: false,
        shaderSampling: true,
      },
      resources: [
        {
          valid: true,
          resource: specularTexture,
          diagnostics: [],
        },
      ],
      diagnostics: specularTexture.prefiltered
        ? []
        : [
            {
              code: "iblTextureResource.specularPrefilteringDeferred",
              severity: "warning",
              message:
                "Specular IBL texture resource fell back to a deterministic minimal mip chain; full PMREM/GGX prefiltering remains deferred.",
            },
          ],
    },
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

function createEnvironmentSpecularCubeTexture(
  aperture,
  device,
  resourceKey,
  environmentSource,
) {
  const baseSize = environmentSource.faceSize;
  const mipLevelCount = 4;
  const usage = resolveTextureUsage(aperture);
  const bufferUsage = resolveBufferUsage();
  const pipeline = aperture.createPmremComputePipeline({
    device,
    storageFormat: "rgba8unorm",
    label: "tonemap-showcase-pisa-studio:pmrem",
  });

  if (!pipeline.valid || pipeline.resource === null) {
    return createEnvironmentSpecularFallbackCubeTexture(
      device,
      resourceKey,
      usage,
      environmentSource,
    );
  }

  const source = device.createTexture({
    label: "tonemap-showcase-pisa-studio:specular-ibl-source",
    size: [baseSize, baseSize, 6],
    format: "rgba8unorm",
    usage: usage.TEXTURE_BINDING | usage.COPY_DST,
  });
  const texture = device.createTexture({
    label: "tonemap-showcase-pisa-studio:specular-ibl-pmrem-mip-chain",
    size: [baseSize, baseSize, 6],
    format: "rgba8unorm",
    usage:
      usage.TEXTURE_BINDING | usage.STORAGE_BINDING | usage.RENDER_ATTACHMENT,
    mipLevelCount,
  });
  const faceUploads = environmentSource.faces.map((face) =>
    createPaddedFaceUpload(face.rgba, baseSize),
  );

  faceUploads.forEach((upload, face) => {
    device.queue.writeTexture(
      { texture: source, origin: [0, 0, face] },
      upload.data,
      { bytesPerRow: upload.bytesPerRow, rowsPerImage: baseSize },
      [baseSize, baseSize, 1],
    );
  });

  const sampler = device.createSampler({
    label: "tonemap-showcase-pisa-studio:pmrem-source-sampler",
    addressModeU: "clamp-to-edge",
    addressModeV: "clamp-to-edge",
    addressModeW: "clamp-to-edge",
    magFilter: "nearest",
    minFilter: "nearest",
  });
  const sourceView = source.createView({
    label: "tonemap-showcase-pisa-studio:pmrem-source-view",
    dimension: "cube",
  });
  const encoder = device.createCommandEncoder({
    label: "tonemap-showcase-pisa-studio:pmrem-dispatch",
  });
  const pass = encoder.beginComputePass({
    label: "tonemap-showcase-pisa-studio:pmrem-mip-chain",
  });

  pass.setPipeline(pipeline.resource.pipeline);

  for (let mipLevel = 0; mipLevel < mipLevelCount; mipLevel += 1) {
    const mipSize = Math.max(1, baseSize >> mipLevel);
    const params = device.createBuffer({
      label: `tonemap-showcase-pisa-studio:pmrem-mip-${mipLevel}-params`,
      size: 16,
      usage: bufferUsage.UNIFORM | bufferUsage.COPY_DST,
    });

    device.queue.writeBuffer(
      params,
      0,
      new Uint32Array([mipSize, mipSize, 6, mipLevel]),
    );

    const bindGroup = device.createBindGroup({
      label: `tonemap-showcase-pisa-studio:pmrem-mip-${mipLevel}`,
      layout: pipeline.resource.bindGroupLayout,
      entries: [
        { binding: 0, resource: sampler },
        { binding: 1, resource: sourceView },
        {
          binding: 2,
          resource: texture.createView({
            dimension: "2d-array",
            baseMipLevel: mipLevel,
            mipLevelCount: 1,
          }),
        },
        { binding: 3, resource: { buffer: params } },
      ],
    });
    const dispatch = aperture.createPmremComputeDispatchSize({
      width: mipSize,
      height: mipSize,
      layers: 6,
    });

    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(dispatch.x, dispatch.y, dispatch.z);
  }

  pass.end();
  device.queue.submit([encoder.finish()]);

  return {
    resourceKey,
    texture,
    view: texture.createView({
      label: "tonemap-showcase-pisa-studio:specular-ibl-pmrem-mip-chain-view",
      dimension: "cube",
    }),
    descriptor: {
      label: "tonemap-showcase-pisa-studio:specular-ibl-pmrem-mip-chain",
      size: [baseSize, baseSize, 6],
      format: "rgba8unorm",
      usage:
        usage.TEXTURE_BINDING | usage.STORAGE_BINDING | usage.RENDER_ATTACHMENT,
      mipLevelCount,
    },
    viewDescriptor: { dimension: "cube" },
    prefiltered: true,
  };
}

function createEnvironmentSpecularFallbackCubeTexture(
  device,
  resourceKey,
  usage,
  environmentSource,
) {
  const baseSize = environmentSource.faceSize;
  const mipLevelCount = 4;
  const texture = device.createTexture({
    label: "tonemap-showcase-pisa-studio:specular-ibl-minimal-mip-chain",
    size: [baseSize, baseSize, 6],
    format: "rgba8unorm",
    usage: usage.TEXTURE_BINDING | usage.COPY_DST,
    mipLevelCount,
  });

  for (let mipLevel = 0; mipLevel < mipLevelCount; mipLevel += 1) {
    const mipSize = Math.max(1, baseSize >> mipLevel);

    environmentSource.faces.forEach((sourceFace, face) => {
      const upload = createFallbackMipUpload(
        sourceFace.rgba,
        environmentSource.faceAverages[face],
        baseSize,
        mipSize,
      );

      device.queue.writeTexture(
        { texture, mipLevel, origin: [0, 0, face] },
        upload.data,
        { bytesPerRow: upload.bytesPerRow, rowsPerImage: mipSize },
        [mipSize, mipSize, 1],
      );
    });
  }

  return {
    resourceKey,
    texture,
    view: texture.createView({
      label: "tonemap-showcase-pisa-studio:specular-ibl-minimal-mip-chain-view",
      dimension: "cube",
    }),
    descriptor: {
      label: "tonemap-showcase-pisa-studio:specular-ibl-minimal-mip-chain",
      size: [baseSize, baseSize, 6],
      format: "rgba8unorm",
      usage: usage.TEXTURE_BINDING | usage.COPY_DST,
      mipLevelCount,
    },
    viewDescriptor: { dimension: "cube" },
    prefiltered: false,
  };
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

function createPaddedFaceUpload(rgba, size) {
  const bytesPerRow = alignTo(size * 4, 256);
  const data = new Uint8Array(bytesPerRow * size);

  for (let row = 0; row < size; row += 1) {
    data.set(
      rgba.subarray(row * size * 4, (row + 1) * size * 4),
      row * bytesPerRow,
    );
  }

  return { data, bytesPerRow };
}

function createFallbackMipUpload(sourceRgba, faceAverage, baseSize, mipSize) {
  const bytesPerRow = alignTo(mipSize * 4, 256);
  const data = new Uint8Array(bytesPerRow * mipSize);
  const sourceStep = baseSize / mipSize;

  for (let y = 0; y < mipSize; y += 1) {
    for (let x = 0; x < mipSize; x += 1) {
      const sourceX = Math.min(baseSize - 1, Math.floor(x * sourceStep));
      const sourceY = Math.min(baseSize - 1, Math.floor(y * sourceStep));
      const source = (sourceY * baseSize + sourceX) * 4;
      const target = y * bytesPerRow + x * 4;

      data[target] = Math.round((sourceRgba[source] + faceAverage[0]) * 0.5);
      data[target + 1] = Math.round(
        (sourceRgba[source + 1] + faceAverage[1]) * 0.5,
      );
      data[target + 2] = Math.round(
        (sourceRgba[source + 2] + faceAverage[2]) * 0.5,
      );
      data[target + 3] = 255;
    }
  }

  return { data, bytesPerRow };
}

function resolveTextureUsage(aperture) {
  return globalThis.GPUTextureUsage ?? aperture.WEBGPU_TEXTURE_USAGE_FLAGS;
}

function resolveBufferUsage() {
  return globalThis.GPUBufferUsage ?? { UNIFORM: 0x40, COPY_DST: 0x08 };
}

function alignTo(value, alignment) {
  return Math.ceil(value / alignment) * alignment;
}
