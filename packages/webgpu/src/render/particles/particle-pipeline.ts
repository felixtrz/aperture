import {
  createWebGpuShaderModule,
  type WebGpuShaderDeviceLike,
  type WebGpuShaderDiagnostic,
  type WebGpuShaderFailureReason,
} from "../../gpu/shader.js";
import type {
  WebGpuRenderPipelineCreateDescriptor,
  WebGpuRenderPipelineDeviceLike,
} from "../../gpu/pipeline-cache.js";
import {
  applyOutputStageToFragmentWgsl,
  createTonemapPipelineKey,
  type TonemapOperator,
} from "../../output/output-stage-tonemap.js";
import {
  createOutputColorSpacePipelineKey,
  type OutputColorSpace,
} from "../../output/output-stage-color-space.js";
import {
  SpriteBlendMode,
  type ParticleRenderMode,
  type SpriteBlendMode as SpriteBlendModeValue,
} from "@aperture-engine/render";

export const PARTICLE_COMPUTE_PIPELINE_KEY = "aperture/gpu-particles-compute";
export const PARTICLE_RENDER_PIPELINE_KEY = "aperture/gpu-particles-render";
export const PARTICLE_BURST_RENDER_PIPELINE_KEY =
  "aperture/gpu-particles-burst-render";

export const PARTICLE_COMPUTE_WGSL = `
const PARTICLE_CURVE_SAMPLE_COUNT: u32 = 16u;

struct ParticleParams {
  frameSeedCapacityFlags: vec4u,
  originTime: vec4f,
  colorA: vec4f,
  colorB: vec4f,
  sizeSpeedLife: vec4f,
  sizeCurve: array<vec4f, 4>,
  colorCurve: array<vec4f, 16>,
};

struct ParticleData {
  positionSize: vec4f,
  color: vec4f,
};

@group(0) @binding(0) var<uniform> params: ParticleParams;
@group(0) @binding(1) var<storage, read_write> particles: array<ParticleData>;

fn hash(value: u32) -> f32 {
  var x = value;
  x = ((x >> 16u) ^ x) * 0x45d9f3bu;
  x = ((x >> 16u) ^ x) * 0x45d9f3bu;
  x = (x >> 16u) ^ x;
  return f32(x & 0x00ffffffu) / f32(0x01000000u);
}

fn sizeCurveValue(index: u32) -> f32 {
  let packed = params.sizeCurve[index / 4u];
  let component = index % 4u;

  if (component == 0u) {
    return packed.x;
  }
  if (component == 1u) {
    return packed.y;
  }
  if (component == 2u) {
    return packed.z;
  }
  return packed.w;
}

fn sampleSizeCurve(life: f32) -> f32 {
  let maxIndex = PARTICLE_CURVE_SAMPLE_COUNT - 1u;
  let scaled = clamp(life, 0.0, 1.0) * f32(maxIndex);
  let lower = u32(floor(scaled));
  let upper = min(lower + 1u, maxIndex);
  return mix(sizeCurveValue(lower), sizeCurveValue(upper), fract(scaled));
}

fn sampleColorCurve(life: f32) -> vec4f {
  let maxIndex = PARTICLE_CURVE_SAMPLE_COUNT - 1u;
  let scaled = clamp(life, 0.0, 1.0) * f32(maxIndex);
  let lower = u32(floor(scaled));
  let upper = min(lower + 1u, maxIndex);
  return mix(params.colorCurve[lower], params.colorCurve[upper], fract(scaled));
}

fn particleLife(offset: f32) -> f32 {
  return fract(params.originTime.w / max(params.sizeSpeedLife.z, 0.001) + offset);
}

@compute @workgroup_size(64)
fn cs_main(@builtin(global_invocation_id) id: vec3u) {
  let index = id.x;
  let capacity = params.frameSeedCapacityFlags.z;

  if (index >= capacity) {
    return;
  }

  if (index == 0u) {
    let life = particleLife(0.0);
    particles[index].positionSize = vec4f(
      params.originTime.x,
      params.originTime.y,
      params.originTime.z,
      max(0.001, max(params.sizeSpeedLife.x, params.sizeSpeedLife.y) * sampleSizeCurve(life))
    );
    particles[index].color = sampleColorCurve(life);
    return;
  }

  let frame = params.frameSeedCapacityFlags.x;
  let seed = params.frameSeedCapacityFlags.y;
  let fixedRandom = seed == 0x80000000u;
  let a = select(
    hash(seed ^ (index * 747796405u) ^ (frame * 2891336453u)),
    0.5,
    fixedRandom
  );
  let b = select(
    hash(seed ^ (index * 277803737u) ^ (frame * 1597334677u)),
    0.5,
    fixedRandom
  );
  let c = select(hash(seed ^ (index * 1442695041u)), 0.5, fixedRandom);
  let angle = a * 6.2831853;
  let radius = sqrt(b) * params.sizeSpeedLife.w;
  let drift = sin(params.originTime.w + f32(index) * 0.073) * 0.18;
  let life = particleLife(c);
  let baseSize = mix(params.sizeSpeedLife.x, params.sizeSpeedLife.y, c);
  let size = max(0.001, baseSize * sampleSizeCurve(life));
  let color = sampleColorCurve(life);

  particles[index].positionSize = vec4f(
    params.originTime.x + cos(angle) * radius,
    params.originTime.y + sin(angle) * radius + drift,
    params.originTime.z,
    size
  );
  particles[index].color = color;
}
`.trim();

export const PARTICLE_RENDER_WGSL = `
struct ViewProjectionUniform {
  viewProjection: mat4x4f,
  cameraPosition: vec4f,
  previousViewProjection: mat4x4f,
  fogColor: vec4f,
  fogParams: vec4f,
};

struct ParticleData {
  positionSize: vec4f,
  color: vec4f,
  frameData: vec4f,
  motionData: vec4f,
};

struct ParticleAxes {
  right: vec3f,
  up: vec3f,
};

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) color: vec4f,
  @location(1) uv: vec2f,
  @location(2) distanceToCamera: f32,
};

@group(0) @binding(0) var<uniform> view: ViewProjectionUniform;
@group(1) @binding(0) var<storage, read> particles: array<ParticleData>;
@group(2) @binding(0) var particleTexture: texture_2d<f32>;
@group(2) @binding(1) var particleSampler: sampler;
// PARTICLE_SOFT_BINDINGS

const PARTICLE_RENDER_MODE: u32 = 0u;

fn quadPosition(vertexIndex: u32) -> vec2f {
  let x = array<f32, 6>(-0.5, 0.5, 0.5, -0.5, 0.5, -0.5);
  let y = array<f32, 6>(-0.5, -0.5, 0.5, -0.5, 0.5, 0.5);
  return vec2f(x[vertexIndex], y[vertexIndex]);
}

fn quadUv(vertexIndex: u32) -> vec2f {
  let u = array<f32, 6>(0.0, 1.0, 1.0, 0.0, 1.0, 0.0);
  let v = array<f32, 6>(1.0, 1.0, 0.0, 1.0, 0.0, 0.0);
  return vec2f(u[vertexIndex], v[vertexIndex]);
}

fn sphereUv(vertexIndex: u32) -> vec2f {
  let cornerU = array<f32, 6>(0.0, 1.0, 1.0, 0.0, 1.0, 0.0);
  let cornerV = array<f32, 6>(0.0, 0.0, 1.0, 0.0, 1.0, 1.0);
  let cell = vertexIndex / 6u;
  let segment = cell % 16u;
  let ring = cell / 16u;
  return vec2f(
    (f32(segment) + cornerU[vertexIndex % 6u]) / 16.0,
    (f32(ring) + cornerV[vertexIndex % 6u]) / 8.0
  );
}

fn spherePosition(vertexIndex: u32) -> vec3f {
  let uv = sphereUv(vertexIndex);
  let longitude = uv.x * 6.283185307179586;
  let latitude = uv.y * 3.141592653589793;
  let ringRadius = sin(latitude) * 0.5;
  return vec3f(
    cos(longitude) * ringRadius,
    cos(latitude) * 0.5,
    sin(longitude) * ringRadius
  );
}

fn rotate2(value: vec2f, radians: f32) -> vec2f {
  let c = cos(radians);
  let s = sin(radians);
  return vec2f(value.x * c - value.y * s, value.x * s + value.y * c);
}

fn billboardAxes(position: vec3f) -> ParticleAxes {
  let forwardRaw = view.cameraPosition.xyz - position;
  let forwardLength = max(length(forwardRaw), 0.0001);
  let forward = forwardRaw / forwardLength;
  let rightRaw = cross(vec3f(0.0, 1.0, 0.0), forward);
  let rightLength = length(rightRaw);
  var right = rightRaw / max(rightLength, 0.0001);

  if (rightLength < 0.0001) {
    right = vec3f(1.0, 0.0, 0.0);
  }

  return ParticleAxes(right, normalize(cross(forward, right)));
}

fn horizontalAxes() -> ParticleAxes {
  return ParticleAxes(vec3f(1.0, 0.0, 0.0), vec3f(0.0, 0.0, 1.0));
}

fn verticalAxes(position: vec3f) -> ParticleAxes {
  let cameraOffset = view.cameraPosition.xyz - position;
  let projectedForwardRaw = vec3f(cameraOffset.x, 0.0, cameraOffset.z);
  let projectedLength = length(projectedForwardRaw);
  var projectedForward = projectedForwardRaw / max(projectedLength, 0.0001);

  if (projectedLength < 0.0001) {
    projectedForward = vec3f(0.0, 0.0, 1.0);
  }

  let up = vec3f(0.0, 1.0, 0.0);
  let rightRaw = cross(up, projectedForward);
  let rightLength = length(rightRaw);
  var right = rightRaw / max(rightLength, 0.0001);

  if (rightLength < 0.0001) {
    right = vec3f(1.0, 0.0, 0.0);
  }

  return ParticleAxes(right, up);
}

fn stretchedAxes(position: vec3f, motion: vec3f) -> ParticleAxes {
  var axes = billboardAxes(position);
  let motionLength = length(motion);

  // three.quarks uses a 0.001 velocity scale when speedFactor is zero, then
  // still normalizes that vector to orient the billboard. Do not discard
  // small non-zero motion here: it carries the particle's radial direction.
  if (motionLength > 0.0) {
    axes.up = motion / motionLength;
    let forwardRaw = view.cameraPosition.xyz - position;
    let forward = forwardRaw / max(length(forwardRaw), 0.0001);
    let rightRaw = cross(axes.up, forward);
    let rightLength = length(rightRaw);

    if (rightLength > 0.0001) {
      axes.right = rightRaw / rightLength;
    }
  }

  return axes;
}

fn particleAxes(position: vec3f, motion: vec3f) -> ParticleAxes {
  if (PARTICLE_RENDER_MODE == 1u || PARTICLE_RENDER_MODE == 4u) {
    return stretchedAxes(position, motion);
  }
  if (PARTICLE_RENDER_MODE == 2u) {
    return horizontalAxes();
  }
  if (PARTICLE_RENDER_MODE == 3u) {
    return verticalAxes(position);
  }

  return billboardAxes(position);
}

fn atlasUv(uv: vec2f, frameData: vec4f) -> vec2f {
  let columns = max(floor(frameData.x + 0.5), 1.0);
  let rows = max(floor(frameData.y + 0.5), 1.0);
  let frameCount = columns * rows;

  if (frameCount <= 1.0) {
    return uv;
  }

  let frame = clamp(floor(frameData.z), 0.0, frameCount - 1.0);
  let column = frame - floor(frame / columns) * columns;
  let row = floor(frame / columns);
  return (vec2f(column, row) + uv) / vec2f(columns, rows);
}

fn saturate(value: f32) -> f32 {
  return clamp(value, 0.0, 1.0);
}

fn applyParticleFog(color: vec3f, distanceToCamera: f32) -> vec3f {
  let mode = u32(round(view.fogParams.x));

  if (view.fogColor.a <= 0.0 || mode == 0u) {
    return color;
  }

  var fogFactor = 0.0;

  if (mode == 1u) {
    fogFactor = 1.0 - saturate((view.fogParams.w - distanceToCamera) / max(view.fogParams.w - view.fogParams.z, 0.0001));
  } else if (mode == 2u) {
    fogFactor = 1.0 - saturate(exp(-distanceToCamera * view.fogParams.y));
  } else {
    fogFactor = 1.0 - saturate(exp(-distanceToCamera * distanceToCamera * view.fogParams.y * view.fogParams.y));
  }

  return mix(color, view.fogColor.rgb, saturate(fogFactor * view.fogColor.a));
}

// PARTICLE_SOFT_FUNCTIONS

@vertex
fn vs_main(
  @builtin(vertex_index) vertexIndex: u32,
  @builtin(instance_index) instanceIndex: u32,
) -> VertexOutput {
  let particle = particles[instanceIndex];
  var world: vec3f;
  var uv: vec2f;
  if (PARTICLE_RENDER_MODE == 6u) {
    world =
      particle.positionSize.xyz +
      spherePosition(vertexIndex) * particle.positionSize.w;
    uv = sphereUv(vertexIndex);
  } else {
    let quad = quadPosition(vertexIndex);
    var local = rotate2(quad, particle.frameData.w) * particle.positionSize.w;
    if (PARTICLE_RENDER_MODE == 4u) {
      local = vec2f(
        quad.x * particle.positionSize.w,
        (quad.y - 0.5) * max(particle.positionSize.w, particle.motionData.w)
      );
    }

    let axes = particleAxes(particle.positionSize.xyz, particle.motionData.xyz);
    if (PARTICLE_RENDER_MODE == 1u) {
      // three.quarks-compatible stretched billboard: the particle position is
      // the leading edge, width comes from authored size, and longitudinal
      // extent is (scaled velocity + lengthFactor) * size.
      let longitudinal =
        (length(particle.motionData.xyz) + particle.motionData.w) *
        particle.positionSize.w;
      world =
        particle.positionSize.xyz +
        axes.right * (quad.y * particle.positionSize.w) -
        axes.up * ((quad.x + 0.5) * longitudinal);
    } else {
      world =
        particle.positionSize.xyz +
        axes.right * local.x +
        axes.up * local.y;
    }
    uv = atlasUv(quadUv(vertexIndex), particle.frameData);
  }
  var output: VertexOutput;

  output.position = view.viewProjection * vec4f(world, 1.0);
  output.color = particle.color;
  output.uv = uv;
  output.distanceToCamera = length(view.cameraPosition.xyz - world);
  return output;
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4f {
  let texel = textureSample(particleTexture, particleSampler, input.uv);
  let color = input.color * texel;
  return vec4f(
    applyParticleFog(color.rgb, input.distanceToCamera),
    color.a * particleSoftFade(input.position)
  );
}
`.trim();

export const PARTICLE_BURST_RENDER_WGSL = `
const PARTICLE_CURVE_SAMPLE_COUNT: u32 = 16u;

struct ViewProjectionUniform {
  viewProjection: mat4x4f,
  cameraPosition: vec4f,
  previousViewProjection: mat4x4f,
  fogColor: vec4f,
  fogParams: vec4f,
};

struct ParticleBurstData {
  originBirthTime: vec4f,
  velocityLifetime: vec4f,
  baseSizeTimeScale: vec4f,
  // Per-burst RGBA tint, multiplied over the authored colour curve. Opaque
  // white is the identity, so an untinted burst renders exactly as authored.
  colorTint: vec4f,
  // Appended: the burst's shared world origin (xyz) — the orbital pivot —
  // plus, in w, the index of this particle's block in the batch params array.
  // Matches the widened CPU wire stride of 20 floats; w was the reserved
  // spare, so claiming it changes no offset.
  emitterOrigin: vec4f,
};

struct ParticleBurstParams {
  timeGravity: vec4f,
  motion: vec4f,
  textureSheet: vec4f,
  sizeCurve: array<vec4f, 4>,
  frameCurveMin: array<vec4f, 4>,
  frameCurve: array<vec4f, 4>,
  colorCurve: array<vec4f, 16>,
  // Appended burst modulation-module data, mirroring the continuous CPU
  // path's curve evaluation. speedCurve samples s(lifeT); the integral
  // tables carry S0(u) = ∫ s and S1(u) = ∫ x·s so displacement stays
  // analytic: D = v0·L·S0(u) + g·L²·S1(u).
  speedCurve: array<vec4f, 4>,
  speedCurveIntegral: array<vec4f, 4>,
  speedCurveTimeIntegral: array<vec4f, 4>,
  sizeBySpeedCurve: array<vec4f, 4>,
  colorBySpeedCurve: array<vec4f, 16>,
  // sizeBySpeedRange min/max, colorBySpeedRange min/max.
  speedRanges: vec4f,
  // rotationBySpeedRange min/max, angularVelocityBySpeed min/max.
  rotationBySpeed: vec4f,
  // Orbital velocity xyz + radial velocity.
  orbital: vec4f,
  // Orbital offset xyz + speed-curve-enabled flag.
  orbitalOffset: vec4f,
  // Noise strength, frequency, scroll speed, damping flag.
  noiseParams: vec4f,
};

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) color: vec4f,
  @location(1) uv: vec2f,
  @location(2) distanceToCamera: f32,
};

@group(0) @binding(0) var<uniform> view: ViewProjectionUniform;
@group(1) @binding(0) var<storage, read> particles: array<ParticleBurstData>;
@group(2) @binding(0) var particleTexture: texture_2d<f32>;
@group(2) @binding(1) var particleSampler: sampler;
// One params block per effect in the batch. Batches merge bursts that share a
// pipeline, blend mode and texture/atlas, so the immutable per-effect state
// (gravity, damping, sheet, curves, modules) is indexed per instance instead
// of forcing one draw per effect. A single-effect batch is an array of one.
@group(3) @binding(0) var<storage, read> params: array<ParticleBurstParams>;
// PARTICLE_SOFT_BINDINGS

// The instance's params slot, published by vs_main before anything samples a
// curve. Every reader below runs inside the vertex entry point's call tree.
var<private> burstParamIndex: u32 = 0u;

const PARTICLE_RENDER_MODE: u32 = 0u;

struct ParticleAxes {
  right: vec3f,
  up: vec3f,
};

fn quadPosition(vertexIndex: u32) -> vec2f {
  let x = array<f32, 6>(-0.5, 0.5, 0.5, -0.5, 0.5, -0.5);
  let y = array<f32, 6>(-0.5, -0.5, 0.5, -0.5, 0.5, 0.5);
  return vec2f(x[vertexIndex], y[vertexIndex]);
}

fn quadUv(vertexIndex: u32) -> vec2f {
  let u = array<f32, 6>(0.0, 1.0, 1.0, 0.0, 1.0, 0.0);
  let v = array<f32, 6>(1.0, 1.0, 0.0, 1.0, 0.0, 0.0);
  return vec2f(u[vertexIndex], v[vertexIndex]);
}

fn sphereUv(vertexIndex: u32) -> vec2f {
  let cornerU = array<f32, 6>(0.0, 1.0, 1.0, 0.0, 1.0, 0.0);
  let cornerV = array<f32, 6>(0.0, 0.0, 1.0, 0.0, 1.0, 1.0);
  let cell = vertexIndex / 6u;
  let segment = cell % 16u;
  let ring = cell / 16u;
  return vec2f(
    (f32(segment) + cornerU[vertexIndex % 6u]) / 16.0,
    (f32(ring) + cornerV[vertexIndex % 6u]) / 8.0
  );
}

fn spherePosition(vertexIndex: u32) -> vec3f {
  let uv = sphereUv(vertexIndex);
  let longitude = uv.x * 6.283185307179586;
  let latitude = uv.y * 3.141592653589793;
  let ringRadius = sin(latitude) * 0.5;
  return vec3f(
    cos(longitude) * ringRadius,
    cos(latitude) * 0.5,
    sin(longitude) * ringRadius
  );
}

fn rotate2(value: vec2f, radians: f32) -> vec2f {
  let c = cos(radians);
  let s = sin(radians);
  return vec2f(value.x * c - value.y * s, value.x * s + value.y * c);
}

fn billboardAxes(position: vec3f) -> ParticleAxes {
  let forwardRaw = view.cameraPosition.xyz - position;
  let forwardLength = max(length(forwardRaw), 0.0001);
  let forward = forwardRaw / forwardLength;
  let rightRaw = cross(vec3f(0.0, 1.0, 0.0), forward);
  let rightLength = length(rightRaw);
  var right = rightRaw / max(rightLength, 0.0001);

  if (rightLength < 0.0001) {
    right = vec3f(1.0, 0.0, 0.0);
  }

  return ParticleAxes(right, normalize(cross(forward, right)));
}

fn horizontalAxes() -> ParticleAxes {
  return ParticleAxes(vec3f(1.0, 0.0, 0.0), vec3f(0.0, 0.0, 1.0));
}

fn verticalAxes(position: vec3f) -> ParticleAxes {
  let cameraOffset = view.cameraPosition.xyz - position;
  let projectedForwardRaw = vec3f(cameraOffset.x, 0.0, cameraOffset.z);
  let projectedLength = length(projectedForwardRaw);
  var projectedForward = projectedForwardRaw / max(projectedLength, 0.0001);

  if (projectedLength < 0.0001) {
    projectedForward = vec3f(0.0, 0.0, 1.0);
  }

  let up = vec3f(0.0, 1.0, 0.0);
  let rightRaw = cross(up, projectedForward);
  let rightLength = length(rightRaw);
  var right = rightRaw / max(rightLength, 0.0001);

  if (rightLength < 0.0001) {
    right = vec3f(1.0, 0.0, 0.0);
  }

  return ParticleAxes(right, up);
}

fn stretchedAxes(position: vec3f, motion: vec3f) -> ParticleAxes {
  var axes = billboardAxes(position);
  let motionLength = length(motion);

  // three.quarks uses a 0.001 velocity scale when speedFactor is zero, then
  // still normalizes that vector to orient the billboard. Do not discard
  // small non-zero motion here: it carries the particle's radial direction.
  if (motionLength > 0.0) {
    axes.up = motion / motionLength;
    let forwardRaw = view.cameraPosition.xyz - position;
    let forward = forwardRaw / max(length(forwardRaw), 0.0001);
    let rightRaw = cross(axes.up, forward);
    let rightLength = length(rightRaw);

    if (rightLength > 0.0001) {
      axes.right = rightRaw / rightLength;
    }
  }

  return axes;
}

fn particleAxes(position: vec3f, motion: vec3f) -> ParticleAxes {
  if (PARTICLE_RENDER_MODE == 1u || PARTICLE_RENDER_MODE == 4u) {
    return stretchedAxes(position, motion);
  }
  if (PARTICLE_RENDER_MODE == 2u) {
    return horizontalAxes();
  }
  if (PARTICLE_RENDER_MODE == 3u) {
    return verticalAxes(position);
  }

  return billboardAxes(position);
}

fn saturate(value: f32) -> f32 {
  return clamp(value, 0.0, 1.0);
}

fn applyParticleFog(color: vec3f, distanceToCamera: f32) -> vec3f {
  let mode = u32(round(view.fogParams.x));

  if (view.fogColor.a <= 0.0 || mode == 0u) {
    return color;
  }

  var fogFactor = 0.0;

  if (mode == 1u) {
    fogFactor = 1.0 - saturate((view.fogParams.w - distanceToCamera) / max(view.fogParams.w - view.fogParams.z, 0.0001));
  } else if (mode == 2u) {
    fogFactor = 1.0 - saturate(exp(-distanceToCamera * view.fogParams.y));
  } else {
    fogFactor = 1.0 - saturate(exp(-distanceToCamera * distanceToCamera * view.fogParams.y * view.fogParams.y));
  }

  return mix(color, view.fogColor.rgb, saturate(fogFactor * view.fogColor.a));
}

// PARTICLE_SOFT_FUNCTIONS

fn sizeCurveValue(index: u32) -> f32 {
  let packed = params[burstParamIndex].sizeCurve[index / 4u];
  let component = index % 4u;

  if (component == 0u) {
    return packed.x;
  }
  if (component == 1u) {
    return packed.y;
  }
  if (component == 2u) {
    return packed.z;
  }
  return packed.w;
}

fn sampleSizeCurve(life: f32) -> f32 {
  let maxIndex = PARTICLE_CURVE_SAMPLE_COUNT - 1u;
  let scaled = clamp(life, 0.0, 1.0) * f32(maxIndex);
  let lower = u32(floor(scaled));
  let upper = min(lower + 1u, maxIndex);
  return mix(sizeCurveValue(lower), sizeCurveValue(upper), fract(scaled));
}

fn frameCurveMinValue(index: u32) -> f32 {
  let packed = params[burstParamIndex].frameCurveMin[index / 4u];
  let component = index % 4u;

  if (component == 0u) {
    return packed.x;
  }
  if (component == 1u) {
    return packed.y;
  }
  if (component == 2u) {
    return packed.z;
  }
  return packed.w;
}

fn frameCurveValue(index: u32) -> f32 {
  let packed = params[burstParamIndex].frameCurve[index / 4u];
  let component = index % 4u;

  if (component == 0u) {
    return packed.x;
  }
  if (component == 1u) {
    return packed.y;
  }
  if (component == 2u) {
    return packed.z;
  }
  return packed.w;
}

fn sampleFrameCurveMin(life: f32) -> f32 {
  let maxIndex = PARTICLE_CURVE_SAMPLE_COUNT - 1u;
  let scaled = clamp(life, 0.0, 1.0) * f32(maxIndex);
  let lower = u32(floor(scaled));
  let upper = min(lower + 1u, maxIndex);
  return mix(frameCurveMinValue(lower), frameCurveMinValue(upper), fract(scaled));
}

fn sampleFrameCurve(life: f32, random: f32) -> f32 {
  let maxIndex = PARTICLE_CURVE_SAMPLE_COUNT - 1u;
  let scaled = clamp(life, 0.0, 1.0) * f32(maxIndex);
  let lower = u32(floor(scaled));
  let upper = min(lower + 1u, maxIndex);
  let maximum = mix(frameCurveValue(lower), frameCurveValue(upper), fract(scaled));

  if (params[burstParamIndex].motion.y < 0.5) {
    return maximum;
  }

  let minimum = sampleFrameCurveMin(life);
  return mix(minimum, maximum, random);
}

fn sampleColorCurve(life: f32) -> vec4f {
  let maxIndex = PARTICLE_CURVE_SAMPLE_COUNT - 1u;
  let scaled = clamp(life, 0.0, 1.0) * f32(maxIndex);
  let lower = u32(floor(scaled));
  let upper = min(lower + 1u, maxIndex);
  return mix(
    params[burstParamIndex].colorCurve[lower],
    params[burstParamIndex].colorCurve[upper],
    fract(scaled)
  );
}

fn scalarTableComponent(packed: vec4f, component: u32) -> f32 {
  if (component == 0u) {
    return packed.x;
  }
  if (component == 1u) {
    return packed.y;
  }
  if (component == 2u) {
    return packed.z;
  }
  return packed.w;
}

fn speedCurveValue(index: u32) -> f32 {
  let table = params[burstParamIndex].speedCurve;
  return scalarTableComponent(table[index / 4u], index % 4u);
}

fn speedCurveIntegralValue(index: u32) -> f32 {
  let table = params[burstParamIndex].speedCurveIntegral;
  return scalarTableComponent(table[index / 4u], index % 4u);
}

fn speedCurveTimeIntegralValue(index: u32) -> f32 {
  let table = params[burstParamIndex].speedCurveTimeIntegral;
  return scalarTableComponent(table[index / 4u], index % 4u);
}

fn sizeBySpeedCurveValue(index: u32) -> f32 {
  let table = params[burstParamIndex].sizeBySpeedCurve;
  return scalarTableComponent(table[index / 4u], index % 4u);
}

fn sampleSpeedCurve(life: f32) -> f32 {
  let maxIndex = PARTICLE_CURVE_SAMPLE_COUNT - 1u;
  let scaled = clamp(life, 0.0, 1.0) * f32(maxIndex);
  let lower = u32(floor(scaled));
  let upper = min(lower + 1u, maxIndex);
  return mix(speedCurveValue(lower), speedCurveValue(upper), fract(scaled));
}

fn sampleSpeedCurveIntegral(life: f32) -> f32 {
  let maxIndex = PARTICLE_CURVE_SAMPLE_COUNT - 1u;
  let scaled = clamp(life, 0.0, 1.0) * f32(maxIndex);
  let lower = u32(floor(scaled));
  let upper = min(lower + 1u, maxIndex);
  return mix(
    speedCurveIntegralValue(lower),
    speedCurveIntegralValue(upper),
    fract(scaled)
  );
}

fn sampleSpeedCurveTimeIntegral(life: f32) -> f32 {
  let maxIndex = PARTICLE_CURVE_SAMPLE_COUNT - 1u;
  let scaled = clamp(life, 0.0, 1.0) * f32(maxIndex);
  let lower = u32(floor(scaled));
  let upper = min(lower + 1u, maxIndex);
  return mix(
    speedCurveTimeIntegralValue(lower),
    speedCurveTimeIntegralValue(upper),
    fract(scaled)
  );
}

fn sampleSizeBySpeedCurve(life: f32) -> f32 {
  let maxIndex = PARTICLE_CURVE_SAMPLE_COUNT - 1u;
  let scaled = clamp(life, 0.0, 1.0) * f32(maxIndex);
  let lower = u32(floor(scaled));
  let upper = min(lower + 1u, maxIndex);
  return mix(sizeBySpeedCurveValue(lower), sizeBySpeedCurveValue(upper), fract(scaled));
}

fn sampleColorBySpeedCurve(life: f32) -> vec4f {
  let maxIndex = PARTICLE_CURVE_SAMPLE_COUNT - 1u;
  let scaled = clamp(life, 0.0, 1.0) * f32(maxIndex);
  let lower = u32(floor(scaled));
  let upper = min(lower + 1u, maxIndex);
  return mix(
    params[burstParamIndex].colorBySpeedCurve[lower],
    params[burstParamIndex].colorBySpeedCurve[upper],
    fract(scaled)
  );
}

// Mirrors the CPU normalizedRangeT: a collapsed range acts as a threshold.
fn normalizedRangeT(value: f32, minValue: f32, maxValue: f32) -> f32 {
  if (maxValue <= minValue) {
    return select(0.0, 1.0, value >= maxValue);
  }
  return clamp((value - minValue) / (maxValue - minValue), 0.0, 1.0);
}

fn rotateAboutAxis(value: vec3f, axis: vec3f, radians: f32) -> vec3f {
  let c = cos(radians);
  let s = sin(radians);
  return value * c + cross(axis, value) * s + axis * dot(axis, value) * (1.0 - c);
}

fn normalizeOrZero(value: vec3f) -> vec3f {
  let valueLength = length(value);
  if (valueLength <= 0.000001) {
    return vec3f(0.0, 0.0, 0.0);
  }
  return value / valueLength;
}

// Mirrors the continuous CPU path's signedNoise hash exactly.
fn signedNoise(value: f32) -> f32 {
  let raw = sin(value * 12.9898 + sin(value * 78.233) * 37.719);
  return fract(raw) * 2.0 - 1.0;
}

fn particleNoiseVector(index: u32, position: vec3f, frequency: f32, phase: f32) -> vec3f {
  let seed = f32(index) * 19.19 + phase;
  let x = position.x * frequency;
  let y = position.y * frequency;
  let z = position.z * frequency;
  return normalizeOrZero(vec3f(
    signedNoise(x + y * 1.37 + z * 2.11 + seed),
    signedNoise(x * 2.23 - y + z * 1.71 + seed + 17.17),
    signedNoise(-x * 1.83 + y * 2.57 + z + seed + 31.31)
  ));
}

fn particleDisplacement(
  velocity: vec3f,
  gravity: vec3f,
  age: f32,
  damping: f32,
) -> vec3f {
  if (damping <= 0.0001) {
    return velocity * age + 0.5 * gravity * age * age;
  }

  let decay = exp(-damping * age);
  let invDamping = 1.0 / damping;
  let velocityTerm = velocity * ((1.0 - decay) * invDamping);
  let gravityTerm = gravity * (age * invDamping - (1.0 - decay) * invDamping * invDamping);
  return velocityTerm + gravityTerm;
}

fn positiveModulo(value: f32, divisor: f32) -> f32 {
  return value - floor(value / divisor) * divisor;
}

fn particleFrameRandom(index: u32) -> f32 {
  var value = index * 3266489917u + 374761393u;
  value = ((value >> 16u) ^ value) * 0x45d9f3bu;
  value = ((value >> 16u) ^ value) * 0x45d9f3bu;
  value = (value >> 16u) ^ value;
  return f32(value & 0x00ffffffu) / f32(0x01000000u);
}

fn atlasUvForFrame(uv: vec2f, columns: f32, rows: f32, frame: f32) -> vec2f {
  let column = frame - floor(frame / columns) * columns;
  let row = floor(frame / columns);
  return (vec2f(column, row) + uv) / vec2f(columns, rows);
}

fn atlasUvForLife(uv: vec2f, life: f32, random: f32) -> vec2f {
  let textureSheet = params[burstParamIndex].textureSheet;
  let columns = max(floor(textureSheet.x + 0.5), 1.0);
  let rows = max(floor(textureSheet.y + 0.5), 1.0);
  let frameCount = columns * rows;

  if (frameCount <= 1.0) {
    return uv;
  }

  let cycleCount = max(textureSheet.w, 0.0);
  let rawFrame =
    textureSheet.z + sampleFrameCurve(life, random) * frameCount * cycleCount;
  let frame = floor(positiveModulo(rawFrame, frameCount));
  return atlasUvForFrame(uv, columns, rows, frame);
}

@vertex
fn vs_main(
  @builtin(vertex_index) vertexIndex: u32,
  @builtin(instance_index) instanceIndex: u32,
) -> VertexOutput {
  let particle = particles[instanceIndex];
  // Publish this instance's params slot before any curve is sampled. Slots
  // that were never written hold 0, which is a valid block, and their zero
  // lifetime keeps them degenerate either way.
  burstParamIndex = u32(max(particle.emitterOrigin.w, 0.0));
  let lifetime = max(particle.velocityLifetime.w, 0.001);
  let timeGravity = params[burstParamIndex].timeGravity;
  let age =
    max(0.0, timeGravity.x - particle.originBirthTime.w) * particle.baseSizeTimeScale.y;
  let lifeT = clamp(age / lifetime, 0.0, 1.0);
  let alive = select(0.0, 1.0, age < lifetime);
  // speedOverLifetime scales the whole ballistic velocity (as the continuous
  // CPU path does), so displacement switches from the damped closed form to
  // the packed speed-curve integrals D = v0·L·S0(u) + g·L²·S1(u). With the
  // identity curve S0(u) = u and S1(u) = u²/2, matching the undamped form.
  let speedCurveActive = params[burstParamIndex].orbitalOffset.w > 0.5;
  var position: vec3f;
  if (speedCurveActive) {
    position = particle.originBirthTime.xyz +
      particle.velocityLifetime.xyz * (lifetime * sampleSpeedCurveIntegral(lifeT)) +
      timeGravity.yzw * (lifetime * lifetime * sampleSpeedCurveTimeIntegral(lifeT));
  } else {
    position = particle.originBirthTime.xyz + particleDisplacement(
      particle.velocityLifetime.xyz,
      timeGravity.yzw,
      age,
      params[burstParamIndex].motion.x
    );
  }
  var motion = particle.velocityLifetime.xyz + timeGravity.yzw * age;
  if (speedCurveActive) {
    motion *= sampleSpeedCurve(lifeT);
  }
  // Orbital velocity: the exact solution of dr/dt = w × r + r̂·radial about
  // the burst origin is a rotation of the radial direction with linear radius
  // growth; the ballistic displacement is carried along the rotation.
  let orbital = params[burstParamIndex].orbital;
  if (dot(orbital.xyz, orbital.xyz) > 0.0 || orbital.w != 0.0) {
    let center = particle.emitterOrigin.xyz + params[burstParamIndex].orbitalOffset.xyz;
    var relative = position - center;
    let angularSpeed = length(orbital.xyz);
    if (angularSpeed > 0.000001) {
      relative = rotateAboutAxis(relative, orbital.xyz / angularSpeed, angularSpeed * age);
    }
    let radialDirection = normalizeOrZero(relative);
    position = center + relative + radialDirection * (orbital.w * age);
    motion += cross(orbital.xyz, relative) + radialDirection * orbital.w;
  }
  // Noise/turbulence: sample the same hash field as the continuous CPU path
  // at the particle's current position, treating the current direction as
  // having acted over the particle's (damped) age.
  let noiseParams = params[burstParamIndex].noiseParams;
  if (noiseParams.x > 0.0 && noiseParams.y > 0.0) {
    let noiseDamped = noiseParams.w > 0.5;
    let noiseVector = particleNoiseVector(
      instanceIndex,
      position,
      noiseParams.y,
      age * noiseParams.z
    );
    let strengthFactor = select(1.0, 1.0 - lifeT, noiseDamped);
    let displacementTime = select(age, age * (1.0 - 0.5 * lifeT), noiseDamped);
    position += noiseVector * (noiseParams.x * displacementTime);
    motion += noiseVector * (noiseParams.x * strengthFactor);
  }
  let motionSpeed = length(motion);
  let speedRanges = params[burstParamIndex].speedRanges;
  let rotationBySpeed = params[burstParamIndex].rotationBySpeed;
  let sizeBySpeed = sampleSizeBySpeedCurve(
    normalizedRangeT(motionSpeed, speedRanges.x, speedRanges.y)
  );
  let speedColor = sampleColorBySpeedCurve(
    normalizedRangeT(motionSpeed, speedRanges.z, speedRanges.w)
  );
  let speedAngularVelocity = mix(
    rotationBySpeed.z,
    rotationBySpeed.w,
    normalizedRangeT(motionSpeed, rotationBySpeed.x, rotationBySpeed.y)
  );
  let size = max(0.0, particle.baseSizeTimeScale.x * sampleSizeCurve(lifeT) * sizeBySpeed * alive);
  let rotation = particle.baseSizeTimeScale.z +
    (particle.baseSizeTimeScale.w + speedAngularVelocity) * age;
  let stretchedMotion = motion * params[burstParamIndex].motion.z;
  var world: vec3f;
  var uv: vec2f;
  if (PARTICLE_RENDER_MODE == 6u) {
    world = position + spherePosition(vertexIndex) * size;
    uv = sphereUv(vertexIndex);
  } else {
    let quad = quadPosition(vertexIndex);
    var local = rotate2(quad, rotation) * size;

    if (PARTICLE_RENDER_MODE == 4u) {
      local = vec2f(
        quad.x * size,
        (quad.y - 0.5) * max(size, length(motion))
      );
    }

    let axes = particleAxes(
      position,
      select(motion, stretchedMotion, PARTICLE_RENDER_MODE == 1u)
    );
    if (PARTICLE_RENDER_MODE == 1u) {
      // three.quarks-compatible stretched billboard: the particle position is
      // the leading edge, width comes from authored size, and longitudinal
      // extent is (scaled velocity + lengthFactor) * size.
      let longitudinal =
        (length(stretchedMotion) + params[burstParamIndex].motion.w) * size;
      world =
        position +
        axes.right * (quad.y * size) -
        axes.up * ((quad.x + 0.5) * longitudinal);
    } else {
      world = position + axes.right * local.x + axes.up * local.y;
    }
    uv = atlasUvForLife(
      quadUv(vertexIndex),
      lifeT,
      particleFrameRandom(instanceIndex)
    );
  }
  var output: VertexOutput;

  output.position = view.viewProjection * vec4f(world, 1.0);
  output.color = sampleColorCurve(lifeT) * speedColor * particle.colorTint * alive;
  output.uv = uv;
  output.distanceToCamera = length(view.cameraPosition.xyz - world);
  return output;
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4f {
  let texel = textureSample(particleTexture, particleSampler, input.uv);
  let color = input.color * texel;
  return vec4f(
    applyParticleFog(color.rgb, input.distanceToCamera),
    color.a * particleSoftFade(input.position)
  );
}
`.trim();

export interface ParticleComputePipelineResource {
  readonly cacheKey: string;
  readonly shaderModule: unknown;
  readonly pipeline: unknown;
  readonly descriptor: unknown;
}

export interface ParticleRenderPipelineResource {
  readonly cacheKey: string;
  readonly shaderModule: unknown;
  readonly pipeline: unknown;
  readonly descriptor: WebGpuRenderPipelineCreateDescriptor;
}

export interface CreateParticleComputePipelineResourceResult {
  readonly valid: boolean;
  readonly resource: ParticleComputePipelineResource | null;
  readonly diagnostics: readonly ParticlePipelineDiagnostic[];
}

export interface CreateParticleRenderPipelineResourceResult {
  readonly valid: boolean;
  readonly resource: ParticleRenderPipelineResource | null;
  readonly diagnostics: readonly ParticlePipelineDiagnostic[];
}

export type ParticlePipelineDiagnosticCode =
  | "particlePipeline.shaderDiagnostic"
  | "particlePipeline.shaderCreationFailed"
  | "particlePipeline.createComputePipelineUnavailable"
  | "particlePipeline.createRenderPipelineUnavailable"
  | "particlePipeline.pipelineCreationFailed";

export interface ParticlePipelineDiagnostic {
  readonly code: ParticlePipelineDiagnosticCode;
  readonly message: string;
  readonly reason?: WebGpuShaderFailureReason;
  readonly severity?: WebGpuShaderDiagnostic["severity"];
}

export interface ParticlePipelineDeviceLike
  extends WebGpuShaderDeviceLike, WebGpuRenderPipelineDeviceLike {
  createComputePipeline?: (descriptor: unknown) => unknown;
}

export function particleComputePipelineCacheKey(): string {
  return PARTICLE_COMPUTE_PIPELINE_KEY;
}

export function particleRenderPipelineCacheKey(
  colorFormat: string,
  depthFormat: string | null = null,
  sampleCount = 1,
  blendMode: SpriteBlendModeValue = SpriteBlendMode.Additive,
  tonemap: TonemapOperator = "none",
  outputColorSpace: OutputColorSpace = "linear",
  renderMode: ParticleRenderMode = "billboard",
  softParticles = false,
): string {
  const outputStage =
    tonemap === "none" && outputColorSpace === "linear"
      ? ""
      : `:${createTonemapPipelineKey(tonemap)}:${createOutputColorSpacePipelineKey(outputColorSpace)}`;
  const renderModeStage =
    renderMode === "billboard" ? "" : `:mode-${renderMode}`;
  const softParticlesStage = softParticles ? ":soft-particles" : "";

  return `${PARTICLE_RENDER_PIPELINE_KEY}:${colorFormat}:${depthFormat ?? "no-depth"}:samples-${sampleCount}:blend-${blendMode}${renderModeStage}${softParticlesStage}${outputStage}`;
}

export function particleBurstRenderPipelineCacheKey(
  colorFormat: string,
  depthFormat: string | null = null,
  sampleCount = 1,
  blendMode: SpriteBlendModeValue = SpriteBlendMode.Additive,
  tonemap: TonemapOperator = "none",
  outputColorSpace: OutputColorSpace = "linear",
  renderMode: ParticleRenderMode = "billboard",
  softParticles = false,
): string {
  const outputStage =
    tonemap === "none" && outputColorSpace === "linear"
      ? ""
      : `:${createTonemapPipelineKey(tonemap)}:${createOutputColorSpacePipelineKey(outputColorSpace)}`;
  const renderModeStage =
    renderMode === "billboard" ? "" : `:mode-${renderMode}`;
  const softParticlesStage = softParticles ? ":soft-particles" : "";

  return `${PARTICLE_BURST_RENDER_PIPELINE_KEY}:${colorFormat}:${depthFormat ?? "no-depth"}:samples-${sampleCount}:blend-${blendMode}${renderModeStage}${softParticlesStage}${outputStage}`;
}

export function createParticleRenderShaderSource(
  options: {
    readonly variant?: "computed" | "burst";
    readonly renderMode?: ParticleRenderMode;
    readonly softParticles?: boolean;
  } = {},
): string {
  const burst = options.variant === "burst";

  return particleRenderShaderSource(
    burst ? PARTICLE_BURST_RENDER_WGSL : PARTICLE_RENDER_WGSL,
    supportedParticleRenderMode(options.renderMode),
    options.softParticles === true,
    burst ? 4 : 3,
  );
}

function particleRenderShaderSource(
  source: string,
  renderMode: ParticleRenderMode,
  softParticles: boolean,
  softGroup: number,
): string {
  return source
    .replace(
      "const PARTICLE_RENDER_MODE: u32 = 0u;",
      `const PARTICLE_RENDER_MODE: u32 = ${particleRenderModeCode(renderMode)}u;`,
    )
    .replace(
      "// PARTICLE_SOFT_BINDINGS",
      softParticles ? particleSoftBindingsWgsl(softGroup) : "",
    )
    .replace(
      "// PARTICLE_SOFT_FUNCTIONS",
      softParticles ? PARTICLE_SOFT_FADE_WGSL : PARTICLE_SOFT_FADE_NOOP_WGSL,
    );
}

const PARTICLE_SOFT_FADE_NOOP_WGSL = `
fn particleSoftFade(_fragmentPosition: vec4f) -> f32 {
  return 1.0;
}
`.trim();

const PARTICLE_SOFT_FADE_WGSL = `
fn particleSoftFade(fragmentPosition: vec4f) -> f32 {
  let dimensions = textureDimensions(particleSceneDepth);
  let maxCoord = vec2i(dimensions) - vec2i(1, 1);
  let coord = clamp(vec2i(fragmentPosition.xy), vec2i(0, 0), maxCoord);
  let sceneDepth = textureLoad(particleSceneDepth, coord, 0);

  if (sceneDepth >= 0.9999) {
    return 1.0;
  }

  let particleDepth = clamp(fragmentPosition.z, 0.0, 1.0);
  let delta = sceneDepth - particleDepth;
  let nearFade = max(particleSoftParams.fade.x, 0.0);
  let farFade = max(particleSoftParams.fade.y, nearFade + 0.000001);

  return clamp((delta - nearFade) / (farFade - nearFade), 0.0, 1.0);
}
`.trim();

function particleSoftBindingsWgsl(group: number): string {
  return `
struct ParticleSoftParams {
  fade: vec4f,
};

@group(${group}) @binding(0) var particleSceneDepth: texture_depth_2d;
@group(${group}) @binding(1) var<uniform> particleSoftParams: ParticleSoftParams;
`.trim();
}

function supportedParticleRenderMode(
  renderMode: ParticleRenderMode | undefined,
): ParticleRenderMode {
  switch (renderMode) {
    case "stretched-billboard":
    case "horizontal-billboard":
    case "vertical-billboard":
    case "sphere":
    case "mesh":
    case "trail":
      return renderMode;
    default:
      return "billboard";
  }
}

function particleRenderModeCode(renderMode: ParticleRenderMode): number {
  switch (renderMode) {
    case "stretched-billboard":
      return 1;
    case "horizontal-billboard":
      return 2;
    case "vertical-billboard":
      return 3;
    case "trail":
      return 4;
    case "mesh":
      return 5;
    case "sphere":
      return 6;
    default:
      return 0;
  }
}

export async function createParticleComputePipelineResource(options: {
  readonly device: ParticlePipelineDeviceLike;
}): Promise<CreateParticleComputePipelineResourceResult> {
  const shaderModule = await createWebGpuShaderModule({
    device: options.device,
    descriptor: {
      label: PARTICLE_COMPUTE_PIPELINE_KEY,
      code: PARTICLE_COMPUTE_WGSL,
    },
  });
  const shaderDiagnostics = shaderModule.diagnostics.map(mapShaderDiagnostic);

  if (!shaderModule.ok) {
    return {
      valid: false,
      resource: null,
      diagnostics: [
        ...shaderDiagnostics,
        {
          code: "particlePipeline.shaderCreationFailed",
          reason: shaderModule.reason,
          message: shaderModule.message,
        },
      ],
    };
  }

  if (options.device.createComputePipeline === undefined) {
    return {
      valid: false,
      resource: null,
      diagnostics: [
        ...shaderDiagnostics,
        {
          code: "particlePipeline.createComputePipelineUnavailable",
          message: "WebGPU device cannot create particle compute pipelines.",
        },
      ],
    };
  }

  const descriptor = {
    label: PARTICLE_COMPUTE_PIPELINE_KEY,
    layout: "auto",
    compute: {
      module: shaderModule.module,
      entryPoint: "cs_main",
    },
  };

  try {
    return {
      valid: true,
      resource: {
        cacheKey: particleComputePipelineCacheKey(),
        shaderModule: shaderModule.module,
        pipeline: options.device.createComputePipeline(descriptor),
        descriptor,
      },
      diagnostics: shaderDiagnostics,
    };
  } catch (error) {
    return {
      valid: false,
      resource: null,
      diagnostics: [
        ...shaderDiagnostics,
        {
          code: "particlePipeline.pipelineCreationFailed",
          message:
            error instanceof Error
              ? error.message
              : "WebGPU particle compute pipeline creation failed.",
        },
      ],
    };
  }
}

export async function createParticleRenderPipelineResource(options: {
  readonly device: ParticlePipelineDeviceLike;
  readonly colorFormat: string;
  readonly depthFormat?: string | null;
  readonly sampleCount?: number;
  readonly blendMode?: SpriteBlendModeValue;
  readonly tonemap?: TonemapOperator;
  readonly outputColorSpace?: OutputColorSpace;
  readonly variant?: "computed" | "burst";
  readonly renderMode?: ParticleRenderMode;
  readonly softParticles?: boolean;
}): Promise<CreateParticleRenderPipelineResourceResult> {
  // AI-17: no-op by default (none + linear) so the pipeline is byte-identical
  // unless the caller opts into the output stage.
  const tonemap = options.tonemap ?? "none";
  const outputColorSpace = options.outputColorSpace ?? "linear";
  const blendMode = options.blendMode ?? SpriteBlendMode.Additive;
  const burst = options.variant === "burst";
  const renderMode = supportedParticleRenderMode(options.renderMode);
  const softParticles = options.softParticles === true;
  const shaderModule = await createWebGpuShaderModule({
    device: options.device,
    descriptor: {
      label: burst
        ? PARTICLE_BURST_RENDER_PIPELINE_KEY
        : PARTICLE_RENDER_PIPELINE_KEY,
      code: applyOutputStageToFragmentWgsl(
        createParticleRenderShaderSource({
          variant: burst ? "burst" : "computed",
          renderMode,
          softParticles,
        }),
        tonemap,
        outputColorSpace,
        burst
          ? PARTICLE_BURST_RENDER_PIPELINE_KEY
          : PARTICLE_RENDER_PIPELINE_KEY,
      ),
    },
  });
  const shaderDiagnostics = shaderModule.diagnostics.map(mapShaderDiagnostic);

  if (!shaderModule.ok) {
    return {
      valid: false,
      resource: null,
      diagnostics: [
        ...shaderDiagnostics,
        {
          code: "particlePipeline.shaderCreationFailed",
          reason: shaderModule.reason,
          message: shaderModule.message,
        },
      ],
    };
  }

  if (options.device.createRenderPipeline === undefined) {
    return {
      valid: false,
      resource: null,
      diagnostics: [
        ...shaderDiagnostics,
        {
          code: "particlePipeline.createRenderPipelineUnavailable",
          message: "WebGPU device cannot create particle render pipelines.",
        },
      ],
    };
  }

  const descriptor = createParticleRenderPipelineDescriptor({
    label: burst
      ? PARTICLE_BURST_RENDER_PIPELINE_KEY
      : PARTICLE_RENDER_PIPELINE_KEY,
    shaderModule: shaderModule.module,
    colorFormat: options.colorFormat,
    ...(options.depthFormat === undefined
      ? {}
      : { depthFormat: options.depthFormat }),
    ...(options.sampleCount === undefined
      ? {}
      : { sampleCount: options.sampleCount }),
    blendMode,
  });

  try {
    return {
      valid: true,
      resource: {
        cacheKey: burst
          ? particleBurstRenderPipelineCacheKey(
              options.colorFormat,
              options.depthFormat ?? null,
              options.sampleCount ?? 1,
              blendMode,
              tonemap,
              outputColorSpace,
              renderMode,
              softParticles,
            )
          : particleRenderPipelineCacheKey(
              options.colorFormat,
              options.depthFormat ?? null,
              options.sampleCount ?? 1,
              blendMode,
              tonemap,
              outputColorSpace,
              renderMode,
              softParticles,
            ),
        shaderModule: shaderModule.module,
        pipeline: options.device.createRenderPipeline(descriptor),
        descriptor,
      },
      diagnostics: shaderDiagnostics,
    };
  } catch (error) {
    return {
      valid: false,
      resource: null,
      diagnostics: [
        ...shaderDiagnostics,
        {
          code: "particlePipeline.pipelineCreationFailed",
          message:
            error instanceof Error
              ? error.message
              : "WebGPU particle render pipeline creation failed.",
        },
      ],
    };
  }
}

function createParticleRenderPipelineDescriptor(input: {
  readonly label: string;
  readonly shaderModule: unknown;
  readonly colorFormat: string;
  readonly depthFormat?: string | null;
  readonly sampleCount?: number;
  readonly blendMode: SpriteBlendModeValue;
}): WebGpuRenderPipelineCreateDescriptor {
  return {
    label: `${input.label}:${input.colorFormat}`,
    layout: "auto",
    vertex: {
      module: input.shaderModule,
      entryPoint: "vs_main",
    },
    fragment: {
      module: input.shaderModule,
      entryPoint: "fs_main",
      targets: [
        {
          format: input.colorFormat,
          blend: particleBlendState(input.blendMode),
        },
      ],
    },
    primitive: {
      topology: "triangle-list",
      cullMode: "none",
      frontFace: "ccw",
    },
    ...(input.depthFormat === null || input.depthFormat === undefined
      ? {}
      : {
          depthStencil: {
            format: input.depthFormat,
            depthWriteEnabled: false,
            depthCompare: "less",
          },
        }),
    multisample: {
      count: input.sampleCount ?? 1,
    },
  };
}

function particleBlendState(blendMode: SpriteBlendModeValue): unknown {
  switch (blendMode) {
    case SpriteBlendMode.Opaque:
      return null;
    case SpriteBlendMode.Alpha:
      return {
        color: {
          operation: "add",
          srcFactor: "src-alpha",
          dstFactor: "one-minus-src-alpha",
        },
        alpha: {
          operation: "add",
          srcFactor: "one",
          dstFactor: "one-minus-src-alpha",
        },
      };
    case SpriteBlendMode.Multiply:
      return {
        color: {
          operation: "add",
          srcFactor: "dst",
          dstFactor: "zero",
        },
        alpha: {
          operation: "add",
          srcFactor: "one",
          dstFactor: "one-minus-src-alpha",
        },
      };
    case SpriteBlendMode.Additive:
    default:
      return {
        color: {
          operation: "add",
          srcFactor: "src-alpha",
          dstFactor: "one",
        },
        alpha: {
          operation: "add",
          srcFactor: "one",
          dstFactor: "one",
        },
      };
  }
}

function mapShaderDiagnostic(
  diagnostic: WebGpuShaderDiagnostic,
): ParticlePipelineDiagnostic {
  return {
    code: "particlePipeline.shaderDiagnostic",
    message: diagnostic.message,
    severity: diagnostic.severity,
  };
}
