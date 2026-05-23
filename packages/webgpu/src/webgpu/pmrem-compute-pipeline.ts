export type PmremComputeStorageFormat = "rgba8unorm" | "rgba16float";

export interface PmremComputeDeviceLike {
  readonly createShaderModule?: (descriptor: unknown) => unknown;
  readonly createBindGroupLayout?: (descriptor: unknown) => unknown;
  readonly createPipelineLayout?: (descriptor: unknown) => unknown;
  readonly createComputePipeline?: (descriptor: unknown) => unknown;
}

export type PmremComputePipelineDiagnosticCode =
  | "pmremComputePipeline.createShaderModuleUnavailable"
  | "pmremComputePipeline.createBindGroupLayoutUnavailable"
  | "pmremComputePipeline.createPipelineLayoutUnavailable"
  | "pmremComputePipeline.createComputePipelineUnavailable"
  | "pmremComputePipeline.shaderModuleCreationFailed"
  | "pmremComputePipeline.bindGroupLayoutCreationFailed"
  | "pmremComputePipeline.pipelineLayoutCreationFailed"
  | "pmremComputePipeline.pipelineCreationFailed";

export interface PmremComputePipelineDiagnostic {
  readonly code: PmremComputePipelineDiagnosticCode;
  readonly message: string;
}

export interface PmremComputePipelineResource {
  readonly shaderModule: unknown;
  readonly bindGroupLayout: unknown;
  readonly pipelineLayout: unknown;
  readonly pipeline: unknown;
  readonly storageFormat: PmremComputeStorageFormat;
  readonly workgroupSize: readonly [number, number, number];
}

export interface CreatePmremComputePipelineOptions {
  readonly device: PmremComputeDeviceLike;
  readonly storageFormat?: PmremComputeStorageFormat;
  readonly label?: string;
}

export interface CreatePmremComputePipelineResult {
  readonly valid: boolean;
  readonly resource: PmremComputePipelineResource | null;
  readonly diagnostics: readonly PmremComputePipelineDiagnostic[];
}

export interface PmremComputeDispatchSize {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

const WORKGROUP_SIZE = [8, 8, 1] as const;

export function createPmremComputePipeline(
  options: CreatePmremComputePipelineOptions,
): CreatePmremComputePipelineResult {
  const label = options.label ?? "aperture-pmrem-compute";
  const storageFormat = options.storageFormat ?? "rgba16float";

  if (options.device.createShaderModule === undefined) {
    return failure(
      "pmremComputePipeline.createShaderModuleUnavailable",
      "WebGPU device cannot create PMREM shader modules.",
    );
  }

  if (options.device.createBindGroupLayout === undefined) {
    return failure(
      "pmremComputePipeline.createBindGroupLayoutUnavailable",
      "WebGPU device cannot create PMREM bind group layouts.",
    );
  }

  if (options.device.createPipelineLayout === undefined) {
    return failure(
      "pmremComputePipeline.createPipelineLayoutUnavailable",
      "WebGPU device cannot create PMREM pipeline layouts.",
    );
  }

  if (options.device.createComputePipeline === undefined) {
    return failure(
      "pmremComputePipeline.createComputePipelineUnavailable",
      "WebGPU device cannot create PMREM compute pipelines.",
    );
  }

  let shaderModule: unknown;

  try {
    shaderModule = options.device.createShaderModule({
      label: `${label}:shader`,
      code: pmremComputeShader(storageFormat),
    });
  } catch (error) {
    return failure(
      "pmremComputePipeline.shaderModuleCreationFailed",
      messageFromError(error),
    );
  }

  let bindGroupLayout: unknown;

  try {
    bindGroupLayout = options.device.createBindGroupLayout({
      label: `${label}:bind-group-layout`,
      entries: [
        {
          binding: 0,
          visibility: 4,
          sampler: { type: "filtering" },
        },
        {
          binding: 1,
          visibility: 4,
          texture: {
            sampleType: "float",
            viewDimension: "cube",
            multisampled: false,
          },
        },
        {
          binding: 2,
          visibility: 4,
          storageTexture: {
            access: "write-only",
            format: storageFormat,
            viewDimension: "2d-array",
          },
        },
        {
          binding: 3,
          visibility: 4,
          buffer: { type: "uniform" },
        },
      ],
    });
  } catch (error) {
    return failure(
      "pmremComputePipeline.bindGroupLayoutCreationFailed",
      messageFromError(error),
    );
  }

  let pipelineLayout: unknown;

  try {
    pipelineLayout = options.device.createPipelineLayout({
      label: `${label}:pipeline-layout`,
      bindGroupLayouts: [bindGroupLayout],
    });
  } catch (error) {
    return failure(
      "pmremComputePipeline.pipelineLayoutCreationFailed",
      messageFromError(error),
    );
  }

  let pipeline: unknown;

  try {
    pipeline = options.device.createComputePipeline({
      label: `${label}:pipeline`,
      layout: pipelineLayout,
      compute: {
        module: shaderModule,
        entryPoint: "main",
      },
    });
  } catch (error) {
    return failure(
      "pmremComputePipeline.pipelineCreationFailed",
      messageFromError(error),
    );
  }

  return {
    valid: true,
    resource: {
      shaderModule,
      bindGroupLayout,
      pipelineLayout,
      pipeline,
      storageFormat,
      workgroupSize: WORKGROUP_SIZE,
    },
    diagnostics: [],
  };
}

export function createPmremComputeDispatchSize(input: {
  readonly width: number;
  readonly height: number;
  readonly layers?: number;
}): PmremComputeDispatchSize {
  return {
    x: Math.ceil(input.width / WORKGROUP_SIZE[0]),
    y: Math.ceil(input.height / WORKGROUP_SIZE[1]),
    z: input.layers ?? 6,
  };
}

function pmremComputeShader(format: PmremComputeStorageFormat): string {
  return `
struct PmremParams {
  width: u32,
  height: u32,
  layers: u32,
  sourceMipLevel: u32,
}

@group(0) @binding(0) var sourceSampler: sampler;
@group(0) @binding(1) var sourceCube: texture_cube<f32>;
@group(0) @binding(2) var outputMip: texture_storage_2d_array<${format}, write>;
@group(0) @binding(3) var<uniform> params: PmremParams;

const PI: f32 = 3.141592653589793;
const PMREM_GGX_SAMPLE_COUNT: u32 = 128u;

fn cubeDirection(face: u32, uv: vec2f) -> vec3f {
  let xy = uv * 2.0 - vec2f(1.0, 1.0);

  switch face {
    case 0u: {
      return normalize(vec3f(1.0, -xy.y, -xy.x));
    }
    case 1u: {
      return normalize(vec3f(-1.0, -xy.y, xy.x));
    }
    case 2u: {
      return normalize(vec3f(xy.x, 1.0, xy.y));
    }
    case 3u: {
      return normalize(vec3f(xy.x, -1.0, -xy.y));
    }
    case 4u: {
      return normalize(vec3f(xy.x, -xy.y, 1.0));
    }
    default: {
      return normalize(vec3f(-xy.x, -xy.y, -1.0));
    }
  }
}

fn radicalInverseVdc(inputBits: u32) -> f32 {
  var bits = inputBits;
  bits = (bits << 16u) | (bits >> 16u);
  bits = ((bits & 0x55555555u) << 1u) | ((bits & 0xAAAAAAAAu) >> 1u);
  bits = ((bits & 0x33333333u) << 2u) | ((bits & 0xCCCCCCCCu) >> 2u);
  bits = ((bits & 0x0F0F0F0Fu) << 4u) | ((bits & 0xF0F0F0F0u) >> 4u);
  bits = ((bits & 0x00FF00FFu) << 8u) | ((bits & 0xFF00FF00u) >> 8u);
  return f32(bits) * 2.3283064365386963e-10;
}

fn hammersley(index: u32, count: u32) -> vec2f {
  return vec2f(f32(index) / f32(count), radicalInverseVdc(index));
}

fn importanceSampleGGXVNDF(xi: vec2f, roughness: f32) -> vec3f {
  let alpha = max(0.001, roughness * roughness);
  let radius = sqrt(xi.x);
  let phi = 2.0 * PI * xi.y;
  let t1 = radius * cos(phi);
  let t2 = radius * sin(phi);
  let nhZ = sqrt(max(0.0, 1.0 - t1 * t1 - t2 * t2));

  return normalize(vec3f(alpha * t1, alpha * t2, nhZ));
}

fn worldFromTangentSample(normal: vec3f, tangentSample: vec3f) -> vec3f {
  var up = vec3f(0.0, 0.0, 1.0);

  if (abs(normal.z) >= 0.999) {
    up = vec3f(1.0, 0.0, 0.0);
  }

  let tangent = normalize(cross(up, normal));
  let bitangent = cross(normal, tangent);

  return normalize(
    tangent * tangentSample.x +
    bitangent * tangentSample.y +
    normal * tangentSample.z,
  );
}

fn roughnessFromMipLevel(mipLevel: u32) -> f32 {
  return clamp(f32(mipLevel) / 5.0, 0.0, 1.0);
}

fn roughnessColor(direction: vec3f) -> vec4f {
  let baseColor = textureSampleLevel(sourceCube, sourceSampler, direction, 0.0);

  if (params.sourceMipLevel == 0u) {
    return baseColor;
  }

  let normal = normalize(direction);
  let roughness = roughnessFromMipLevel(params.sourceMipLevel);
  var prefilteredColor = vec3f(0.0, 0.0, 0.0);
  var totalWeight = 0.0;

  for (var sampleIndex = 0u; sampleIndex < PMREM_GGX_SAMPLE_COUNT; sampleIndex += 1u) {
    let xi = hammersley(sampleIndex, PMREM_GGX_SAMPLE_COUNT);
    let halfVector = worldFromTangentSample(
      normal,
      importanceSampleGGXVNDF(xi, roughness),
    );
    let sampleDirection = normalize(2.0 * dot(normal, halfVector) * halfVector - normal);
    let sampleWeight = max(dot(normal, sampleDirection), 0.0);

    if (sampleWeight > 0.0) {
      let sampleColor = textureSampleLevel(sourceCube, sourceSampler, sampleDirection, 0.0);
      prefilteredColor += sampleColor.rgb * sampleWeight;
      totalWeight += sampleWeight;
    }
  }

  if (totalWeight <= 0.0) {
    return baseColor;
  }

  return vec4f(prefilteredColor / totalWeight, baseColor.a);
}

@compute @workgroup_size(${WORKGROUP_SIZE[0]}, ${WORKGROUP_SIZE[1]}, ${WORKGROUP_SIZE[2]})
fn main(@builtin(global_invocation_id) globalId: vec3u) {
  if (globalId.x >= params.width || globalId.y >= params.height || globalId.z >= params.layers) {
    return;
  }

  let uv = (vec2f(globalId.xy) + vec2f(0.5, 0.5)) / vec2f(f32(params.width), f32(params.height));
  let direction = cubeDirection(globalId.z, uv);
  let color = roughnessColor(direction);

  textureStore(
    outputMip,
    vec2i(i32(globalId.x), i32(globalId.y)),
    i32(globalId.z),
    color,
  );
}
`;
}

function failure(
  code: PmremComputePipelineDiagnosticCode,
  message: string,
): CreatePmremComputePipelineResult {
  return {
    valid: false,
    resource: null,
    diagnostics: [{ code, message }],
  };
}

function messageFromError(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "PMREM pipeline creation failed.";
}
