# StandardMaterial IBL Bind-Group Layout Slice Plan — 2026-05-19

## Task

Completed `task-1834`: compare next StandardMaterial IBL binding steps and
select one focused implementation task.

## References

- `packages/webgpu/src/webgpu/standard-bind-group-layout.ts`
- `packages/webgpu/src/webgpu/standard-bind-group.ts`
- `packages/webgpu/src/webgpu/standard-material-ibl-shadow-binding-readiness.ts`
- `packages/webgpu/src/webgpu/ibl-texture-resource.ts`
- `packages/webgpu/src/webgpu/diffuse-ibl-resource-summary.ts`
- `references/engine/src/scene/shader-lib/wgsl/chunks/lit/frag/lighting/shadowPCF3.js`
- `references/three.js/src/renderers/shaders/ShaderChunk`

## Candidates

### 1. Add StandardMaterial IBL layout metadata

Define a JSON-safe bind-group layout plan for StandardMaterial environment
inputs: diffuse irradiance texture, specular prefilter texture, and IBL sampler
slots. This can follow the existing `standard-bind-group-layout` metadata and
validation pattern without creating bind groups or changing WGSL.

Pros:

- Small, testable, and architecture-preserving.
- Turns the current readiness `bindGroupLayout: false` into a concrete planned
  contract.
- Clarifies binding numbers and resource kinds before app-cache integration.

Cons:

- Does not make IBL visible.
- Needs clear diagnostics so users do not infer shader sampling is active.

### 2. Add IBL resource binding descriptors

Build descriptor plans that map live diffuse IBL texture/sampler reports into
bind-group entries.

Pros:

- Closer to actual frame resources.
- Would expose missing specular prefilter and sampler/resource mismatches.

Cons:

- Should wait until the layout contract is explicit.
- Intersects with the app-cache direction from `task-1833`.

### 3. Add WGSL IBL sampling

Change StandardMaterial WGSL to sample diffuse/specular IBL resources.

Pros:

- Produces user-visible lighting progress.

Cons:

- Too broad before layout, bind-group descriptors, specular prefiltering, and
  app-cache integration exist.
- Risks encoding placeholder lighting behavior as public shader semantics.

## Selection

Implement candidate 1 next: add StandardMaterial IBL bind-group layout metadata
and readiness reporting.

The task should stay descriptor-only. It should not allocate bind groups, change
`STANDARD_MESH_WGSL`, add shader sampling, or expose public custom material APIs.

## Recommended Follow-Up Task

```md
### task-1837 — Add StandardMaterial IBL bind-group layout metadata

Category: `webgpu-render`
Package/write-scope: `packages/webgpu`, targeted tests, GLTF scene status path.
Reference anchor: local `standard-bind-group-layout`,
`standard-material-ibl-shadow-binding-readiness`, diffuse IBL texture/sampler
resource reports, and this plan.

Acceptance criteria:

- Define a JSON-safe StandardMaterial IBL bind-group layout plan for diffuse
  irradiance texture, specular prefilter texture, and IBL sampler slots.
- Validate required/optional binding metadata without creating bind groups or
  changing WGSL.
- GLTF scene status reports the IBL layout plan as planned/deferred beside the
  existing shader-binding and pipeline-key readiness reports.
```

## Deferred

- App-cache integration for IBL resources.
- StandardMaterial IBL bind-group resource creation.
- Specular prefilter texture allocation.
- WGSL IBL sampling.
- Shadow-map bind-group layout and sampling.
