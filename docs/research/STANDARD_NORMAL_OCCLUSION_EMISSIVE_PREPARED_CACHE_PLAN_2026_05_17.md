# Standard Normal/Occlusion/Emissive Prepared Cache Plan - 2026-05-17

## Scope

Plan how to expand prepared `StandardMaterial` group-2 resources beyond the
current scalar, base-color textured, and metallic-roughness textured app routes.

## References Inspected

- `docs/ARCHITECTURE.md`
- `docs/RENDER_ASSET_PREPARATION.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/research/STANDARD_TEXTURED_PREPARED_DEPENDENCY_HANDOFF_PLAN_2026_05_17.md`
- `docs/research/STANDARD_TEXTURED_FAMILY_PREPARED_ROUTE_AUDIT_2026_05_17.md`
- `packages/webgpu/src/webgpu/prepared-standard-material-cache.ts`
- `packages/webgpu/src/webgpu/standard-app-frame-resources.ts`
- `packages/webgpu/src/webgpu/standard-material-buffer.ts`
- `packages/webgpu/src/webgpu/standard-bind-group.ts`
- `packages/webgpu/src/webgpu/app-texture-sampler-resources.ts`
- `test/webgpu/prepared-standard-material-cache.test.ts`
- `test/webgpu/webgpu-app.test.ts`

## Current State

- Scalar Standard prepared resources are cached by source material version,
  pipeline key, and group-2 layout key.
- Base-color and metallic-roughness textured Standard prepared resources add
  texture/sampler source-version dependency segments and consume prepared
  texture/sampler GPU resources from the app texture/sampler path.
- `createPreparedStandardTextureDependencyKeys` already derives ordered
  dependency segments for base-color, metallic-roughness, normal, occlusion, and
  emissive texture families.
- `createStandardMaterialPreparationPlan` and
  `createStandardMaterialBindGroupDescriptorPlan` already describe all current
  Standard texture bindings in group-2 binding order.

## Decision

Do not add three more independent copy-pasted family-specific helpers.

The next code slice should extract a shared textured Standard prepared material
implementation behind the existing base-color and metallic-roughness public
helpers. The shared implementation should accept a field-policy predicate so
the existing wrappers can keep their current exact-family behavior while the
next routes can opt into additional texture families without duplicating
material buffer, bind group, cache-key, and diagnostic assembly.

After that refactor:

1. Normal-map prepared resources should land as their own vertical slice. Normal
   maps have tangent/normal-map readiness requirements that must remain in mesh
   and material readiness diagnostics, not in the material cache key.
2. Occlusion and emissive prepared resources should land as one coherent
   multi-family slice. They do not add new vertex requirements, and the current
   app coverage already exercises combined occlusion/emissive texture resources.
3. A follow-up audit should run after normal, occlusion, and emissive are
   app-routed to verify the generic helper did not blur resource ownership.

## Required Direct Helper Tests

- Existing base-color prepared helper tests must keep the same cache segments,
  resource keys, skip diagnostics, and source-version invalidation behavior.
- Existing metallic-roughness prepared helper tests must keep the same cache
  segments, resource keys, skip diagnostics, and source-version invalidation
  behavior.
- Normal-only prepared resources must create and reuse group-2 material
  buffers/bind groups with binding order `0, 5, 6`.
- Occlusion-only prepared resources must create and reuse group-2 material
  buffers/bind groups with binding order `0, 7, 8`.
- Emissive-only prepared resources must create and reuse group-2 material
  buffers/bind groups with binding order `0, 9, 10`.
- Combined occlusion/emissive prepared resources must include ordered
  dependency segments and bind-group entries for both families.
- Missing/loading texture or sampler sources must return JSON-safe diagnostics
  without raw GPU resources, descriptors, texture views, samplers, cache maps,
  or device handles.

## Required App-Route Tests

- Normal-only Standard app frames should consume prepared group-2 material
  resources when source material, normal texture, normal sampler, pipeline, and
  layout keys are unchanged.
- Normal texture or sampler source-version changes should create a new prepared
  Standard material resource while reusing prepared mesh resources where
  possible.
- Occlusion/emissive Standard app frames should consume prepared group-2
  material resources for occlusion-only, emissive-only, and combined
  occlusion/emissive materials.
- Occlusion and emissive texture/sampler source-version changes should be
  visible through JSON-safe resource reuse counters.
- Full frame-resource cache hits must remain distinguishable from prepared
  material cache reuse.

## Guardrails

- Tangent and normal-map vertex requirements stay in readiness diagnostics and
  mesh/material validation. They are not material cache ownership and must not
  become dependency key segments.
- Group-3 light buffers and light bind groups remain frame-derived from
  `RenderSnapshot` light packets. They must not enter Standard prepared
  material cache keys.
- Texture and sampler GPU resources remain prepared by
  `app-texture-sampler-resources.ts` and are passed into prepared material
  helpers as dependencies.
- The WebGPU package may expose direct helper functions for tests, but
  `@aperture-engine/render`, `@aperture-engine/simulation`, and
  `@aperture-engine/core` must stay free of WebGPU resources.

## Backlog Shape

1. Extract shared textured Standard prepared helper with no behavior change.
2. Add normal-map prepared resource helper/app route.
3. Add occlusion/emissive prepared resource helper/app route.
4. Audit the generic textured Standard prepared route.
5. Continue toward a generic material-family queue/preparation contract once
   all current Standard texture families use prepared resources.
