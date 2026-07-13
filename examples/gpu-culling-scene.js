// C2 (three.js parity plan): GPU-driven culling + indirect draw. A COMPUTE pass
// tests a small set of instances against a moving cull plane, compacts the
// survivors into a storage buffer, AND writes the surviving instance COUNT into
// an indirect-draw argument buffer. A user RENDER pass then draws the survivors
// with a SINGLE ctx.drawIndirect(...) whose instance count lives entirely on the
// GPU — the CPU never authors it. This is the three.js WebGPU indirect-draw /
// IndirectStorageBufferAttribute analog.
//
// Dependency-free (constants + WGSL + seeds) so it imports from BOTH the worker
// (which registers the writable buffers + spawns a backdrop) and the main thread
// (which owns the compute + indirect-draw pipelines).

// Kept tiny on purpose: the e2e runs under SwiftShader (slow). A short row of
// instances on a small canvas is enough to prove the drawn count changes.
export const CULL_INSTANCE_COUNT = 6;
export const gpuCullingCanvasSize = { width: 320, height: 240 };
export const gpuCullingClearColor = [0.02, 0.03, 0.05, 1];

// Buffer ids are the graph-resource handles shared across passes: the compute
// pass declares WRITES to them, and the render pass resolves the exact same
// realized GPU buffers via ctx.buffer(id).
export const CULL_ARGS_BUFFER_ID = "gpu-culling.args";
export const CULL_INSTANCE_BUFFER_ID = "gpu-culling.instances";

// The indirect argument record is 4x u32 laid out for drawIndirect:
//   [vertexCount, instanceCount, firstVertex, firstInstance]
// vertexCount = 3 (one triangle per instance); instanceCount is REWRITTEN every
// frame by the compute pass with the survivor count. Seeded with the full count
// so a frame that runs before the first compute still draws something sensible.
export const CULL_ARGS_ELEMENT_TYPE = "u32";
export const CULL_ARGS_ELEMENT_COUNT = 4;
export const CULL_VERTEX_COUNT = 3;

// One vec4f per instance: (clipX, _, _, _). Compacted by the compute pass so the
// render pass reads survivors contiguously by @builtin(instance_index).
export const CULL_INSTANCE_ELEMENT_TYPE = "vec4f";

// The row of instance clip-space X positions the compute pass evaluates. Kept in
// WGSL as a closed form (no per-instance input buffer) so the example stays tiny.
export function instanceClipX(index) {
  return -0.75 + 0.3 * index;
}

/** The number of instances whose clipX is <= the cull threshold (CPU oracle for
 * the example status; the GPU computes the authoritative count independently). */
export function expectedVisibleCount(threshold) {
  let visible = 0;
  for (let index = 0; index < CULL_INSTANCE_COUNT; index += 1) {
    if (instanceClipX(index) <= threshold) {
      visible += 1;
    }
  }
  return visible;
}

export function seedArgsBuffer() {
  return new Uint32Array([CULL_VERTEX_COUNT, CULL_INSTANCE_COUNT, 0, 0]);
}

export function seedInstanceBuffer() {
  return new Float32Array(CULL_INSTANCE_COUNT * 4);
}

// Compute: cull by threshold, compact survivors, write the survivor count into
// the indirect argument record's instanceCount field (u32 index 1).
export const cullComputeWgsl = /* wgsl */ `
struct Params {
  cullThreshold: f32,
  count: u32,
  pad0: u32,
  pad1: u32,
};

@group(0) @binding(0) var<uniform> params: Params;
@group(0) @binding(1) var<storage, read_write> args: array<u32, 4>;
@group(0) @binding(2) var<storage, read_write> instances: array<vec4f>;

@compute @workgroup_size(1)
fn main() {
  var visible = 0u;
  for (var i = 0u; i < params.count; i = i + 1u) {
    let clipX = -0.75 + 0.3 * f32(i);
    if (clipX <= params.cullThreshold) {
      instances[visible] = vec4f(clipX, 0.0, 0.0, 0.0);
      visible = visible + 1u;
    }
  }
  // The GPU-authoritative drawn instance count. args[0] (vertexCount = 3),
  // args[2], args[3] were seeded once and are left untouched.
  args[1] = visible;
}
`;

// Render: one small triangle per surviving instance, offset in clip space by the
// compacted position. Consumed by a single ctx.drawIndirect(argsBuffer, 0).
export const cullDrawWgsl = /* wgsl */ `
@group(0) @binding(0) var<storage, read> instances: array<vec4f>;

struct VsOut {
  @builtin(position) position: vec4f,
  @location(0) color: vec3f,
};

@vertex
fn vs(
  @builtin(vertex_index) vertexIndex: u32,
  @builtin(instance_index) instanceIndex: u32,
) -> VsOut {
  var corners = array<vec2f, 3>(
    vec2f(-0.09, -0.12),
    vec2f(0.09, -0.12),
    vec2f(0.0, 0.14),
  );
  let offsetX = instances[instanceIndex].x;
  var out: VsOut;
  out.position = vec4f(corners[vertexIndex].x + offsetX, corners[vertexIndex].y, 0.0, 1.0);
  out.color = vec3f(1.0, 0.85, 0.2);
  return out;
}

@fragment
fn fs(input: VsOut) -> @location(0) vec4f {
  return vec4f(input.color, 1.0);
}
`;
