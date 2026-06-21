import { postDepthLoadFunctionWgsl, postDepthPipelineKeyToken, postDepthTextureBindingWgsl, resolvePostDepthSampleCount, } from "./post-depth-sampling.js";
export function createWebGpuSsaoPostEffect(options = {}) {
    const id = options.id ?? "ssao";
    const label = options.label ?? "SSAO Post Effect";
    const enabled = options.enabled;
    const radiusPixels = clampFinite(options.radiusPixels ?? 9, 1, 48);
    const intensity = clampFinite(options.intensity ?? 1.35, 0, 4);
    const depthBias = clampFinite(options.depthBias ?? 0.0008, 0, 0.05);
    const maxDepthDifference = clampFinite(options.maxDepthDifference ?? 0.075, 0.001, 0.5);
    const near = clampFinite(options.near ?? 0.1, 0.0001, 100000);
    const far = clampFinite(options.far ?? 1000, Math.max(near + 0.0001, 0.0002), 1000000);
    const fovYRadians = clampFinite(options.fovYRadians ?? Math.PI / 3, 0.001, Math.PI - 0.001);
    const sampleCount = clampInteger(options.sampleCount ?? 12, 4, 64);
    const minAngleDegrees = clampFinite(options.minAngleDegrees ?? 5, 0, 45);
    const power = clampFinite(options.power ?? 1, 0.25, 8);
    const randomSeed = clampFinite(options.randomSeed ?? 0, 0, 1);
    let cachedPipeline = null;
    let sampler = null;
    return {
        id,
        label,
        ...(enabled === undefined ? {} : { enabled }),
        requiresDepthTexture: true,
        // M5-T6: prefer the lit pass's separated indirect (ambient+IBL) color so AO
        // attenuates only indirect light. Best-effort — falls back to the legacy
        // whole-image multiply when the frame cannot supply the indirect channel
        // (MSAA on, motion vectors active, or a non-standard material).
        requiresIndirectColor: true,
        prepare(prepareOptions) {
            const diagnostics = [];
            const indirectView = prepareOptions.indirectColor?.texture.createView?.();
            const appliesToIndirect = indirectView !== undefined;
            if (prepareOptions.depth === undefined) {
                diagnostics.push({
                    code: "webGpuPostPass.depthTextureUnavailable",
                    effectId: id,
                    message: `SSAO post effect '${id}' requires the renderer-owned scene depth texture.`,
                });
                return preparedSsaoPass(id, label, [], diagnostics);
            }
            const depthSampleCount = resolvePostDepthSampleCount(prepareOptions.depth.sampleCount);
            const pipelineKey = ssaoPipelineKey({
                outputFormat: prepareOptions.outputFormat,
                depthSampleCount,
                radiusPixels,
                intensity,
                depthBias,
                maxDepthDifference,
                near,
                far,
                fovYRadians,
                sampleCount,
                minAngleDegrees,
                power,
                randomSeed,
                appliesToIndirect,
            });
            const pipelineResult = cachedPipeline?.key === pipelineKey
                ? cachedPipeline
                : createSsaoPostPipeline({
                    device: prepareOptions.device,
                    outputFormat: prepareOptions.outputFormat,
                    depthSampleCount,
                    radiusPixels,
                    intensity,
                    depthBias,
                    maxDepthDifference,
                    near,
                    far,
                    fovYRadians,
                    sampleCount,
                    minAngleDegrees,
                    power,
                    randomSeed,
                    appliesToIndirect,
                    label: `${prepareOptions.label}:${id}:pipeline`,
                    effectId: id,
                    diagnostics,
                });
            if (pipelineResult === null) {
                return preparedSsaoPass(id, label, [], diagnostics);
            }
            cachedPipeline = pipelineResult;
            if (sampler === null) {
                sampler = createSsaoPostSampler({
                    device: prepareOptions.device,
                    effectId: id,
                    diagnostics,
                });
            }
            if (sampler === null) {
                return preparedSsaoPass(id, label, [], diagnostics);
            }
            const inputView = prepareOptions.input.texture.createView?.();
            if (inputView === undefined) {
                diagnostics.push({
                    code: "webGpuPostPass.inputTextureViewUnavailable",
                    effectId: id,
                    message: `SSAO post effect '${id}' cannot sample input texture '${prepareOptions.input.label}'.`,
                });
                return preparedSsaoPass(id, label, [], diagnostics);
            }
            const depthView = prepareOptions.depth.texture.createView?.();
            if (depthView === undefined) {
                diagnostics.push({
                    code: "webGpuPostPass.inputTextureViewUnavailable",
                    effectId: id,
                    message: `SSAO post effect '${id}' cannot sample depth texture '${prepareOptions.depth.label}'.`,
                });
                return preparedSsaoPass(id, label, [], diagnostics);
            }
            const layout = pipelineResult.pipeline.getBindGroupLayout?.(0);
            if (layout === undefined) {
                diagnostics.push({
                    code: "webGpuPostPass.pipelineLayoutUnavailable",
                    effectId: id,
                    message: `SSAO post effect '${id}' pipeline does not expose group 0 bind-group layout.`,
                });
                return preparedSsaoPass(id, label, [], diagnostics);
            }
            if (prepareOptions.device.createBindGroup === undefined) {
                diagnostics.push({
                    code: "webGpuPostPass.createBindGroupUnavailable",
                    effectId: id,
                    message: `SSAO post effect '${id}' cannot create a texture sampling bind group.`,
                });
                return preparedSsaoPass(id, label, [], diagnostics);
            }
            const bindGroup = prepareOptions.device.createBindGroup({
                label: `${prepareOptions.label}:${id}:bind-group`,
                layout,
                entries: [
                    { binding: 0, resource: sampler },
                    { binding: 1, resource: inputView },
                    { binding: 2, resource: depthView },
                    ...(appliesToIndirect && indirectView !== undefined
                        ? [{ binding: 3, resource: indirectView }]
                        : []),
                ],
            });
            return preparedSsaoPass(id, label, [
                {
                    kind: "setPipeline",
                    renderId: 0,
                    pipelineKey,
                    pipeline: pipelineResult.pipeline,
                },
                {
                    kind: "setBindGroup",
                    renderId: 0,
                    index: 0,
                    resourceKey: `${id}:input:${prepareOptions.input.label}:depth:${prepareOptions.depth.label}:depthSamples:${depthSampleCount}:radius:${radiusPixels.toFixed(2)}:samples:${sampleCount}:intensity:${intensity.toFixed(2)}:indirect:${appliesToIndirect ? (prepareOptions.indirectColor?.label ?? "yes") : "no"}`,
                    bindGroup,
                },
                {
                    kind: "draw",
                    renderId: 0,
                    vertexCount: 3,
                    instanceCount: 1,
                    firstVertex: 0,
                    firstInstance: 0,
                },
            ], diagnostics);
        },
    };
}
function ssaoPipelineKey(options) {
    return [
        "webgpu-post-ssao",
        options.outputFormat,
        postDepthPipelineKeyToken(options.depthSampleCount),
        `radius:${options.radiusPixels.toFixed(3)}`,
        `intensity:${options.intensity.toFixed(3)}`,
        `bias:${options.depthBias.toFixed(5)}`,
        `range:${options.maxDepthDifference.toFixed(4)}`,
        `near:${options.near.toFixed(4)}`,
        `far:${options.far.toFixed(3)}`,
        `fovY:${options.fovYRadians.toFixed(4)}`,
        `samples:${options.sampleCount}`,
        `minAngle:${options.minAngleDegrees.toFixed(2)}`,
        `power:${options.power.toFixed(3)}`,
        `random:${options.randomSeed.toFixed(4)}`,
        `appliesTo:${options.appliesToIndirect ? "indirect" : "composite"}`,
    ].join("|");
}
function createSsaoPostPipeline(options) {
    if (options.device.createShaderModule === undefined) {
        options.diagnostics.push({
            code: "webGpuPostPass.createShaderModuleUnavailable",
            effectId: options.effectId,
            message: `SSAO post effect '${options.effectId}' cannot create a shader module.`,
        });
        return null;
    }
    if (options.device.createRenderPipeline === undefined) {
        options.diagnostics.push({
            code: "webGpuPostPass.createRenderPipelineUnavailable",
            effectId: options.effectId,
            message: `SSAO post effect '${options.effectId}' cannot create a render pipeline.`,
        });
        return null;
    }
    const module = options.device.createShaderModule({
        label: `${options.label}:shader`,
        code: ssaoPostEffectWgsl({
            depthSampleCount: options.depthSampleCount,
            radiusPixels: options.radiusPixels,
            intensity: options.intensity,
            depthBias: options.depthBias,
            maxDepthDifference: options.maxDepthDifference,
            near: options.near,
            far: options.far,
            fovYRadians: options.fovYRadians,
            sampleCount: options.sampleCount,
            minAngleDegrees: options.minAngleDegrees,
            power: options.power,
            randomSeed: options.randomSeed,
            appliesToIndirect: options.appliesToIndirect,
        }),
    });
    const pipeline = options.device.createRenderPipeline({
        label: options.label,
        layout: "auto",
        vertex: { module, entryPoint: "vs" },
        fragment: {
            module,
            entryPoint: "fs",
            targets: [{ format: options.outputFormat }],
        },
        primitive: { topology: "triangle-list" },
    });
    return {
        key: ssaoPipelineKey(options),
        pipeline,
    };
}
function createSsaoPostSampler(options) {
    if (options.device.createSampler === undefined) {
        options.diagnostics.push({
            code: "webGpuPostPass.createSamplerUnavailable",
            effectId: options.effectId,
            message: `SSAO post effect '${options.effectId}' cannot create an input sampler.`,
        });
        return null;
    }
    return options.device.createSampler({
        label: `aperture/post/${options.effectId}/sampler`,
        magFilter: "linear",
        minFilter: "linear",
        mipmapFilter: "nearest",
        addressModeU: "clamp-to-edge",
        addressModeV: "clamp-to-edge",
    });
}
function preparedSsaoPass(effectId, label, commands, diagnostics) {
    return {
        effectId,
        label,
        commands,
        diagnostics,
    };
}
function clampFinite(value, min, max) {
    if (!Number.isFinite(value)) {
        return min;
    }
    return Math.min(Math.max(value, min), max);
}
function clampInteger(value, min, max) {
    if (!Number.isFinite(value)) {
        return min;
    }
    return Math.min(Math.max(Math.floor(value), min), max);
}
function wgslFloat(value) {
    return value.toFixed(6);
}
function ssaoPostEffectWgsl(options) {
    const minAngleSine = Math.sin((options.minAngleDegrees * Math.PI) / 180);
    return `
struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
}

@group(0) @binding(0) var inputSampler: sampler;
@group(0) @binding(1) var inputTexture: texture_2d<f32>;
${postDepthTextureBindingWgsl(options.depthSampleCount)}
${options.appliesToIndirect ? "@group(0) @binding(3) var indirectTexture: texture_2d<f32>;" : ""}

const SAMPLE_COUNT: u32 = ${options.sampleCount}u;
const INV_SAMPLE_COUNT: f32 = ${wgslFloat(1 / options.sampleCount)};
const RADIUS_PIXELS: f32 = ${wgslFloat(options.radiusPixels)};
const INTENSITY: f32 = ${wgslFloat(options.intensity)};
const DEPTH_BIAS: f32 = ${wgslFloat(options.depthBias)};
const MAX_DEPTH_DIFFERENCE: f32 = ${wgslFloat(options.maxDepthDifference)};
const NEAR_PLANE: f32 = ${wgslFloat(options.near)};
const FAR_PLANE: f32 = ${wgslFloat(options.far)};
const TAN_HALF_FOV_Y: f32 = ${wgslFloat(Math.tan(options.fovYRadians * 0.5))};
const MIN_HORIZON_ANGLE_SINE_SQUARED: f32 = ${wgslFloat(minAngleSine * minAngleSine)};
const POWER: f32 = ${wgslFloat(options.power)};
const RANDOM_SEED: f32 = ${wgslFloat(options.randomSeed)};
const PI: f32 = 3.14159265;
const SPIRAL_TURNS: f32 = 10.0;

@vertex
fn vs(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
  var positions = array<vec2f, 3>(
    vec2f(-1.0, 3.0),
    vec2f(-1.0, -1.0),
    vec2f(3.0, -1.0),
  );
  var uvs = array<vec2f, 3>(
    vec2f(0.0, 2.0),
    vec2f(0.0, 0.0),
    vec2f(2.0, 0.0),
  );
  var output: VertexOutput;
  output.position = vec4f(positions[vertexIndex], 0.0, 1.0);
  output.uv = uvs[vertexIndex];
  return output;
}

fn clampCoord(coord: vec2i, dims: vec2u) -> vec2i {
  let maxCoord = vec2i(i32(dims.x) - 1, i32(dims.y) - 1);
  return clamp(coord, vec2i(0, 0), maxCoord);
}

fn coordFromUv(uv: vec2f, dims: vec2u) -> vec2i {
  let clampedUv = clamp(uv, vec2f(0.0), vec2f(0.999999));
  let pixel = clampedUv * vec2f(f32(dims.x), f32(dims.y));
  return clampCoord(vec2i(i32(pixel.x), i32(pixel.y)), dims);
}

${postDepthLoadFunctionWgsl(options.depthSampleCount)}

fn loadDepthUv(uv: vec2f, dims: vec2u) -> f32 {
  return loadDepth(coordFromUv(uv, dims), dims);
}

fn viewDepth(rawDepth: f32) -> f32 {
  let denominator = max(FAR_PLANE - rawDepth * (FAR_PLANE - NEAR_PLANE), 0.000001);
  return (NEAR_PLANE * FAR_PLANE) / denominator;
}

fn viewPosition(uv: vec2f, dims: vec2u) -> vec3f {
  let clampedUv = clamp(uv, vec2f(0.0), vec2f(1.0));
  let rawDepth = loadDepthUv(clampedUv, dims);
  let depth = viewDepth(rawDepth);
  let aspect = f32(dims.x) / max(f32(dims.y), 1.0);
  let ndc = vec2f(clampedUv.x * 2.0 - 1.0, (1.0 - clampedUv.y) * 2.0 - 1.0);
  return vec3f(ndc.x * depth * TAN_HALF_FOV_Y * aspect, ndc.y * depth * TAN_HALF_FOV_Y, -depth);
}

fn viewNormal(origin: vec3f, uv: vec2f, dims: vec2u, texel: vec2f) -> vec3f {
  let px = viewPosition(uv + vec2f(texel.x, 0.0), dims);
  let py = viewPosition(uv - vec2f(0.0, texel.y), dims);
  let faceNormal = cross(px - origin, py - origin);
  let normalLength = length(faceNormal);
  if (normalLength <= 0.000001) {
    return vec3f(0.0, 0.0, 1.0);
  }
  return faceNormal / normalLength;
}

fn random(fragCoord: vec2f) -> f32 {
  let seed = fragCoord + vec2f(RANDOM_SEED * 127.1, RANDOM_SEED * 311.7);
  return fract(52.9829189 * fract(dot(seed, vec2f(0.06711056, 0.00583715))));
}

fn startPosition(noise: f32) -> vec2f {
  let angle = ((2.0 * PI) * 2.4) * noise;
  return vec2f(cos(angle), sin(angle));
}

fn tapAngleStep() -> mat2x2f {
  let step = (INV_SAMPLE_COUNT * SPIRAL_TURNS) * 2.0 * PI;
  let t = vec2f(cos(step), sin(step));
  return mat2x2f(vec2f(t.x, t.y), vec2f(-t.y, t.x));
}

fn sampleColor(uv: vec2f) -> vec4f {
  return textureSample(inputTexture, inputSampler, clamp(uv, vec2f(0.0), vec2f(1.0)));
}

@fragment
fn fs(input: VertexOutput) -> @location(0) vec4f {
  let textureUv = vec2f(input.uv.x, 1.0 - input.uv.y);
  let source = sampleColor(textureUv);
  let dims = textureDimensions(depthTexture);
  let centerDepth = loadDepthUv(textureUv, dims);

  if (centerDepth >= 0.9999) {
    return source;
  }

  let texel = vec2f(1.0 / f32(dims.x), 1.0 / f32(dims.y));
  let origin = viewPosition(textureUv, dims);
  let normal = viewNormal(origin, textureUv, dims, texel);
  let centerLinearDepth = -origin.z;
  let viewRadius = max(centerLinearDepth * RADIUS_PIXELS * texel.y * 2.0 * TAN_HALF_FOV_Y, 0.0001);
  let invRadiusSquared = 1.0 / (viewRadius * viewRadius);
  let peak = max(0.1 * viewRadius, 0.0001);
  let peakSquared = peak * peak;
  let noise = random(input.position.xy);
  let angleStep = tapAngleStep();
  var tapPosition = startPosition(noise);
  var occlusion = 0.0;

  for (var i = 0u; i < SAMPLE_COUNT; i = i + 1u) {
    let radiusUnit = (f32(i) + noise + 0.5) * INV_SAMPLE_COUNT;
    let sampleRadiusPixels = max(1.0, radiusUnit * radiusUnit * RADIUS_PIXELS);
    let sampleUv = textureUv + tapPosition * sampleRadiusPixels * texel;
    let samplePosition = viewPosition(sampleUv, dims);
    let sampleDepth = -samplePosition.z;
    let viewVector = samplePosition - origin;
    let viewVectorSquared = max(dot(viewVector, viewVector), 0.0000001);
    let normalDistance = dot(viewVector, normal);
    var weight = max(0.0, 1.0 - viewVectorSquared * invRadiusSquared);
    weight = weight * weight;
    weight = weight * step(viewVectorSquared * MIN_HORIZON_ANGLE_SINE_SQUARED, normalDistance * normalDistance);
    let relativeDepthDelta = abs(centerLinearDepth - sampleDepth) / max(centerLinearDepth, 0.0001);
    let depthRange = 1.0 - smoothstep(MAX_DEPTH_DIFFERENCE, MAX_DEPTH_DIFFERENCE * 4.0, relativeDepthDelta);
    occlusion = occlusion + weight * depthRange * max(0.0, normalDistance + origin.z * DEPTH_BIAS) / (viewVectorSquared + peakSquared);
    tapPosition = angleStep * tapPosition;
  }

  let normalizedOcclusion = occlusion * ((2.0 * peak * 2.0 * PI * INTENSITY) / f32(SAMPLE_COUNT));
  let visibility = pow(clamp(1.0 - normalizedOcclusion, 0.0, 1.0), POWER);
${options.appliesToIndirect
        ? `  // M5-T6: attenuate only the indirect (ambient+IBL) contribution the lit
  // pass wrote to its second target. Removing indirect * (1 - visibility)
  // leaves direct light and emissive (= source - indirect) untouched.
  let indirect = textureSampleLevel(indirectTexture, inputSampler, textureUv, 0.0).rgb;
  return vec4f(source.rgb - indirect * (1.0 - visibility), source.a);`
        : `  return vec4f(source.rgb * visibility, source.a);`}
}
`;
}
//# sourceMappingURL=post-ssao.js.map