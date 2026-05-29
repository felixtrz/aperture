import { describe, expect, it } from "vitest";

import {
  createSamplerAsset,
  createSamplerGpuResource,
  createTextureGpuResource,
  WEBGPU_TEXTURE_USAGE_FLAGS,
  type TextureDescriptorInput,
  type TextureGpuDeviceLike,
} from "@aperture-engine/webgpu/test-support";

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

  it("accepts padded texture upload row strides", () => {
    const writes: unknown[] = [];
    const result = createTextureGpuResource({
      device: {
        createTexture: () => textureWithView({ label: "padded-view" }),
        queue: {
          writeTexture: (destination, data, layout, size) => {
            writes.push({ destination, data, layout, size });
          },
        },
      },
      resourceKey: "texture:padded",
      descriptor: textureDescriptor(),
      upload: {
        data: new Uint8Array(512),
        bytesPerRow: 256,
        rowsPerImage: 4,
      },
    });

    expect(result.valid).toBe(true);
    expect(result.diagnostics).toEqual([]);
    expect(writes).toMatchObject([
      {
        layout: { bytesPerRow: 256, rowsPerImage: 4 },
        size: [2, 2, 1],
      },
    ]);
  });

  it("keeps color-space metadata on Aperture descriptors but omits it from WebGPU creation", () => {
    const texture = textureWithView({ label: "srgb-view" });
    const created: unknown[] = [];
    const descriptor = textureDescriptor({
      format: "rgba8unorm-srgb",
      colorSpace: "srgb",
      semantic: "base-color",
    });
    const result = createTextureGpuResource({
      device: {
        createTexture: (input) => {
          created.push(input);
          return texture;
        },
      },
      resourceKey: "texture:base-color",
      descriptor,
    });

    expect(result.valid).toBe(true);
    expect(result.resource?.descriptor).toEqual(descriptor);
    expect(created).toEqual([
      {
        label: "albedo",
        size: [2, 2, 1],
        format: "rgba8unorm-srgb",
        usage: 0x6,
        mipLevelCount: 1,
      },
    ]);
  });

  it("diagnoses texture descriptor color-space and format mismatches before GPU creation", () => {
    const created: unknown[] = [];
    const result = createTextureGpuResource({
      device: {
        createTexture: (input) => {
          created.push(input);
          return textureWithView({});
        },
      },
      resourceKey: "texture:bad-base-color",
      descriptor: textureDescriptor({
        format: "rgba8unorm",
        colorSpace: "srgb",
        semantic: "base-color",
      }),
    });

    expect(result.valid).toBe(false);
    expect(result.resource).toBeNull();
    expect(result.diagnostics).toEqual([
      {
        code: "textureResource.invalidColorSpaceFormat",
        resourceKey: "texture:bad-base-color",
        message: expect.stringContaining("color space 'srgb'"),
      },
    ]);
    expect(created).toEqual([]);
  });

  it("accepts padded rowsPerImage for single-layer texture uploads without requiring extra bytes", () => {
    const writes: unknown[] = [];
    const result = createTextureGpuResource({
      device: {
        createTexture: () => textureWithView({ label: "padded-rows-view" }),
        queue: {
          writeTexture: (destination, data, layout, size) => {
            writes.push({ destination, data, layout, size });
          },
        },
      },
      resourceKey: "texture:padded-rows",
      descriptor: textureDescriptor(),
      upload: {
        data: new Uint8Array(16),
        bytesPerRow: 8,
        rowsPerImage: 6,
      },
    });

    expect(result.valid).toBe(true);
    expect(result.diagnostics).toEqual([]);
    expect(writes).toMatchObject([
      {
        layout: { bytesPerRow: 8, rowsPerImage: 6 },
        size: [2, 2, 1],
      },
    ]);
  });

  it("accepts valid layered texture upload layouts", () => {
    const writes: unknown[] = [];
    const result = createTextureGpuResource({
      device: {
        createTexture: () => textureWithView({ label: "layered-view" }),
        queue: {
          writeTexture: (destination, data, layout, size) => {
            writes.push({ destination, data, layout, size });
          },
        },
      },
      resourceKey: "texture:layered",
      descriptor: textureDescriptor({ size: [2, 2, 2] }),
      upload: {
        data: new Uint8Array(1288),
        bytesPerRow: 256,
        rowsPerImage: 4,
      },
    });

    expect(result.valid).toBe(true);
    expect(result.diagnostics).toEqual([]);
    expect(writes).toMatchObject([
      {
        layout: { bytesPerRow: 256, rowsPerImage: 4 },
        size: [2, 2, 2],
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

  it("diagnoses invalid texture upload row-stride inputs safely", () => {
    const cases = [
      {
        upload: { data: new Uint8Array(16), bytesPerRow: 0, rowsPerImage: 2 },
        code: "textureResource.invalidBytesPerRow",
      },
      {
        upload: { data: new Uint8Array(16), bytesPerRow: 7, rowsPerImage: 2 },
        code: "textureResource.invalidBytesPerRow",
      },
      {
        upload: { data: new Uint8Array(16), bytesPerRow: 8, rowsPerImage: 1 },
        code: "textureResource.invalidRowsPerImage",
      },
      {
        upload: {
          data: new Uint8Array(16),
          bytesPerRow: 8,
          rowsPerImage: 1.5,
        },
        code: "textureResource.invalidRowsPerImage",
      },
    ] as const;

    for (const fixture of cases) {
      const writes: unknown[] = [];
      const result = createTextureGpuResource({
        device: {
          createTexture: () => textureWithView({}),
          queue: {
            writeTexture: (destination, data, layout, size) => {
              writes.push({ destination, data, layout, size });
            },
          },
        },
        resourceKey: "texture:invalid-upload",
        descriptor: textureDescriptor(),
        upload: fixture.upload,
      });

      expect(result.valid).toBe(false);
      expect(result.resource).toBeNull();
      expect(result.diagnostics).toEqual([
        {
          code: fixture.code,
          resourceKey: "texture:invalid-upload",
          message: expect.stringContaining("texture:invalid-upload"),
        },
      ]);
      expect(writes).toEqual([]);
    }
  });

  it("validates format-specific minimum bytes per upload row", () => {
    const cases = [
      { format: "r8unorm", invalidBytesPerRow: 1, expectedBytesPerRow: 2 },
      { format: "rg8unorm", invalidBytesPerRow: 3, expectedBytesPerRow: 4 },
      { format: "rgba8unorm", invalidBytesPerRow: 7, expectedBytesPerRow: 8 },
      { format: "bgra8unorm", invalidBytesPerRow: 7, expectedBytesPerRow: 8 },
      {
        format: "rgba16float",
        invalidBytesPerRow: 15,
        expectedBytesPerRow: 16,
      },
    ] as const;

    for (const fixture of cases) {
      const writes: unknown[] = [];
      const result = createTextureGpuResource({
        device: {
          createTexture: () => textureWithView({}),
          queue: {
            writeTexture: (destination, data, layout, size) => {
              writes.push({ destination, data, layout, size });
            },
          },
        },
        resourceKey: `texture:${fixture.format}`,
        descriptor: textureDescriptor({
          format: fixture.format,
          size: [2, 1, 1],
        }),
        upload: {
          data: new Uint8Array(64),
          bytesPerRow: fixture.invalidBytesPerRow,
          rowsPerImage: 1,
        },
      });

      expect(result.valid).toBe(false);
      expect(result.resource).toBeNull();
      expect(result.diagnostics).toEqual([
        {
          code: "textureResource.invalidBytesPerRow",
          resourceKey: `texture:${fixture.format}`,
          message: expect.stringContaining(
            `at least ${fixture.expectedBytesPerRow} bytes`,
          ),
        },
      ]);
      expect(writes).toEqual([]);
    }
  });

  it("accepts block-compressed texture upload layouts", () => {
    const writes: unknown[] = [];
    const descriptor = textureDescriptor({
      format: "etc2-rgb8unorm-srgb",
      size: [40, 40, 1],
    });
    const result = createTextureGpuResource({
      device: {
        createTexture: () => textureWithView({ label: "ktx2-view" }),
        queue: {
          writeTexture: (destination, data, layout, size) => {
            writes.push({ destination, data, layout, size });
          },
        },
      },
      resourceKey: "texture:basis-ktx2",
      descriptor,
      upload: {
        data: new Uint8Array(800),
        bytesPerRow: 80,
        rowsPerImage: 10,
      },
    });

    expect(result.valid).toBe(true);
    expect(result.diagnostics).toEqual([]);
    expect(writes).toMatchObject([
      {
        layout: { bytesPerRow: 80, rowsPerImage: 10 },
        size: [40, 40, 1],
      },
    ]);
  });

  it("generates a full mip chain for uncompressed texture uploads", () => {
    const texture = textureWithViewFactory();
    const writes: unknown[] = [];
    const created: unknown[] = [];
    const device = mipmapDevice({
      texture,
      writes,
      created,
    });
    const descriptor = textureDescriptor({
      size: [256, 256, 1],
      mipLevelCount: 9,
      usage:
        WEBGPU_TEXTURE_USAGE_FLAGS.TEXTURE_BINDING |
        WEBGPU_TEXTURE_USAGE_FLAGS.COPY_DST,
    });
    const result = createTextureGpuResource({
      device,
      resourceKey: "texture:mipmapped-albedo",
      descriptor,
      upload: {
        data: new Uint8Array(256 * 256 * 4),
        bytesPerRow: 256 * 4,
        rowsPerImage: 256,
      },
    });

    expect(result.valid).toBe(true);
    expect(result.diagnostics).toEqual([]);
    expect(result.resource?.descriptor.mipLevelCount).toBe(9);
    expect(created[0]).toMatchObject({
      mipLevelCount: 9,
      usage:
        WEBGPU_TEXTURE_USAGE_FLAGS.TEXTURE_BINDING |
        WEBGPU_TEXTURE_USAGE_FLAGS.COPY_DST |
        WEBGPU_TEXTURE_USAGE_FLAGS.RENDER_ATTACHMENT,
    });
    expect(writes).toHaveLength(1);
    expect(writes).toMatchObject([
      {
        destination: { texture, mipLevel: 0 },
        size: [256, 256, 1],
      },
    ]);
    expect(result.resource?.mipGeneration).toMatchObject({
      resourceKey: "texture:mipmapped-albedo",
      requestedMipLevelCount: 9,
      generatedMipLevels: [1, 2, 3, 4, 5, 6, 7, 8],
      passCount: 8,
      submitted: true,
    });
  });

  it("uploads every explicit mip level for precomputed KTX2 chains", () => {
    const texture = textureWithView({ label: "ktx2-mip-view" });
    const writes: unknown[] = [];
    const result = createTextureGpuResource({
      device: {
        createTexture: () => texture,
        queue: {
          writeTexture: (destination, data, layout, size) => {
            writes.push({ destination, data, layout, size });
          },
        },
      },
      resourceKey: "texture:basis-ktx2-mips",
      descriptor: textureDescriptor({
        format: "etc2-rgba8unorm-srgb",
        size: [40, 40, 1],
        mipLevelCount: 6,
      }),
      upload: {
        data: new Uint8Array(400),
        bytesPerRow: 160,
        rowsPerImage: 40,
        mipLevels: [
          mipLevelUpload(40, 40, 160),
          mipLevelUpload(20, 20, 80),
          mipLevelUpload(10, 10, 48),
          mipLevelUpload(5, 5, 32),
          mipLevelUpload(2, 2, 16),
          mipLevelUpload(1, 1, 16),
        ],
      },
    });

    expect(result.valid).toBe(true);
    expect(result.diagnostics).toEqual([]);
    expect(writes).toMatchObject([
      {
        destination: { texture, mipLevel: 0 },
        layout: { bytesPerRow: 160, rowsPerImage: 10 },
        size: [40, 40, 1],
      },
      {
        destination: { texture, mipLevel: 1 },
        layout: { bytesPerRow: 80, rowsPerImage: 5 },
        size: [20, 20, 1],
      },
      {
        destination: { texture, mipLevel: 2 },
        layout: { bytesPerRow: 48, rowsPerImage: 3 },
        size: [12, 12, 1],
      },
      {
        destination: { texture, mipLevel: 3 },
        layout: { bytesPerRow: 32, rowsPerImage: 2 },
        size: [8, 8, 1],
      },
      {
        destination: { texture, mipLevel: 4 },
        layout: { bytesPerRow: 16, rowsPerImage: 1 },
        size: [4, 4, 1],
      },
      {
        destination: { texture, mipLevel: 5 },
        layout: { bytesPerRow: 16, rowsPerImage: 1 },
        size: [4, 4, 1],
      },
    ]);
  });

  it("validates block-compressed texture row strides and block rows", () => {
    const cases = [
      {
        upload: {
          data: new Uint8Array(800),
          bytesPerRow: 79,
          rowsPerImage: 10,
        },
        code: "textureResource.invalidBytesPerRow",
        message: "at least 80 bytes",
      },
      {
        upload: { data: new Uint8Array(800), bytesPerRow: 80, rowsPerImage: 9 },
        code: "textureResource.invalidRowsPerImage",
        message: "at least 10 row(s)",
      },
      {
        upload: {
          data: new Uint8Array(799),
          bytesPerRow: 80,
          rowsPerImage: 10,
        },
        code: "textureResource.uploadDataTooSmall",
        message: "at least 800 byte(s)",
      },
    ] as const;

    for (const fixture of cases) {
      const result = createTextureGpuResource({
        device: {
          createTexture: () => textureWithView({}),
          queue: { writeTexture: () => undefined },
        },
        resourceKey: "texture:invalid-ktx2",
        descriptor: textureDescriptor({
          format: "etc2-rgb8unorm-srgb",
          size: [40, 40, 1],
        }),
        upload: fixture.upload,
      });

      expect(result.valid).toBe(false);
      expect(result.resource).toBeNull();
      expect(result.diagnostics).toEqual([
        {
          code: fixture.code,
          resourceKey: "texture:invalid-ktx2",
          message: expect.stringContaining(fixture.message),
        },
      ]);
    }
  });

  it("keeps unknown texture formats on positive-integer row-stride validation", () => {
    const writes: unknown[] = [];
    const descriptor = textureDescriptor({
      format: "implementation-format",
      size: [2, 2, 1],
    });
    const valid = createTextureGpuResource({
      device: {
        createTexture: () => textureWithView({}),
        queue: {
          writeTexture: (destination, data, layout, size) => {
            writes.push({ destination, data, layout, size });
          },
        },
      },
      resourceKey: "texture:implementation-format",
      descriptor,
      upload: {
        data: new Uint8Array(2),
        bytesPerRow: 1,
        rowsPerImage: 2,
      },
    });
    const invalid = createTextureGpuResource({
      device: {
        createTexture: () => textureWithView({}),
        queue: { writeTexture: () => undefined },
      },
      resourceKey: "texture:implementation-format",
      descriptor,
      upload: {
        data: new Uint8Array(2),
        bytesPerRow: 0,
        rowsPerImage: 2,
      },
    });

    expect(valid.valid).toBe(true);
    expect(valid.diagnostics).toEqual([]);
    expect(writes).toMatchObject([
      { layout: { bytesPerRow: 1, rowsPerImage: 2 } },
    ]);
    expect(invalid).toMatchObject({
      valid: false,
      resource: null,
      diagnostics: [
        {
          code: "textureResource.invalidBytesPerRow",
          resourceKey: "texture:implementation-format",
        },
      ],
    });
  });

  it("diagnoses texture upload data that is too small safely", () => {
    const cases = [
      {
        descriptor: textureDescriptor(),
        upload: { bytesPerRow: 8, rowsPerImage: 2, actualBytes: 15 },
        expectedBytes: 16,
      },
      {
        descriptor: textureDescriptor(),
        upload: { bytesPerRow: 256, rowsPerImage: 4, actualBytes: 263 },
        expectedBytes: 264,
      },
      {
        descriptor: textureDescriptor({ size: [2, 2, 2] }),
        upload: { bytesPerRow: 256, rowsPerImage: 4, actualBytes: 1287 },
        expectedBytes: 1288,
      },
    ] as const;

    for (const fixture of cases) {
      const writes: unknown[] = [];
      const result = createTextureGpuResource({
        device: {
          createTexture: () => textureWithView({}),
          queue: {
            writeTexture: (destination, data, layout, size) => {
              writes.push({ destination, data, layout, size });
            },
          },
        },
        resourceKey: "texture:short-upload",
        descriptor: fixture.descriptor,
        upload: {
          data: new Uint8Array(fixture.upload.actualBytes),
          bytesPerRow: fixture.upload.bytesPerRow,
          rowsPerImage: fixture.upload.rowsPerImage,
        },
      });

      expect(result.valid).toBe(false);
      expect(result.resource).toBeNull();
      expect(result.diagnostics).toEqual([
        {
          code: "textureResource.uploadDataTooSmall",
          resourceKey: "texture:short-upload",
          message: expect.stringContaining(
            `at least ${fixture.expectedBytes} byte(s)`,
          ),
        },
      ]);
      expect(result.diagnostics[0]?.message).toContain(
        `received ${fixture.upload.actualBytes}`,
      );
      expect(writes).toEqual([]);
    }
  });

  it("diagnoses non-integer rowsPerImage with stable resource diagnostics", () => {
    const writes: unknown[] = [];
    const result = createTextureGpuResource({
      device: {
        createTexture: () => textureWithView({}),
        queue: {
          writeTexture: (destination, data, layout, size) => {
            writes.push({ destination, data, layout, size });
          },
        },
      },
      resourceKey: "texture:fractional-rows",
      descriptor: textureDescriptor(),
      upload: {
        data: new Uint8Array(16),
        bytesPerRow: 8,
        rowsPerImage: 2.5,
      },
    });

    expect(result.valid).toBe(false);
    expect(result.resource).toBeNull();
    expect(result.diagnostics).toEqual([
      {
        code: "textureResource.invalidRowsPerImage",
        resourceKey: "texture:fractional-rows",
        message:
          "Texture upload rowsPerImage for resource 'texture:fractional-rows' mip level 0 must be an integer at least 2 row(s).",
      },
    ]);
    expect(writes).toEqual([]);
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
        upload: { data: new Uint8Array(16), bytesPerRow: 8 },
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
          resourceKey: "sampler:linear",
          message: "sampler denied",
        },
      ],
    });
  });

  it("preserves sampler descriptor labels and stable failure diagnostics", () => {
    const created: unknown[] = [];
    const sampler = createSamplerAsset({ label: "ui-linear" });
    const ready = createSamplerGpuResource({
      device: {
        createSampler: (descriptor) => {
          created.push(descriptor);
          return { handle: "raw-sampler-handle" };
        },
      },
      resourceKey: "sampler:ui-linear",
      sampler,
    });
    const failed = createSamplerGpuResource({
      device: {
        createSampler: () => {
          throw new Error("sampler device rejected descriptor");
        },
      },
      resourceKey: "sampler:ui-linear",
      sampler,
    });

    expect(ready.valid).toBe(true);
    expect(ready.resource?.descriptor.label).toBe("ui-linear");
    expect(created).toEqual([expect.objectContaining({ label: "ui-linear" })]);
    expect(failed).toEqual({
      valid: false,
      resource: null,
      diagnostics: [
        {
          code: "samplerResource.samplerCreationFailed",
          resourceKey: "sampler:ui-linear",
          message: "sampler device rejected descriptor",
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

function textureWithViewFactory(): ReturnType<
  NonNullable<TextureGpuDeviceLike["createTexture"]>
> {
  return {
    createView: (descriptor?: unknown) => ({ descriptor }),
  };
}

function mipLevelUpload(width: number, height: number, bytesPerRow: number) {
  const rowsPerImage = Math.ceil(height / 4);

  return {
    data: new Uint8Array(bytesPerRow * rowsPerImage),
    bytesPerRow,
    rowsPerImage,
    width,
    height,
  };
}

function mipmapDevice(input: {
  readonly texture: ReturnType<
    NonNullable<TextureGpuDeviceLike["createTexture"]>
  >;
  readonly writes: unknown[];
  readonly created: unknown[];
}): TextureGpuDeviceLike {
  return {
    createTexture: (descriptor) => {
      input.created.push(descriptor);
      return input.texture;
    },
    createShaderModule: (descriptor: unknown) => ({ descriptor }),
    createSampler: (descriptor: unknown) => ({ descriptor }),
    createBindGroupLayout: (descriptor: unknown) => ({ descriptor }),
    createPipelineLayout: (descriptor: unknown) => ({ descriptor }),
    createRenderPipeline: (descriptor: unknown) => ({ descriptor }),
    createBindGroup: (descriptor: unknown) => ({ descriptor }),
    createCommandEncoder: (descriptor?: unknown) => {
      const passes: unknown[] = [];

      return {
        beginRenderPass: (passDescriptor: unknown) => {
          passes.push(passDescriptor);
          return {
            setPipeline: () => undefined,
            setBindGroup: () => undefined,
            draw: () => undefined,
            end: () => undefined,
          };
        },
        finish: () => ({ descriptor, passes }),
      };
    },
    queue: {
      writeTexture: (destination, data, layout, size) => {
        input.writes.push({ destination, data, layout, size });
      },
      submit: () => undefined,
    },
  };
}
