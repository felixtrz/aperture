# StandardMaterial Shadow Bind-Group Layout Slice Plan — 2026-05-19

## Task

Completed `task-1841`: compare StandardMaterial shadow bind-group layout
candidates and select one focused implementation task.

## References

- `packages/webgpu/src/webgpu/shadow-depth-texture-resource.ts`
- `packages/webgpu/src/webgpu/shadow-depth-resource-summary.ts`
- `packages/webgpu/src/webgpu/standard-material-ibl-shadow-binding-readiness.ts`
- `references/engine/src/scene/shader-lib/wgsl/chunks/lit/frag/lighting/shadowPCF3.js`
- `references/three.js/src/renderers/shaders/ShaderChunk/shadowmap_pars_fragment.glsl.js`

## Candidates

### 1. Shadow Bind-Group Layout Metadata

Define descriptor-only StandardMaterial shadow layout metadata for a
directional shadow matrix buffer, one depth texture, and a comparison sampler.

Pros:

- Mirrors the IBL layout metadata task.
- Clarifies group/binding numbers before resource creation.
- Keeps WGSL and pass submission deferred.

Cons:

- Does not make shadows visible.
- Needs matrix computation/buffer upload before bind-group resources become
  meaningful.

### 2. Shadow Matrix Buffer Binding Metadata Only

Add a binding contract for the existing matrix buffer descriptor while leaving
depth textures/samplers out of scope.

Pros:

- Smallest possible layout step.

Cons:

- Incomplete for StandardMaterial shadow sampling.
- Would likely be replaced by a fuller shadow layout soon.

### 3. Shadow WGSL Sampling Contract

Add WGSL declarations and sampling helpers for directional shadow maps.

Pros:

- Closest to visible shadow support.

Cons:

- Premature before matrix computation, buffer upload, comparison sampler
  creation, bind-group layout, and pass submission are ready.

## Selection

Implement candidate 1 after directional shadow matrix computation is underway:
descriptor-only StandardMaterial shadow bind-group layout metadata.

The layout should probably be a separate group from material and IBL resources,
for example:

- group 5 binding 0: directional shadow matrix buffer;
- group 5 binding 1: directional shadow depth texture;
- group 5 binding 2: comparison sampler.

Do not change WGSL or create bind groups in that slice.

## Recommended Follow-Up Task

```md
### task-1843 — Add StandardMaterial shadow bind-group layout metadata

Category: `webgpu-render`
Package/write-scope: `packages/webgpu`, targeted tests, GLTF scene status path.
Reference anchor: local `shadow-depth-texture-resource`,
`shadow-matrix-buffer-descriptor`, `standard-material-ibl-bind-group-layout`,
and this plan.

Acceptance criteria:

- Define JSON-safe StandardMaterial shadow bind-group layout metadata for a
  matrix buffer, shadow depth texture, and comparison sampler.
- Validate binding metadata without creating bind groups or changing WGSL.
- GLTF scene status reports shadow layout metadata as planned/deferred beside
  existing shadow depth and command summaries.
```

## Deferred

- Matrix buffer allocation/upload.
- Comparison sampler allocation.
- Shadow bind-group resource creation.
- Shadow pass submission.
- StandardMaterial shadow sampling.
