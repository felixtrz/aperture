export interface GenerateTextureMipmapsDeviceLike {
  readonly createShaderModule?: DeviceCallback<[descriptor: unknown], unknown>;
  readonly createSampler?: DeviceCallback<[descriptor: unknown], unknown>;
  readonly createBindGroupLayout?: DeviceCallback<
    [descriptor: unknown],
    unknown
  >;
  readonly createPipelineLayout?: DeviceCallback<
    [descriptor: unknown],
    unknown
  >;
  readonly createRenderPipeline?: DeviceCallback<
    [descriptor: unknown],
    unknown
  >;
  readonly createBindGroup?: DeviceCallback<[descriptor: unknown], unknown>;
  readonly createCommandEncoder?: DeviceCallback<
    [descriptor?: unknown],
    unknown
  >;
  readonly queue?: {
    readonly submit?: (commandBuffers: readonly unknown[]) => void;
  };
}

type DeviceCallback<TArgs extends readonly unknown[], TResult> = {
  bivarianceHack(...args: TArgs): TResult;
}["bivarianceHack"];

export interface GenerateTextureMipmapsCommandEncoderLike {
  readonly beginRenderPass?: (
    descriptor: unknown,
  ) => GenerateTextureMipmapsRenderPassLike;
  readonly finish?: () => unknown;
}

export interface GenerateTextureMipmapsRenderPassLike {
  readonly setPipeline?: (pipeline: unknown) => void;
  readonly setBindGroup?: (index: number, bindGroup: unknown) => void;
  readonly draw?: (vertexCount: number) => void;
  readonly end?: () => void;
}

export interface GenerateTextureMipmapsOptions {
  readonly device: GenerateTextureMipmapsDeviceLike;
  readonly texture: {
    readonly createView?: (descriptor?: unknown) => unknown;
  };
  readonly resourceKey: string;
  readonly format: string;
  readonly width: number;
  readonly height: number;
  readonly mipLevelCount: number;
  readonly label?: string;
}

export interface GenerateTextureMipmapsReport {
  readonly resourceKey: string;
  readonly format: string;
  readonly baseSize: readonly [number, number];
  readonly requestedMipLevelCount: number;
  readonly generatedMipLevels: readonly number[];
  readonly passCount: number;
  readonly submitted: boolean;
}

const SHADER_STAGE_FRAGMENT = 0x2;

const MIPMAP_SHADER = /* wgsl */ `
struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
};

@vertex
fn vertexMain(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
  var positions = array<vec2f, 3>(
    vec2f(-1.0, -3.0),
    vec2f(3.0, 1.0),
    vec2f(-1.0, 1.0),
  );
  var uvs = array<vec2f, 3>(
    vec2f(0.0, 2.0),
    vec2f(2.0, 0.0),
    vec2f(0.0, 0.0),
  );

  var output: VertexOutput;
  output.position = vec4f(positions[vertexIndex], 0.0, 1.0);
  output.uv = uvs[vertexIndex];
  return output;
}

@group(0) @binding(0) var mipSampler: sampler;
@group(0) @binding(1) var sourceTexture: texture_2d<f32>;

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4f {
  return textureSampleLevel(sourceTexture, mipSampler, input.uv, 0.0);
}
`;

export function fullMipLevelCountForTextureSize(
  width: number,
  height: number,
): number {
  return Math.floor(Math.log2(Math.max(width, height))) + 1;
}

export function canGenerateTextureMipmaps(format: string): boolean {
  switch (format) {
    case "rgba8unorm":
    case "rgba8unorm-srgb":
    case "bgra8unorm":
    case "bgra8unorm-srgb":
    case "rgba16float":
      return true;
    default:
      return false;
  }
}

export function generateTextureMipmaps(
  options: GenerateTextureMipmapsOptions,
): GenerateTextureMipmapsReport {
  if (options.mipLevelCount <= 1) {
    return {
      resourceKey: options.resourceKey,
      format: options.format,
      baseSize: [options.width, options.height],
      requestedMipLevelCount: options.mipLevelCount,
      generatedMipLevels: [],
      passCount: 0,
      submitted: false,
    };
  }

  const device = options.device;

  if (options.texture.createView === undefined) {
    throw new Error("Texture cannot create per-mip views.");
  }
  if (device.createShaderModule === undefined) {
    throw new Error("WebGPU device cannot create mipmap shader modules.");
  }
  if (device.createSampler === undefined) {
    throw new Error("WebGPU device cannot create mipmap samplers.");
  }
  if (device.createBindGroupLayout === undefined) {
    throw new Error("WebGPU device cannot create mipmap bind group layouts.");
  }
  if (device.createPipelineLayout === undefined) {
    throw new Error("WebGPU device cannot create mipmap pipeline layouts.");
  }
  if (device.createRenderPipeline === undefined) {
    throw new Error("WebGPU device cannot create mipmap render pipelines.");
  }
  if (device.createBindGroup === undefined) {
    throw new Error("WebGPU device cannot create mipmap bind groups.");
  }
  if (device.createCommandEncoder === undefined) {
    throw new Error("WebGPU device cannot create mipmap command encoders.");
  }
  if (device.queue?.submit === undefined) {
    throw new Error("WebGPU queue cannot submit mipmap generation commands.");
  }

  const label = options.label ?? `${options.resourceKey}:mipmaps`;
  const shaderModule = device.createShaderModule({
    label: `${label}:shader`,
    code: MIPMAP_SHADER,
  });
  const sampler = device.createSampler({
    label: `${label}:sampler`,
    minFilter: "linear",
    magFilter: "linear",
  });
  const bindGroupLayout = device.createBindGroupLayout({
    label: `${label}:bind-group-layout`,
    entries: [
      { binding: 0, visibility: SHADER_STAGE_FRAGMENT, sampler: {} },
      {
        binding: 1,
        visibility: SHADER_STAGE_FRAGMENT,
        texture: { sampleType: "float", viewDimension: "2d" },
      },
    ],
  });
  const pipelineLayout = device.createPipelineLayout({
    label: `${label}:pipeline-layout`,
    bindGroupLayouts: [bindGroupLayout],
  });
  const pipeline = device.createRenderPipeline({
    label: `${label}:pipeline`,
    layout: pipelineLayout,
    vertex: {
      module: shaderModule,
      entryPoint: "vertexMain",
    },
    fragment: {
      module: shaderModule,
      entryPoint: "fragmentMain",
      targets: [{ format: options.format }],
    },
    primitive: { topology: "triangle-list" },
  });
  const commandEncoder = device.createCommandEncoder({
    label: `${label}:encoder`,
  }) as GenerateTextureMipmapsCommandEncoderLike;
  const generatedMipLevels: number[] = [];

  for (let mipLevel = 1; mipLevel < options.mipLevelCount; mipLevel += 1) {
    const sourceView = options.texture.createView({
      label: `${label}:source-view:${mipLevel - 1}`,
      dimension: "2d",
      baseMipLevel: mipLevel - 1,
      mipLevelCount: 1,
    });
    const targetView = options.texture.createView({
      label: `${label}:target-view:${mipLevel}`,
      dimension: "2d",
      baseMipLevel: mipLevel,
      mipLevelCount: 1,
    });
    const bindGroup = device.createBindGroup({
      label: `${label}:bind-group:${mipLevel}`,
      layout: bindGroupLayout,
      entries: [
        { binding: 0, resource: sampler },
        { binding: 1, resource: sourceView },
      ],
    });
    const pass = commandEncoder.beginRenderPass?.({
      label: `${label}:pass:${mipLevel}`,
      colorAttachments: [
        {
          view: targetView,
          loadOp: "clear",
          storeOp: "store",
          clearValue: { r: 0, g: 0, b: 0, a: 0 },
        },
      ],
    });

    if (pass === undefined) {
      throw new Error("WebGPU command encoder cannot begin render passes.");
    }

    pass.setPipeline?.(pipeline);
    pass.setBindGroup?.(0, bindGroup);
    pass.draw?.(3);
    pass.end?.();
    generatedMipLevels.push(mipLevel);
  }

  const commandBuffer = commandEncoder.finish?.();

  if (commandBuffer === undefined) {
    throw new Error("WebGPU command encoder cannot finish mipmap commands.");
  }

  device.queue.submit([commandBuffer]);

  return {
    resourceKey: options.resourceKey,
    format: options.format,
    baseSize: [options.width, options.height],
    requestedMipLevelCount: options.mipLevelCount,
    generatedMipLevels,
    passCount: generatedMipLevels.length,
    submitted: true,
  };
}
