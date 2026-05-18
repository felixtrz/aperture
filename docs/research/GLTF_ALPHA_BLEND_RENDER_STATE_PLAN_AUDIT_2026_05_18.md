# glTF Alpha Blend Render-State Plan Audit

Date: 2026-05-18

## Scope

Audit the `task-1351` plan to add a browser regression for glTF
`alphaMode: "BLEND"` StandardMaterial render-state mapping.

## References Inspected

- `docs/research/NEXT_ROUTE_OR_GLTF_FIDELITY_AFTER_THREE_FAMILY_ROUTE_SUMMARY_PLAN_2026_05_18.md`
- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/DECISIONS.md`
- `packages/render/src/materials/gltf-material.ts`
- `packages/render/src/materials/pipeline-key.ts`
- `packages/webgpu/src/webgpu/material-render-state.ts`
- `packages/webgpu/src/webgpu/standard-pipeline-descriptor.ts`
- `examples/standard-gltf-texture.js`
- `test/e2e/standard-gltf-texture.spec.ts`
- `references/bevy/crates/bevy_pbr/src/material.rs`

## Findings

Pass. The selected follow-up is concrete enough for one focused run and is a
useful glTF fidelity slice after the recent route-summary work.

Boundary checks:

- The plan keeps ECS authoritative: the example still authors renderability
  through entities, mesh/material handles, typed assets, and render components.
- The plan preserves render extraction: the browser test should inspect the
  extracted/rendered app report and JSON-safe status rather than making the
  WebGPU backend query ECS directly.
- The plan keeps GPU ownership in `@aperture-engine/webgpu`: only the source
  glTF material fixture and browser regression should change unless a focused
  defect is exposed.
- The plan is compatible with the Bevy material pattern of material alpha mode
  influencing render phases/pipeline specialization while material data remains
  asset-authored rather than renderer-owned gameplay state.
- The selected pipeline key should be deterministic:
  `standard|baseColorTexture|blend|back|less|alpha` for a base-color textured
  StandardMaterial using alpha blending.

Risk notes:

- The fixture should assert render-state mapping and route/resource diagnostics,
  not attempt to prove full physically correct transparency ordering.
- If browser pixel blending is flaky, the implementation can still satisfy the
  task by checking status, pipeline key, resources, and JSON-safe diagnostics.

## Recommendation

Implement `task-1353` as planned. Keep the scope limited to
`examples/standard-gltf-texture.js` and
`test/e2e/standard-gltf-texture.spec.ts` unless the regression exposes a small
localized defect in material or WebGPU render-state mapping.

## Validation

Documentation-only audit; cover with formatting and final diff checks.
