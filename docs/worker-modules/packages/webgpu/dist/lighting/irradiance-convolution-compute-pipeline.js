// Cosine-weighted hemisphere irradiance-convolution compute pipeline.
//
// Structure mirrors pmrem-compute-pipeline.ts (sampler + cube source + 2d-array
// storage output + uniform params, cube-face dispatch), but the kernel
// integrates incoming radiance over the cosine-weighted hemisphere around each
// output texel's cube direction instead of GGX-prefiltering. The result is a
// true diffuse irradiance map (stored as irradiance / PI), so diffuse IBL is
// irradiance — not raw radiance sampled by the normal. Cosine-importance
// sampling makes the estimator simply the mean of sampled radiance.
/** Default cosine-weighted samples per output texel. */
export const IRRADIANCE_CONVOLUTION_DEFAULT_SAMPLE_COUNT = 512;
const WORKGROUP_SIZE = [8, 8, 1];
export function createIrradianceConvolutionComputePipeline(options) {
    const label = options.label ?? "aperture-irradiance-convolution";
    const storageFormat = options.storageFormat ?? "rgba8unorm";
    if (options.device.createShaderModule === undefined) {
        return failure("irradianceConvolutionPipeline.createShaderModuleUnavailable", "WebGPU device cannot create irradiance-convolution shader modules.");
    }
    if (options.device.createBindGroupLayout === undefined) {
        return failure("irradianceConvolutionPipeline.createBindGroupLayoutUnavailable", "WebGPU device cannot create irradiance-convolution bind group layouts.");
    }
    if (options.device.createPipelineLayout === undefined) {
        return failure("irradianceConvolutionPipeline.createPipelineLayoutUnavailable", "WebGPU device cannot create irradiance-convolution pipeline layouts.");
    }
    if (options.device.createComputePipeline === undefined) {
        return failure("irradianceConvolutionPipeline.createComputePipelineUnavailable", "WebGPU device cannot create irradiance-convolution compute pipelines.");
    }
    let shaderModule;
    try {
        shaderModule = options.device.createShaderModule({
            label: `${label}:shader`,
            code: irradianceConvolutionShader(storageFormat),
        });
    }
    catch (error) {
        return failure("irradianceConvolutionPipeline.shaderModuleCreationFailed", messageFromError(error));
    }
    let bindGroupLayout;
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
                { binding: 3, visibility: 4, buffer: { type: "uniform" } },
            ],
        });
    }
    catch (error) {
        return failure("irradianceConvolutionPipeline.bindGroupLayoutCreationFailed", messageFromError(error));
    }
    let pipelineLayout;
    try {
        pipelineLayout = options.device.createPipelineLayout({
            label: `${label}:pipeline-layout`,
            bindGroupLayouts: [bindGroupLayout],
        });
    }
    catch (error) {
        return failure("irradianceConvolutionPipeline.pipelineLayoutCreationFailed", messageFromError(error));
    }
    let pipeline;
    try {
        pipeline = options.device.createComputePipeline({
            label: `${label}:pipeline`,
            layout: pipelineLayout,
            compute: { module: shaderModule, entryPoint: "main" },
        });
    }
    catch (error) {
        return failure("irradianceConvolutionPipeline.pipelineCreationFailed", messageFromError(error));
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
export function createIrradianceConvolutionDispatchSize(input) {
    return {
        x: Math.ceil(input.width / WORKGROUP_SIZE[0]),
        y: Math.ceil(input.height / WORKGROUP_SIZE[1]),
        z: input.layers ?? 6,
    };
}
// ---------------------------------------------------------------------------
// CPU reference of the same cosine-weighted convolution the WGSL evaluates.
// Used by unit tests to assert energy preservation (constant environment ->
// constant irradiance) and the directional cosine lobe without a GPU.
// ---------------------------------------------------------------------------
function radicalInverseVdc(inputBits) {
    let bits = inputBits >>> 0;
    bits = ((bits << 16) | (bits >>> 16)) >>> 0;
    bits = (((bits & 0x55555555) << 1) | ((bits & 0xaaaaaaaa) >>> 1)) >>> 0;
    bits = (((bits & 0x33333333) << 2) | ((bits & 0xcccccccc) >>> 2)) >>> 0;
    bits = (((bits & 0x0f0f0f0f) << 4) | ((bits & 0xf0f0f0f0) >>> 4)) >>> 0;
    bits = (((bits & 0x00ff00ff) << 8) | ((bits & 0xff00ff00) >>> 8)) >>> 0;
    return bits * 2.3283064365386963e-10;
}
function normalize3(v) {
    const length = Math.hypot(v[0], v[1], v[2]) || 1;
    return [v[0] / length, v[1] / length, v[2] / length];
}
function cross3(a, b) {
    return [
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0],
    ];
}
/**
 * Convolve a radiance sampler over the cosine-weighted hemisphere around
 * `normal`, returning the mean sampled radiance (irradiance / PI). With
 * cosine-importance sampling the cos/PI weighting cancels into the sample mean.
 */
export function convolveIrradianceDirection(sample, normal, sampleCount = IRRADIANCE_CONVOLUTION_DEFAULT_SAMPLE_COUNT) {
    const n = normalize3(normal);
    const up = Math.abs(n[1]) > 0.999 ? [1, 0, 0] : [0, 1, 0];
    const right = normalize3(cross3(up, n));
    const realUp = cross3(n, right);
    let total = 0;
    for (let i = 0; i < sampleCount; i += 1) {
        const xiX = i / sampleCount;
        const xiY = radicalInverseVdc(i);
        const phi = 2.0 * Math.PI * xiX;
        const cosTheta = Math.sqrt(1.0 - xiY);
        const sinTheta = Math.sqrt(xiY);
        const tx = sinTheta * Math.cos(phi);
        const ty = sinTheta * Math.sin(phi);
        const tz = cosTheta;
        const direction = normalize3([
            tx * right[0] + ty * realUp[0] + tz * n[0],
            tx * right[1] + ty * realUp[1] + tz * n[1],
            tx * right[2] + ty * realUp[2] + tz * n[2],
        ]);
        total += sample(direction);
    }
    return total / sampleCount;
}
function irradianceConvolutionShader(format) {
    return `
struct IrradianceParams {
  width: u32,
  height: u32,
  layers: u32,
  sampleCount: u32,
}

@group(0) @binding(0) var sourceSampler: sampler;
@group(0) @binding(1) var sourceCube: texture_cube<f32>;
@group(0) @binding(2) var outputMip: texture_storage_2d_array<${format}, write>;
@group(0) @binding(3) var<uniform> params: IrradianceParams;

const PI: f32 = 3.141592653589793;

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

@compute @workgroup_size(${WORKGROUP_SIZE[0]}, ${WORKGROUP_SIZE[1]}, ${WORKGROUP_SIZE[2]})
fn main(@builtin(global_invocation_id) globalId: vec3u) {
  if (globalId.x >= params.width || globalId.y >= params.height || globalId.z >= params.layers) {
    return;
  }

  let uv = (vec2f(globalId.xy) + vec2f(0.5, 0.5)) / vec2f(f32(params.width), f32(params.height));
  let normal = cubeDirection(globalId.z, uv);
  var up = vec3f(0.0, 1.0, 0.0);

  if (abs(normal.y) > 0.999) {
    up = vec3f(1.0, 0.0, 0.0);
  }

  let right = normalize(cross(up, normal));
  let realUp = cross(normal, right);
  var irradiance = vec3f(0.0, 0.0, 0.0);

  for (var sampleIndex = 0u; sampleIndex < params.sampleCount; sampleIndex += 1u) {
    let xi = hammersley(sampleIndex, params.sampleCount);
    let phi = 2.0 * PI * xi.x;
    let cosTheta = sqrt(1.0 - xi.y);
    let sinTheta = sqrt(xi.y);
    let tangentSample = vec3f(sinTheta * cos(phi), sinTheta * sin(phi), cosTheta);
    let direction = normalize(
      tangentSample.x * right + tangentSample.y * realUp + tangentSample.z * normal,
    );
    irradiance += textureSampleLevel(sourceCube, sourceSampler, direction, 0.0).rgb;
  }

  irradiance = irradiance / f32(params.sampleCount);

  textureStore(
    outputMip,
    vec2i(i32(globalId.x), i32(globalId.y)),
    i32(globalId.z),
    vec4f(irradiance, 1.0),
  );
}
`;
}
function failure(code, message) {
    return {
        valid: false,
        resource: null,
        diagnostics: [{ code, message }],
    };
}
function messageFromError(error) {
    return error instanceof Error
        ? error.message
        : "Irradiance-convolution pipeline creation failed.";
}
//# sourceMappingURL=irradiance-convolution-compute-pipeline.js.map