// C1 (three.js parity plan): GPU boids — a compute pass integrates flock
// positions in a WRITABLE storage buffer, and an instanced custom material
// renders them the SAME frame with ZERO CPU copies, consuming that one realized
// GPU buffer BOTH as a read-only storage binding AND as a buffer-backed
// instance-attribute stream (slot 1). The frame graph orders compute-before-draw
// via a writer-before-reader edge on the buffer's handle id.
//
// This module is dependency-free (constants + WGSL + a deterministic seed) so it
// can be imported from BOTH the worker (which registers the buffer + spawns the
// instanced draw) and the main thread (which owns the compute pipeline).

// Kept tiny on purpose: the e2e runs under SwiftShader (slow), so a few hundred
// boids at most on a small canvas.
export const BOID_COUNT = 160;
export const BOID_WORKGROUP_SIZE = 64;
export const boidsCanvasSize = { width: 480, height: 360 };
export const boidsClearColor = [0.02, 0.03, 0.05, 1];

// The buffer id is the graph-resource handle shared by every consumer: the
// worker's material.storage() binding + buffer-backed instance stream, and the
// main thread's compute pass write + ctx.buffer(...) resolution.
export const BOID_BUFFER_ID = "boids.positions";

// Fixed simulation step so the authored dispatch schedule is reproducible with a
// fixed seed (determinism is about the CPU/ECS schedule, NOT bit-exact GPU
// floats — SwiftShader and real GPUs differ, and GPU positions never enter a
// determinism hash).
export const BOID_STEP_SECONDS = 1 / 60;

// Each boid is one vec4f: (posX, posY, velX, velY). posX/posY live in clip space
// (roughly [-1, 1]); velX/velY are clip-space units per second.
export const BOID_ELEMENT_TYPE = "vec4f";

/**
 * Deterministic seed: a small LCG (fixed seed) lays the flock out on a ring with
 * outward-ish initial velocities. Same bytes every run → the worker's buffer
 * registration (and thus the snapshot stream) is reproducible.
 */
export function seedBoids(count) {
  const data = new Float32Array(count * 4);
  let state = 0x9e3779b9 >>> 0;
  const next = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0xffffffff;
  };

  for (let index = 0; index < count; index += 1) {
    const angle = next() * Math.PI * 2;
    const radius = 0.15 + next() * 0.6;
    const heading = next() * Math.PI * 2;
    const speed = 0.18 + next() * 0.18;
    const offset = index * 4;

    data[offset] = Math.cos(angle) * radius;
    data[offset + 1] = Math.sin(angle) * radius * 0.72;
    data[offset + 2] = Math.cos(heading) * speed;
    data[offset + 3] = Math.sin(heading) * speed;
  }

  return data;
}

// Compute integrator (owned by the main thread's compute pass). Reads + writes
// the SAME storage buffer the draw consumes; the frame graph guarantees this
// runs before the draw that reads it.
export const boidsComputeWgsl = /* wgsl */ `
struct Params {
  count: u32,
  dt: f32,
  pad0: f32,
  pad1: f32,
};

@group(0) @binding(0) var<storage, read_write> boids: array<vec4f>;
@group(0) @binding(1) var<uniform> params: Params;

@compute @workgroup_size(${BOID_WORKGROUP_SIZE})
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let i = gid.x;
  if (i >= params.count) {
    return;
  }

  let boid = boids[i];
  var pos = boid.xy;
  var vel = boid.zw;

  var center = vec2f(0.0, 0.0);
  var heading = vec2f(0.0, 0.0);
  var separation = vec2f(0.0, 0.0);
  var neighbors = 0.0;

  for (var j = 0u; j < params.count; j = j + 1u) {
    if (j == i) {
      continue;
    }
    let other = boids[j];
    let delta = other.xy - pos;
    let dist2 = dot(delta, delta);
    if (dist2 < 0.09) {
      center += other.xy;
      heading += other.zw;
      neighbors += 1.0;
      if (dist2 < 0.0025) {
        separation -= delta;
      }
    }
  }

  if (neighbors > 0.0) {
    let cohesion = center / neighbors - pos;
    let alignment = heading / neighbors - vel;
    vel += cohesion * 0.015 + alignment * 0.05 + separation * 0.6;
  }

  // A gentle shared swirl keeps the flock in motion even when sparse.
  vel += vec2f(-pos.y, pos.x) * 0.35 * params.dt;

  let speed = length(vel);
  let maxSpeed = 0.65;
  let minSpeed = 0.18;
  if (speed > maxSpeed) {
    vel = vel / speed * maxSpeed;
  } else if (speed < minSpeed && speed > 0.0) {
    vel = vel / speed * minSpeed;
  }

  pos += vel * params.dt;

  // Wrap around the clip-space box so the flock stays on screen.
  if (pos.x > 1.08) { pos.x = -1.08; }
  if (pos.x < -1.08) { pos.x = 1.08; }
  if (pos.y > 0.82) { pos.y = -0.82; }
  if (pos.y < -0.82) { pos.y = 0.82; }

  boids[i] = vec4f(pos, vel);
}
`;

// Instanced render material (authored by the worker). Consumes the compute
// output TWO ways the same frame:
//   (b) @location(6) instanceState — buffer-backed instance stream (slot 1,
//       zero-copy) supplies THIS boid's (pos.xy, vel.xy) for placement/orient.
//   (a) group(2) storage binding `boids` — the whole array, read read-only to
//       tint each boid by a neighbour's speed (proves same-frame storage read).
export const boidsRenderWgsl = /* wgsl */ `
struct ViewProjectionUniform {
  viewProjection: mat4x4f,
  cameraPosition: vec4f,
};

struct VertexInput {
  @location(0) position: vec3f,
  @location(1) normal: vec3f,
  @location(2) uv: vec2f,
  @location(6) instanceState: vec4f,
  @builtin(instance_index) instanceIndex: u32,
};

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) tint: f32,
};

// Renderer-owned built-in contract: group(0) view + group(1) world transforms.
@group(0) @binding(0) var<uniform> view: ViewProjectionUniform;
@group(1) @binding(0) var<storage, read> worldTransforms: array<mat4x4f>;
// Custom group(2): the compute-written flock buffer, read-only (consumption a).
@group(2) @binding(0) var<storage, read> boids: array<vec4f>;

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;

  // Consumption (b): the instance stream carries this boid's live GPU state.
  let pos = input.instanceState.xy;
  let vel = input.instanceState.zw;
  let hasVel = length(vel) > 1e-4;
  let forward = select(vec2f(0.0, 1.0), normalize(vel), hasVel);
  let side = vec2f(forward.y, -forward.x);

  // Reference the renderer-owned contract bindings (identity transforms) so the
  // draw uses the exact built-in group(0)/group(1) layout; multiplied out to a
  // zero contribution — placement is fully GPU-driven from instanceState.
  let anchor =
    (view.viewProjection * worldTransforms[input.instanceIndex]
      * vec4f(0.0, 0.0, 0.0, 1.0)).xy * 0.0;

  let body = side * input.position.x + forward * input.position.y;
  output.position = vec4f(anchor + pos + body, 0.0, 1.0);

  // Consumption (a): read a neighbour from the storage array (same buffer) so a
  // missing/unordered compute write would visibly change the tint.
  let neighbor = boids[(input.instanceIndex + 1u) % arrayLength(&boids)];
  output.tint = clamp(length(neighbor.zw) * 1.6, 0.0, 1.0);
  return output;
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4f {
  let cool = vec3f(0.16, 0.52, 0.96);
  let warm = vec3f(1.0, 0.74, 0.2);
  return vec4f(mix(cool, warm, input.tint), 1.0);
}
`;
