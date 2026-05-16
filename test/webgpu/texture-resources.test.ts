import { describe, expect, it } from "vitest";

import {
  createSamplerAsset,
  createSamplerGpuResource,
  createTextureGpuResource,
  type TextureDescriptorInput,
  type TextureGpuDeviceLike,
} from "../../src/index.js";

describe("texture GPU resource creation", () => {
  it("creates texture resources and uploads explicit bytes", () => {
    const texture = textureWithView({ label: "albedo-view" });
    const created: unknown[] = [];
    const writes: unknown[] = [];
    const descriptor = textureDescriptor();
    const result = createTextureGpuResource({
      device: {
        createTexture: (input) => {
          created.push(input);
          return texture;
        },
        queue: {
          writeTexture: (destination, data, layout, size) => {
            writes.push({ destination, data, layout, size });
          },
        },
      },
      resourceKey: "texture:albedo",
      descriptor,
      upload: {
        data: new Uint8Array([
          255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 255, 255,
        ]),
        bytesPerRow: 8,
        rowsPerImage: 2,
      },
    });

    expect(result.valid).toBe(true);
    expect(result.diagnostics).toEqual([]);
    expect(result.resource).toEqual({
      resourceKey: "texture:albedo",
      texture,
      view: { label: "albedo-view" },
      descriptor,
    });
    expect(created).toEqual([descriptor]);
    expect(writes).toMatchObject([
      {
        destination: { texture },
        layout: { bytesPerRow: 8, rowsPerImage: 2 },
        size: [2, 2, 1],
      },
    ]);
  });

  it("creates texture resources without uploads", () => {
    const result = createTextureGpuResource({
      device: { createTexture: () => textureWithView({ label: "view" }) },
      resourceKey: "texture:render-target",
      descriptor: textureDescriptor({ usage: 0x14 }),
    });

    expect(result.valid).toBe(true);
    expect(result.diagnostics).toEqual([]);
    expect(result.resource).toMatchObject({
      resourceKey: "texture:render-target",
      view: { label: "view" },
      descriptor: { usage: 0x14 },
    });
  });

  it("reports missing texture device capabilities", () => {
    expect(
      createTextureGpuResource({
        device: {},
        resourceKey: "texture:albedo",
        descriptor: textureDescriptor(),
      }),
    ).toMatchObject({
      valid: false,
      resource: null,
      diagnostics: [{ code: "textureResource.createTextureUnavailable" }],
    });

    expect(
      createTextureGpuResource({
        device: { createTexture: () => ({}) },
        resourceKey: "texture:albedo",
        descriptor: textureDescriptor(),
      }),
    ).toMatchObject({
      valid: false,
      resource: null,
      diagnostics: [{ code: "textureResource.createViewUnavailable" }],
    });
  });

  it("reports missing upload support when explicit bytes are provided", () => {
    expect(
      createTextureGpuResource({
        device: { createTexture: () => textureWithView({}) },
        resourceKey: "texture:albedo",
        descriptor: textureDescriptor(),
        upload: {
          data: new Uint8Array([255, 255, 255, 255]),
          bytesPerRow: 4,
        },
      }),
    ).toMatchObject({
      valid: false,
      resource: null,
      diagnostics: [{ code: "textureResource.writeTextureUnavailable" }],
    });
  });

  it("reports creation, upload, and view failures safely", () => {
    expect(
      createTextureGpuResource({
        device: {
          createTexture: () => {
            throw new Error("creation denied");
          },
        },
        resourceKey: "texture:albedo",
        descriptor: textureDescriptor(),
      }),
    ).toMatchObject({
      valid: false,
      diagnostics: [
        {
          code: "textureResource.textureCreationFailed",
          resourceKey: "texture:albedo",
          message: "creation denied",
        },
      ],
    });

    expect(
      createTextureGpuResource({
        device: {
          createTexture: () => textureWithView({}),
          queue: {
            writeTexture: () => {
              throw new Error("upload denied");
            },
          },
        },
        resourceKey: "texture:albedo",
        descriptor: textureDescriptor(),
        upload: { data: new Uint8Array([255, 255, 255, 255]), bytesPerRow: 4 },
      }),
    ).toMatchObject({
      valid: false,
      diagnostics: [{ code: "textureResource.textureUploadFailed" }],
    });

    expect(
      createTextureGpuResource({
        device: {
          createTexture: () => ({
            createView: () => {
              throw new Error("view denied");
            },
          }),
        },
        resourceKey: "texture:albedo",
        descriptor: textureDescriptor(),
      }),
    ).toMatchObject({
      valid: false,
      diagnostics: [{ code: "textureResource.textureViewCreationFailed" }],
    });
  });
});

describe("sampler GPU resource creation", () => {
  it("maps sampler assets to WebGPU sampler descriptors", () => {
    const created: unknown[] = [];
    const sampler = { label: "gpu-sampler" };
    const result = createSamplerGpuResource({
      device: {
        createSampler: (descriptor) => {
          created.push(descriptor);
          return sampler;
        },
      },
      resourceKey: "sampler:linear",
      sampler: createSamplerAsset({
        label: "linear-clamp",
        addressModeU: "clamp-to-edge",
        addressModeV: "mirror-repeat",
        addressModeW: "repeat",
        magFilter: "nearest",
        minFilter: "linear",
        mipmapFilter: "nearest",
        lodMinClamp: 1,
        lodMaxClamp: 4,
        maxAnisotropy: 2,
      }),
    });

    expect(result.valid).toBe(true);
    expect(result.diagnostics).toEqual([]);
    expect(result.resource).toEqual({
      resourceKey: "sampler:linear",
      sampler,
      descriptor: {
        label: "linear-clamp",
        addressModeU: "clamp-to-edge",
        addressModeV: "mirror-repeat",
        addressModeW: "repeat",
        magFilter: "nearest",
        minFilter: "linear",
        mipmapFilter: "nearest",
        lodMinClamp: 1,
        lodMaxClamp: 4,
        maxAnisotropy: 2,
      },
    });
    expect(created).toEqual([result.resource?.descriptor]);
  });

  it("reports missing sampler device support and creation failures", () => {
    const sampler = createSamplerAsset({ label: "linear" });

    expect(
      createSamplerGpuResource({
        device: {},
        resourceKey: "sampler:linear",
        sampler,
      }),
    ).toMatchObject({
      valid: false,
      resource: null,
      diagnostics: [{ code: "samplerResource.createSamplerUnavailable" }],
    });

    expect(
      createSamplerGpuResource({
        device: {
          createSampler: () => {
            throw new Error("sampler denied");
          },
        },
        resourceKey: "sampler:linear",
        sampler,
      }),
    ).toMatchObject({
      valid: false,
      resource: null,
      diagnostics: [
        {
          code: "samplerResource.samplerCreationFailed",
          message: "sampler denied",
        },
      ],
    });
  });
});

function textureDescriptor(
  overrides: Partial<TextureDescriptorInput> = {},
): TextureDescriptorInput {
  return {
    label: "albedo",
    size: [2, 2, 1],
    format: "rgba8unorm",
    usage: 0x6,
    mipLevelCount: 1,
    ...overrides,
  };
}

function textureWithView(
  view: unknown,
): ReturnType<NonNullable<TextureGpuDeviceLike["createTexture"]>> {
  return {
    createView: () => view,
  };
}
