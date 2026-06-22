// Split-sum environment-BRDF (DFG) integration compute pipeline.
//
// Structure mirrors pmrem-compute-pipeline.ts (bind-group-layout + compute
// pipeline + Hammersley GGX importance sampling), but instead of prefiltering a
// cube it integrates the GGX environment BRDF over (NdotV, roughness) into a
// 2-channel (scale, bias) LUT. The split-sum specular IBL term is then
// `prefilteredColor * (F0 * scale + F90 * bias)` (Karis, "Real Shading in
// Unreal Engine 4").

export type BrdfLutComputeStorageFormat = "rg16float" | "rgba16float";

export interface BrdfLutComputeDeviceLike {
  readonly createShaderModule?: (descriptor: unknown) => unknown;
  readonly createBindGroupLayout?: (descriptor: unknown) => unknown;
  readonly createPipelineLayout?: (descriptor: unknown) => unknown;
  readonly createComputePipeline?: (descriptor: unknown) => unknown;
}

export type BrdfLutComputePipelineDiagnosticCode =
  | "brdfLutComputePipeline.createShaderModuleUnavailable"
  | "brdfLutComputePipeline.createBindGroupLayoutUnavailable"
  | "brdfLutComputePipeline.createPipelineLayoutUnavailable"
  | "brdfLutComputePipeline.createComputePipelineUnavailable"
  | "brdfLutComputePipeline.shaderModuleCreationFailed"
  | "brdfLutComputePipeline.bindGroupLayoutCreationFailed"
  | "brdfLutComputePipeline.pipelineLayoutCreationFailed"
  | "brdfLutComputePipeline.pipelineCreationFailed";

export interface BrdfLutComputePipelineDiagnostic {
  readonly code: BrdfLutComputePipelineDiagnosticCode;
  readonly message: string;
}

export interface BrdfLutComputePipelineResource {
  readonly shaderModule: unknown;
  readonly bindGroupLayout: unknown;
  readonly pipelineLayout: unknown;
  readonly pipeline: unknown;
  readonly storageFormat: BrdfLutComputeStorageFormat;
  readonly workgroupSize: readonly [number, number, number];
}

export interface CreateBrdfLutComputePipelineOptions {
  readonly device: BrdfLutComputeDeviceLike;
  readonly storageFormat?: BrdfLutComputeStorageFormat;
  readonly label?: string;
}

export interface CreateBrdfLutComputePipelineResult {
  readonly valid: boolean;
  readonly resource: BrdfLutComputePipelineResource | null;
  readonly diagnostics: readonly BrdfLutComputePipelineDiagnostic[];
}

export interface BrdfLutComputeDispatchSize {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/** Default LUT samples per texel; 1024 matches SOTA reference generators. */
export const BRDF_LUT_DEFAULT_SAMPLE_COUNT = 1024;

const WORKGROUP_SIZE = [8, 8, 1] as const;

export function createBrdfLutComputePipeline(
  options: CreateBrdfLutComputePipelineOptions,
): CreateBrdfLutComputePipelineResult {
  const label = options.label ?? "aperture-brdf-lut-compute";
  const storageFormat = options.storageFormat ?? "rg16float";

  if (options.device.createShaderModule === undefined) {
    return failure(
      "brdfLutComputePipeline.createShaderModuleUnavailable",
      "WebGPU device cannot create BRDF-LUT shader modules.",
    );
  }

  if (options.device.createBindGroupLayout === undefined) {
    return failure(
      "brdfLutComputePipeline.createBindGroupLayoutUnavailable",
      "WebGPU device cannot create BRDF-LUT bind group layouts.",
    );
  }

  if (options.device.createPipelineLayout === undefined) {
    return failure(
      "brdfLutComputePipeline.createPipelineLayoutUnavailable",
      "WebGPU device cannot create BRDF-LUT pipeline layouts.",
    );
  }

  if (options.device.createComputePipeline === undefined) {
    return failure(
      "brdfLutComputePipeline.createComputePipelineUnavailable",
      "WebGPU device cannot create BRDF-LUT compute pipelines.",
    );
  }

  let shaderModule: unknown;

  try {
    shaderModule = options.device.createShaderModule({
      label: `${label}:shader`,
      code: brdfLutComputeShader(storageFormat),
    });
  } catch (error) {
    return failure(
      "brdfLutComputePipeline.shaderModuleCreationFailed",
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
          storageTexture: {
            access: "write-only",
            format: storageFormat,
            viewDimension: "2d",
          },
        },
        {
          binding: 1,
          visibility: 4,
          buffer: { type: "uniform" },
        },
      ],
    });
  } catch (error) {
    return failure(
      "brdfLutComputePipeline.bindGroupLayoutCreationFailed",
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
      "brdfLutComputePipeline.pipelineLayoutCreationFailed",
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
      "brdfLutComputePipeline.pipelineCreationFailed",
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

export function createBrdfLutComputeDispatchSize(input: {
  readonly size: number;
}): BrdfLutComputeDispatchSize {
  return {
    x: Math.ceil(input.size / WORKGROUP_SIZE[0]),
    y: Math.ceil(input.size / WORKGROUP_SIZE[1]),
    z: 1,
  };
}

// ---------------------------------------------------------------------------
// CPU reference of the same integral the WGSL evaluates. Used by unit tests to
// validate the integral against known reference points (the BRDF LUT corners)
// without requiring a GPU, and as an analytic fallback. The WGSL `integrateBrdf`
// helper below mirrors this math exactly.
// ---------------------------------------------------------------------------

function radicalInverseVdc(inputBits: number): number {
  let bits = inputBits >>> 0;
  bits = ((bits << 16) | (bits >>> 16)) >>> 0;
  bits = (((bits & 0x55555555) << 1) | ((bits & 0xaaaaaaaa) >>> 1)) >>> 0;
  bits = (((bits & 0x33333333) << 2) | ((bits & 0xcccccccc) >>> 2)) >>> 0;
  bits = (((bits & 0x0f0f0f0f) << 4) | ((bits & 0xf0f0f0f0) >>> 4)) >>> 0;
  bits = (((bits & 0x00ff00ff) << 8) | ((bits & 0xff00ff00) >>> 8)) >>> 0;
  return bits * 2.3283064365386963e-10;
}

function hammersley(index: number, count: number): [number, number] {
  return [index / count, radicalInverseVdc(index)];
}

function importanceSampleGgx(
  xiX: number,
  xiY: number,
  roughness: number,
): [number, number, number] {
  const a = roughness * roughness;
  const phi = 2.0 * Math.PI * xiX;
  const cosTheta = Math.sqrt((1.0 - xiY) / (1.0 + (a * a - 1.0) * xiY));
  const sinTheta = Math.sqrt(Math.max(0.0, 1.0 - cosTheta * cosTheta));
  return [Math.cos(phi) * sinTheta, Math.sin(phi) * sinTheta, cosTheta];
}

function geometrySchlickGgx(nDotV: number, roughness: number): number {
  // IBL geometry term uses k = a^2 / 2 (Karis), where a = roughness.
  const k = (roughness * roughness) / 2.0;
  return nDotV / (nDotV * (1.0 - k) + k);
}

/**
 * Integrate the GGX environment BRDF at a single (NdotV, roughness) LUT texel,
 * returning the split-sum `(scale, bias)` pair: specularIbl =
 * prefilteredColor * (F0 * scale + F90 * bias).
 */
export function integrateEnvironmentBrdf(
  nDotV: number,
  roughness: number,
  sampleCount: number = BRDF_LUT_DEFAULT_SAMPLE_COUNT,
): { readonly scale: number; readonly bias: number } {
  const clampedNdotV = Math.max(nDotV, 1e-4);
  const vx = Math.sqrt(Math.max(0.0, 1.0 - clampedNdotV * clampedNdotV));
  const vz = clampedNdotV;
  let scale = 0.0;
  let bias = 0.0;

  for (let i = 0; i < sampleCount; i += 1) {
    const [xiX, xiY] = hammersley(i, sampleCount);
    // V lies in the x/z plane (V.y === 0), so the half-vector's y component
    // does not contribute to V·H; only hx and hz are needed.
    const [hx, , hz] = importanceSampleGgx(xiX, xiY, roughness);
    const vDotH = vx * hx + vz * hz;
    // L = reflect(-V, H) = 2 * dot(V, H) * H - V
    const lz = 2.0 * vDotH * hz - vz;
    const nDotL = Math.max(lz, 0.0);
    const nDotH = Math.max(hz, 0.0);
    const clampedVdotH = Math.max(vDotH, 0.0);

    if (nDotL > 0.0) {
      const g =
        geometrySchlickGgx(clampedNdotV, roughness) *
        geometrySchlickGgx(nDotL, roughness);
      const gVis = (g * clampedVdotH) / (nDotH * clampedNdotV);
      const fc = Math.pow(1.0 - clampedVdotH, 5.0);
      scale += (1.0 - fc) * gVis;
      bias += fc * gVis;
    }
  }

  return { scale: scale / sampleCount, bias: bias / sampleCount };
}

function brdfLutComputeShader(format: BrdfLutComputeStorageFormat): string {
  return `
struct BrdfLutParams {
  size: u32,
  sampleCount: u32,
}

@group(0) @binding(0) var outputLut: texture_storage_2d<${format}, write>;
@group(0) @binding(1) var<uniform> params: BrdfLutParams;

const PI: f32 = 3.141592653589793;

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

fn importanceSampleGGX(xi: vec2f, roughness: f32) -> vec3f {
  let a = roughness * roughness;
  let phi = 2.0 * PI * xi.x;
  let cosTheta = sqrt((1.0 - xi.y) / (1.0 + (a * a - 1.0) * xi.y));
  let sinTheta = sqrt(max(0.0, 1.0 - cosTheta * cosTheta));
  return vec3f(cos(phi) * sinTheta, sin(phi) * sinTheta, cosTheta);
}

fn geometrySchlickGGX(nDotV: f32, roughness: f32) -> f32 {
  let k = (roughness * roughness) / 2.0;
  return nDotV / (nDotV * (1.0 - k) + k);
}

fn integrateBrdf(nDotV: f32, roughness: f32, sampleCount: u32) -> vec2f {
  let clampedNdotV = max(nDotV, 1e-4);
  let viewDir = vec3f(sqrt(max(0.0, 1.0 - clampedNdotV * clampedNdotV)), 0.0, clampedNdotV);
  var scale = 0.0;
  var bias = 0.0;

  for (var sampleIndex = 0u; sampleIndex < sampleCount; sampleIndex += 1u) {
    let xi = hammersley(sampleIndex, sampleCount);
    let halfVector = importanceSampleGGX(xi, roughness);
    let vDotH = dot(viewDir, halfVector);
    let lightDir = 2.0 * vDotH * halfVector - viewDir;
    let nDotL = max(lightDir.z, 0.0);
    let nDotH = max(halfVector.z, 0.0);
    let clampedVdotH = max(vDotH, 0.0);

    if (nDotL > 0.0) {
      let g = geometrySchlickGGX(clampedNdotV, roughness) * geometrySchlickGGX(nDotL, roughness);
      let gVis = (g * clampedVdotH) / (nDotH * clampedNdotV);
      let fc = pow(1.0 - clampedVdotH, 5.0);
      scale += (1.0 - fc) * gVis;
      bias += fc * gVis;
    }
  }

  return vec2f(scale, bias) / f32(sampleCount);
}

@compute @workgroup_size(${WORKGROUP_SIZE[0]}, ${WORKGROUP_SIZE[1]}, ${WORKGROUP_SIZE[2]})
fn main(@builtin(global_invocation_id) globalId: vec3u) {
  if (globalId.x >= params.size || globalId.y >= params.size) {
    return;
  }

  let nDotV = (f32(globalId.x) + 0.5) / f32(params.size);
  let roughness = (f32(globalId.y) + 0.5) / f32(params.size);
  let integrated = integrateBrdf(nDotV, roughness, params.sampleCount);

  textureStore(
    outputLut,
    vec2i(i32(globalId.x), i32(globalId.y)),
    vec4f(integrated.x, integrated.y, 0.0, 1.0),
  );
}
`;
}

function failure(
  code: BrdfLutComputePipelineDiagnosticCode,
  message: string,
): CreateBrdfLutComputePipelineResult {
  return {
    valid: false,
    resource: null,
    diagnostics: [{ code, message }],
  };
}

function messageFromError(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "BRDF-LUT pipeline creation failed.";
}
