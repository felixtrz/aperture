# Custom Material Source Shape Decision Implementation Audit

Date: 2026-05-19

Task: `task-1709`

## Scope

Audit the `task-1708` decision record implementation.

Reference files inspected:

- `docs/research/NEXT_SOURCE_DECISION_OR_GLTF_AFTER_SOURCE_CHECKLIST_PLAN_2026_05_19.md`
- `docs/research/CUSTOM_MATERIAL_SOURCE_SHAPE_DECISION_PLAN_AUDIT_2026_05_19.md`
- `docs/DECISIONS.md`
- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `packages/render/src/materials/types.ts`
- `references/bevy/crates/bevy_pbr/src/material.rs`
- `references/bevy/crates/bevy_render/src/render_asset.rs`

## Findings

- Added Decision 0012, which accepts public custom material source assets as
  data-only instances of registered material families.
- The decision defines the minimum policy-level source shape without adding
  TypeScript interfaces, package exports, runtime validation, app facade
  options, shader loading, prepared-resource adapters, or browser rendering.
- The decision preserves the key architecture boundaries:
  - built-in `MaterialKind` remains a closed built-in union for now;
  - custom source assets use a distinct future public shape;
  - family-key collisions and unsupported families must diagnose instead of
    overriding or falling back;
  - raw WebGPU objects, callbacks, caches, and renderer-owned state are banned
    from source assets; and
  - GPU resources remain renderer/backend-owned prepared assets.
- The decision separates source validation diagnostics from route, dependency,
  preparation, frame-resource, and pipeline diagnostics, which gives follow-up
  implementation tasks a clearer boundary.
- No ECS/render ownership drift, WebGPU-only drift, public scene graph, IBL,
  shadows, binary GLB loading, or app-level non-built-in material rendering was
  introduced.

## Validation

Covered by final run-level validation for this automation cycle.

## Recommendation

Proceed to tracker/backlog alignment. The next implementation slice should add
source validation diagnostics for the Decision 0012 shape before exposing
public app-owned adapter facade options or rendered custom material families.
