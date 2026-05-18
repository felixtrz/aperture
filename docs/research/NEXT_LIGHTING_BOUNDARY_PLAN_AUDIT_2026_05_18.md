# Next Lighting Boundary Plan Audit

Date: 2026-05-18

## Scope

Audit
`docs/research/NEXT_LIGHTING_BOUNDARY_AFTER_STANDARD_MATERIAL_FIDELITY_PLAN_2026_05_18.md`
before implementation.

## References Inspected

- `docs/research/NEXT_LIGHTING_BOUNDARY_AFTER_STANDARD_MATERIAL_FIDELITY_PLAN_2026_05_18.md`
- `docs/research/STANDARD_MATERIAL_METALLIC_ROUGHNESS_TRANSFORM_SUPPORT_AUDIT_2026_05_18.md`
- `docs/research/LIGHTING_ENVIRONMENT_SHADOW_COVERAGE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/ARCHITECTURE.md`
- `packages/webgpu/src/webgpu/light-packing.ts`
- `packages/webgpu/src/webgpu/light-shader-metadata.ts`

## Findings

The plan is correctly scoped:

- It selects a diagnostics/readiness boundary for existing direct lighting.
- It does not add IBL, shadow-map passes, clustered lighting, render targets,
  or binary GLB loading.
- It keeps ECS light authoring and render-snapshot packets as the source data.
- It keeps WebGPU resource readiness in the WebGPU package, where light
  buffers, bind groups, and shader metadata already live.

The implementation target is useful because current lighting has two separate
states that should be visible in app status:

- extracted light packets by kind;
- WebGPU readiness for light buffers, layout, bind group, and shader metadata.

Surfacing both as JSON-safe diagnostics will make later IBL and shadow work
easier to verify without introducing new rendering passes now.

## Constraints For Implementation

The follow-up should stay helper-sized:

- Do not add a new ECS component or simulation dependency.
- Do not add environment-map or shadow-map GPU resources.
- Do not add a render graph or multi-pass submission path.
- Do not expose raw `GPUBuffer`, `GPUBindGroup`, or device objects in the
  report.
- Do not change StandardMaterial shading math unless the report reveals a real
  readiness bug.

## Recommended Follow-Up

Proceed with `task-1206`: add a direct-light readiness diagnostics report.

Suggested first test cases:

- empty light snapshot with missing WebGPU resources;
- ambient plus directional light with ready resources;
- metadata mismatch or missing bind group reports a diagnostic;
- JSON serialization does not include raw GPU object text.

## Outcome

The lighting plan is safe to implement before IBL or shadows. The next
implementation should be a report/diagnostics slice only.
