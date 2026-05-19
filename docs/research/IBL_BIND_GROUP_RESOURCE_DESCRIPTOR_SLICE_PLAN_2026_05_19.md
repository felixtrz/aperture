# IBL Bind-Group Resource Descriptor Slice Plan — 2026-05-19

## Task

Completed `task-1844`: plan the next IBL bind-group resource descriptor
slice after descriptor-only StandardMaterial IBL layout metadata.

## Reference Anchors

- `packages/webgpu/src/webgpu/standard-material-ibl-bind-group-layout.ts`
- `packages/webgpu/src/webgpu/standard-bind-group.ts`
- `packages/webgpu/src/webgpu/matcap-bind-group.ts`
- `packages/webgpu/src/webgpu/diffuse-ibl-resource-summary.ts`
- `packages/webgpu/src/webgpu/ibl-texture-resource.ts`
- `packages/webgpu/src/webgpu/ibl-sampler-resource.ts`
- `docs/research/IBL_WEBGPU_APP_CACHE_INTEGRATION_PLAN_2026_05_19.md`

## Existing Pattern

The existing material bind-group flow is split into two steps:

1. build a descriptor plan from stable resource keys; and
2. create a live WebGPU bind group from the descriptor plan plus renderer-owned
   resources.

`standard-bind-group.ts` and `matcap-bind-group.ts` both validate required
resource keys before calling `device.createBindGroup()`. That keeps public
diagnostics JSON-safe and prevents raw GPU handles from crossing into ECS or
snapshot data.

The new IBL layout metadata gives StandardMaterial a planned group 4 shape:

- binding 0: diffuse irradiance texture view;
- binding 1: specular prefilter texture view; and
- binding 2: IBL sampler.

The GLTF scene path already has live diffuse texture/view and sampler resources.
It does not have a specular prefilter texture resource yet.

## Candidate Next Steps

### Candidate A — IBL bind-group descriptor planning

Add a JSON-safe descriptor plan that consumes the IBL layout metadata plus
resource reports and emits group 4 binding entries by stable resource key.

Pros:

- follows the proven StandardMaterial/Matcap pattern;
- makes the missing specular prefilter resource explicit;
- can be unit-tested without raw WebGPU objects;
- gives the GLTF scene a narrow readiness field before live bind-group
  creation; and
- keeps WGSL sampling deferred.

Cons:

- the plan will be invalid/deferred until a specular texture resource exists.

### Candidate B — App-cache integration first

Move diffuse IBL texture and sampler reuse into the private WebGPU app resource
cache before adding group 4 descriptor plans.

Pros:

- removes the current example-level cache before adding more resource
  consumers;
- aligns with the cache integration plan from `task-1838`.

Cons:

- touches app internals before the bind-group consumer contract is visible;
- does not clarify the required group 4 resource-key shape; and
- risks a broader diff than one focused resource slice.

### Candidate C — Specular prefilter texture allocation first

Allocate the specular prefilter texture resource before descriptor planning so
group 4 can become valid immediately.

Pros:

- unblocks a complete IBL bind-group descriptor later.

Cons:

- prefilter allocation implies mip sizing and eventually pass execution;
- it is a larger renderer-resource step than descriptor planning; and
- it is easier to scope correctly after the descriptor contract states exactly
  which specular key group 4 requires.

## Selected Follow-Up

Select Candidate A: add StandardMaterial IBL bind-group descriptor planning.

The next implementation should add a small `standard-material-ibl-bind-group`
module that mirrors the descriptor-plan half of `standard-bind-group.ts`,
without live bind-group creation.

Suggested report shape:

```ts
interface StandardMaterialIblBindGroupDescriptorPlan {
  valid: boolean;
  group: 4;
  resourceKey: string | null;
  entries: readonly {
    group: 4;
    binding: 0 | 1 | 2;
    resourceKey: string;
    resourceKind: "texture-view" | "sampler";
  }[];
  diagnostics: readonly Diagnostic[];
}
```

Inputs should be JSON-safe resource reports or extracted resource-key summaries,
not raw GPU handles.

## Acceptance For Follow-Up Implementation

- Add StandardMaterial IBL bind-group descriptor planning for group 4.
- Bindings match `standard-material-ibl-bind-group-layout.ts`.
- The plan reports diffuse texture and sampler keys when available.
- The plan reports a clear deferred/missing diagnostic for the specular
  prefilter texture key.
- GLTF scene status exposes the descriptor plan beside the layout metadata.
- No live bind-group creation and no WGSL sampling changes.

## Deferred

- App-cache integration of environment resources.
- Specular prefilter pass/resource allocation.
- Live group 4 bind-group creation.
- WGSL IBL sampling.
