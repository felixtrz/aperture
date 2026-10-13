// Equirectangular -> cubemap projection compute pipeline.
//
// Structure mirrors pmrem-compute-pipeline.ts (sampler + source texture +
// 2d-array storage output + uniform params, cube-face dispatch), but the source
// is a 2D equirectangular (lat-long) texture and the kernel maps each output
// cube direction to an equirect UV and samples it. This lets a single equirect
// HDR auto-derive the 6 cube faces that feed both the diffuse irradiance
// convolution (M5-T2) and the specular PMREM prefilter, removing the requirement
// that users pre-facet 6 faces.
//
// Direction<->UV mapping: we center the equirect on +Z — i.e.
// u = atan2(dir.x, dir.z) / (2π) + 0.5 — so the +Z cube-face center maps to UV
// (0.5, 0.5); v = asin(clamp(dir.y, -1, 1)) / π + 0.5 (north pole at v=1).
// Face orientation reuses the exact cubeDirection() convention from
// pmrem-compute-pipeline.ts so the projected cube is consistent with the
// diffuse/specular passes (no mirrored/rotated reflections).

export type EquirectToCubeStorageFormat = "rgba8unorm" | "rgba16float";

export interface EquirectToCubeDeviceLike {
  readonly createShaderModule?: (descriptor: unknown) => unknown;
  readonly createBindGroupLayout?: (descriptor: unknown) => unknown;
  readonly createPipelineLayout?: (descriptor: unknown) => unknown;
  readonly createComputePipeline?: (descriptor: unknown) => unknown;
}

export type EquirectToCubePipelineDiagnosticCode =
  | "equirectToCubePipeline.createShaderModuleUnavailable"
  | "equirectToCubePipeline.createBindGroupLayoutUnavailable"
  | "equirectToCubePipeline.createPipelineLayoutUnavailable"
  | "equirectToCubePipeline.createComputePipelineUnavailable"
  | "equirectToCubePipeline.shaderModuleCreationFailed"
  | "equirectToCubePipeline.bindGroupLayoutCreationFailed"
  | "equirectToCubePipeline.pipelineLayoutCreationFailed"
  | "equirectToCubePipeline.pipelineCreationFailed";

export interface EquirectToCubePipelineDiagnostic {
  readonly code: EquirectToCubePipelineDiagnosticCode;
  readonly message: string;
}

export interface EquirectToCubePipelineResource {
  readonly shaderModule: unknown;
  readonly bindGroupLayout: unknown;
  readonly pipelineLayout: unknown;
  readonly pipeline: unknown;
  readonly storageFormat: EquirectToCubeStorageFormat;
  readonly workgroupSize: readonly [number, number, number];
}

export interface CreateEquirectToCubeComputePipelineOptions {
  readonly device: EquirectToCubeDeviceLike;
  readonly storageFormat?: EquirectToCubeStorageFormat;
  readonly label?: string;
}

export interface CreateEquirectToCubeComputePipelineResult {
  readonly valid: boolean;
  readonly resource: EquirectToCubePipelineResource | null;
  readonly diagnostics: readonly EquirectToCubePipelineDiagnostic[];
}

export interface EquirectToCubeDispatchSize {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

const WORKGROUP_SIZE = [8, 8, 1] as const;

export function createEquirectToCubeComputePipeline(
  options: CreateEquirectToCubeComputePipelineOptions,
): CreateEquirectToCubeComputePipelineResult {
  const label = options.label ?? "aperture-equirect-to-cube";
  const storageFormat = options.storageFormat ?? "rgba16float";

  if (options.device.createShaderModule === undefined) {
    return failure(
      "equirectToCubePipeline.createShaderModuleUnavailable",
      "WebGPU device cannot create equirect-to-cube shader modules.",
    );
  }

  if (options.device.createBindGroupLayout === undefined) {
    return failure(
      "equirectToCubePipeline.createBindGroupLayoutUnavailable",
      "WebGPU device cannot create equirect-to-cube bind group layouts.",
    );
  }

  if (options.device.createPipelineLayout === undefined) {
    return failure(
      "equirectToCubePipeline.createPipelineLayoutUnavailable",
      "WebGPU device cannot create equirect-to-cube pipeline layouts.",
    );
  }

  if (options.device.createComputePipeline === undefined) {
    return failure(
      "equirectToCubePipeline.createComputePipelineUnavailable",
      "WebGPU device cannot create equirect-to-cube compute pipelines.",
    );
  }

  let shaderModule: unknown;

  try {
    shaderModule = options.device.createShaderModule({
      label: `${label}:shader`,
      code: equirectToCubeShader(storageFormat),
    });
  } catch (error) {
    return failure(
      "equirectToCubePipeline.shaderModuleCreationFailed",
      messageFromError(error),
    );
  }

  let bindGroupLayout: unknown;

  try {
    bindGroupLayout = options.device.createBindGroupLayout({
      label: `${label}:bind-group-layout`,
      entries: [
        { binding: 0, visibility: 4, sampler: { type: "filtering" } },
        {
          binding: 1,
          visibility: 4,
          texture: {
            sampleType: "float",
            viewDimension: "2d",
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
        { binding: 3, visibility: 4, buffer: { type: "uniform" } },
      ],
    });
  } catch (error) {
    return failure(
      "equirectToCubePipeline.bindGroupLayoutCreationFailed",
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
      "equirectToCubePipeline.pipelineLayoutCreationFailed",
      messageFromError(error),
    );
  }

  let pipeline: unknown;

  try {
    pipeline = options.device.createComputePipeline({
      label: `${label}:pipeline`,
      layout: pipelineLayout,
      compute: { module: shaderModule, entryPoint: "main" },
    });
  } catch (error) {
    return failure(
      "equirectToCubePipeline.pipelineCreationFailed",
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

export function createEquirectToCubeDispatchSize(input: {
  readonly faceSize: number;
}): EquirectToCubeDispatchSize {
  return {
    x: Math.ceil(input.faceSize / WORKGROUP_SIZE[0]),
    y: Math.ceil(input.faceSize / WORKGROUP_SIZE[1]),
    z: 6,
  };
}

// ---------------------------------------------------------------------------
// CPU mirrors of the WGSL direction<->UV mapping. Used by unit tests to assert
// the +Z center maps to UV (0.5, 0.5) and that horizontal direction variation
// produces horizontal UV variation, without a GPU.
// ---------------------------------------------------------------------------

const TWO_PI = Math.PI * 2;

/** The +Z-centered equirect UV for a (not necessarily unit) direction. */
export function equirectToCubeUv(
  direction: readonly [number, number, number],
): [number, number] {
  const length = Math.hypot(direction[0], direction[1], direction[2]) || 1;
  const x = direction[0] / length;
  const y = direction[1] / length;
  const z = direction[2] / length;
  const u = Math.atan2(x, z) / TWO_PI + 0.5;
  const v = Math.asin(Math.max(-1, Math.min(1, y))) / Math.PI + 0.5;
  return [u, v];
}

/** Cube-face direction at face center (uv 0.5,0.5), matching cubeDirection(). */
export function cubeFaceCenterDirection(
  face: number,
): [number, number, number] {
  switch (face) {
    case 0:
      return [1, 0, 0];
    case 1:
      return [-1, 0, 0];
    case 2:
      return [0, 1, 0];
    case 3:
      return [0, -1, 0];
    case 4:
      return [0, 0, 1];
    default:
      return [0, 0, -1];
  }
}

function equirectToCubeShader(format: EquirectToCubeStorageFormat): string {
  return `
struct EquirectParams {
  width: u32,
  height: u32,
  layers: u32,
  padding: u32,
}

@group(0) @binding(0) var sourceSampler: sampler;
@group(0) @binding(1) var equirect: texture_2d<f32>;
@group(0) @binding(2) var outputCube: texture_storage_2d_array<${format}, write>;
@group(0) @binding(3) var<uniform> params: EquirectParams;

const PI: f32 = 3.141592653589793;
const TWO_PI: f32 = 6.283185307179586;

fn cubeDirection(face: u32, uv: vec2f) -> vec3f {
  let xy = uv * 2.0 - vec2f(1.0, 1.0);

  switch face {
    case 0u: { return normalize(vec3f(1.0, -xy.y, -xy.x)); }
    case 1u: { return normalize(vec3f(-1.0, -xy.y, xy.x)); }
    case 2u: { return normalize(vec3f(xy.x, 1.0, xy.y)); }
    case 3u: { return normalize(vec3f(xy.x, -1.0, -xy.y)); }
    case 4u: { return normalize(vec3f(xy.x, -xy.y, 1.0)); }
    default: { return normalize(vec3f(-xy.x, -xy.y, -1.0)); }
  }
}

fn equirectUv(direction: vec3f) -> vec2f {
  let u = atan2(direction.x, direction.z) / TWO_PI + 0.5;
  let v = asin(clamp(direction.y, -1.0, 1.0)) / PI + 0.5;
  return vec2f(u, v);
}

@compute @workgroup_size(${WORKGROUP_SIZE[0]}, ${WORKGROUP_SIZE[1]}, ${WORKGROUP_SIZE[2]})
fn main(@builtin(global_invocation_id) globalId: vec3u) {
  if (globalId.x >= params.width || globalId.y >= params.height || globalId.z >= params.layers) {
    return;
  }

  let uv = (vec2f(globalId.xy) + vec2f(0.5, 0.5)) / vec2f(f32(params.width), f32(params.height));
  let direction = cubeDirection(globalId.z, uv);
  let equirectCoord = equirectUv(direction);
  let color = textureSampleLevel(equirect, sourceSampler, equirectCoord, 0.0);

  textureStore(
    outputCube,
    vec2i(i32(globalId.x), i32(globalId.y)),
    i32(globalId.z),
    color,
  );
}
`;
}

function failure(
  code: EquirectToCubePipelineDiagnosticCode,
  message: string,
): CreateEquirectToCubeComputePipelineResult {
  return {
    valid: false,
    resource: null,
    diagnostics: [{ code, message }],
  };
}

function messageFromError(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Equirect-to-cube pipeline creation failed.";
}
