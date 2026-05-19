# First Shadow Matrix Upload Resource Slice Plan — 2026-05-19

## Task

Completed `task-1839`: compare the next shadow matrix/upload candidates and
select one focused implementation task.

## References

- `packages/webgpu/src/webgpu/directional-shadow-view-projection-plan.ts`
- `packages/webgpu/src/webgpu/shadow-matrix-buffer-descriptor.ts`
- `packages/webgpu/src/webgpu/shadow-depth-texture-resource.ts`
- `references/engine/src/scene/renderer/render-pass-shadow-directional.js`

## Candidates

### 1. Shadow Matrix Buffer Allocation Only

Allocate a renderer-owned storage/uniform buffer from the existing
`ShadowMatrixBufferDescriptorReport` byte-size and entries, but keep matrix
values and upload deferred.

Pros:

- Small and mirrors the depth texture allocation slice.
- Proves live buffer allocation and JSON-safe resource keys.

Cons:

- A buffer without matrix data is not useful to shaders.
- Risks another allocation-only status report before the actual shadow math
  moves forward.

### 2. Directional Shadow Matrix Computation

Turn `DirectionalShadowViewProjectionPlanReport` from deferred keys into actual
directional light view/projection matrices for the single GLTF scene directional
light.

Pros:

- Converts the current biggest shadow blocker from placeholder metadata into
  render-meaningful data.
- Enables a later matrix buffer upload to write real values instead of empty or
  identity placeholders.
- Keeps GPU allocation and pass submission deferred.

Cons:

- Requires careful math tests for WebGPU projection conventions and stable
  orthographic bounds.

### 3. Matrix Buffer Allocation Plus Upload

Allocate a shadow matrix buffer and upload computed view/projection matrices in
one task.

Pros:

- Produces a complete shader-readable matrix resource.

Cons:

- Too broad before matrix computation itself is tested.
- Couples math policy, buffer allocation, queue upload, and status changes.

## Selection

Implement candidate 2 next: directional shadow matrix computation.

The task should compute JSON-safe matrix data from extracted directional light
transform data, shadow pass map size, and a conservative orthographic fit for
the current GLTF scene slice. It should not allocate buffers, encode shadow
passes, or change StandardMaterial WGSL.

## Recommended Follow-Up Task

```md
### task-1842 — Compute directional shadow view-projection matrices

Category: `webgpu-render`
Package/write-scope: `packages/webgpu`, targeted tests, GLTF scene status path.
Reference anchor: local `directional-shadow-view-projection-plan`,
`shadow-matrix-buffer-descriptor`, `@aperture-engine/simulation` math helpers,
and this plan.

Acceptance criteria:

- Compute deterministic directional shadow view, projection, and
  view-projection matrix arrays for the single directional shadow-map path.
- Keep matrix data JSON-safe and renderer-derived from extracted light/pass
  data.
- GLTF scene status distinguishes computed matrices from deferred GPU buffer
  allocation/upload and shadow pass submission.
```

## Deferred

- Shadow matrix GPU buffer allocation/upload.
- Shadow pass command encoding/submission.
- StandardMaterial shadow-map layout and sampling.
